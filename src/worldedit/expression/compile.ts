import type { Expr, Program, Stmt } from './ast'
import { almostEqual, BUILT_INS, factorial, UNIMPLEMENTED } from './functions'

/**
 * The syntax tree, compiled to closures.
 *
 * `docs/health-checklist.md` § 4 requires this shape: "compiles to a closure tree rather
 * than walking the AST per voxel". A 64³ region is 262,144 evaluations per input change,
 * so every `switch (node.kind)` that survives into evaluation is paid 262,144 times. All
 * of them happen here, once, at compile time — after this, evaluating is calling.
 *
 * Variables live in a flat array rather than a Map, and every name is resolved to an
 * index while compiling. `x` is a load from a slot, not a hash lookup.
 */

export interface CompileIssue {
  at?: number
  message: string
}

/** Thrown out of a compiled closure to unwind a `return`, and caught in `run`. */
class ReturnSignal {
  constructor(readonly value: number) {}
}
/** The same, for `break` and `continue`. Allocated once — they carry nothing. */
const BREAK = Symbol('break')
const CONTINUE = Symbol('continue')

class LoopSignal {
  constructor(readonly kind: symbol) {}
}
const BREAK_SIGNAL = new LoopSignal(BREAK)
const CONTINUE_SIGNAL = new LoopSignal(CONTINUE)

/**
 * A guard against expressions that do not finish.
 *
 * The language has `while` and `for`, so a preview can be handed a formula that never
 * returns. Counting steps turns a frozen tab into a diagnostic, which is the headless
 * half of the checklist's "the evaluated volume must be capped".
 */
export class StepLimitExceeded extends Error {
  constructor() {
    super('This expression did not finish. It may loop forever.')
    this.name = 'StepLimitExceeded'
  }
}

const DEFAULT_STEP_LIMIT = 100_000

/** Evaluation state, handed to every closure. One instance per compiled expression. */
interface Frame {
  slots: Float64Array
  /** Sparse scratch memory for megabuf/gmegabuf, which are indexed by arbitrary numbers. */
  buffers: Map<number, number>
  steps: number
  limit: number
}

type Eval = (frame: Frame) => number
type Exec = (frame: Frame) => void

/** Slots every expression has, in the order `evaluate` fills them. */
const INPUT_SLOTS = ['x', 'y', 'z'] as const
/** Writable outputs the expression may set to choose a material. */
const OUTPUT_SLOTS = ['type', 'data'] as const
/** Read-only names with fixed values. */
const CONSTANTS: Readonly<Record<string, number>> = {
  e: Math.E,
  pi: Math.PI,
  true: 1,
  false: 0,
}

export interface CompiledExpression {
  /**
   * Evaluate at one point. A block is placed where this is greater than zero.
   *
   * `type` and `data` are readable afterwards via `slot`, because an expression may
   * assign to them to pick a material per voxel.
   */
  evaluate(x: number, y: number, z: number): number
  /** A slot's value after the last `evaluate`. */
  slot(name: string): number
  /** Every name the source reads or writes, so a caller knows what it depends on. */
  readonly slots: readonly string[]
}

class Compiler {
  readonly issues: CompileIssue[] = []
  /** Name → index in the slot array. Built as names are met. */
  private readonly slotIndex = new Map<string, number>()
  readonly slotNames: string[] = []

  constructor() {
    for (const name of [...INPUT_SLOTS, ...OUTPUT_SLOTS]) this.slotFor(name)
  }

  slotFor(name: string): number {
    const existing = this.slotIndex.get(name)
    if (existing !== undefined) return existing
    const index = this.slotNames.length
    this.slotIndex.set(name, index)
    this.slotNames.push(name)
    return index
  }

  private issue(message: string, at?: number): void {
    if (at !== undefined && this.issues.some((i) => i.at === at)) return
    this.issues.push(at === undefined ? { message } : { at, message })
  }

  // ── Expressions ───────────────────────────────────────────────────────────

  expr(node: Expr): Eval {
    switch (node.kind) {
      case 'number': {
        const { value } = node
        return () => value
      }

      case 'name': {
        const constant = CONSTANTS[node.name]
        if (constant !== undefined) return () => constant
        const slot = this.slotFor(node.name)
        return (f) => f.slots[slot]!
      }

      case 'unary': {
        const operand = this.expr(node.operand)
        switch (node.op) {
          case '-':
            return (f) => -operand(f)
          case '+':
            return operand
          case '!':
            return (f) => (operand(f) === 0 ? 1 : 0)
          case '~':
            return (f) => ~operand(f)
        }
        break
      }

      case 'factorial': {
        const operand = this.expr(node.operand)
        return (f) => factorial(operand(f))
      }

      case 'binary':
        return this.binary(node)

      case 'logical': {
        // Value-returning short circuit, as in JavaScript rather than C: `0 || 5` is 5
        // and `2 || 5` is 2. WorldEdit's own tests pin this, and a version that
        // normalised to 0/1 would pass a great many of them anyway — which is exactly
        // why it needs saying here.
        const left = this.expr(node.left)
        const right = this.expr(node.right)
        return node.op === '&&'
          ? (f) => {
              const l = left(f)
              return l === 0 ? l : right(f)
            }
          : (f) => {
              const l = left(f)
              return l !== 0 ? l : right(f)
            }
      }

      case 'conditional': {
        const test = this.expr(node.test)
        const then = this.expr(node.then)
        const otherwise = this.expr(node.otherwise)
        return (f) => (test(f) !== 0 ? then(f) : otherwise(f))
      }

      case 'assign':
        return this.assign(node)

      case 'crement': {
        const slot = this.slotFor(node.name)
        const delta = node.op === '++' ? 1 : -1
        return node.prefix
          ? (f) => (f.slots[slot] = f.slots[slot]! + delta)
          : (f) => {
              const before = f.slots[slot]!
              f.slots[slot] = before + delta
              return before
            }
      }

      case 'call':
        return this.call(node)
    }
    return () => 0
  }

  private binary(node: Extract<Expr, { kind: 'binary' }>): Eval {
    const left = this.expr(node.left)
    const right = this.expr(node.right)
    switch (node.op) {
      case '+':
        return (f) => left(f) + right(f)
      case '-':
        return (f) => left(f) - right(f)
      case '*':
        return (f) => left(f) * right(f)
      case '/':
        return (f) => left(f) / right(f)
      case '%':
        return (f) => left(f) % right(f)
      // `^` is exponentiation. Not xor — see lex.ts.
      case '^':
        return (f) => left(f) ** right(f)
      case '<<':
        return (f) => left(f) << right(f)
      case '>>':
        return (f) => left(f) >> right(f)
      case '==':
        return (f) => (left(f) === right(f) ? 1 : 0)
      case '!=':
        return (f) => (left(f) !== right(f) ? 1 : 0)
      case '~=':
        return (f) => (almostEqual(left(f), right(f)) ? 1 : 0)
      case '<':
        return (f) => (left(f) < right(f) ? 1 : 0)
      case '<=':
        return (f) => (left(f) <= right(f) ? 1 : 0)
      case '>':
        return (f) => (left(f) > right(f) ? 1 : 0)
      case '>=':
        return (f) => (left(f) >= right(f) ? 1 : 0)
    }
  }

  private assign(node: Extract<Expr, { kind: 'assign' }>): Eval {
    const slot = this.slotFor(node.name)
    const value = this.expr(node.value)
    if (node.op === '=') return (f) => (f.slots[slot] = value(f))

    const apply = ((): ((a: number, b: number) => number) => {
      switch (node.op) {
        case '+=':
          return (a, b) => a + b
        case '-=':
          return (a, b) => a - b
        case '*=':
          return (a, b) => a * b
        case '/=':
          return (a, b) => a / b
        case '%=':
          return (a, b) => a % b
        case '^=':
          return (a, b) => a ** b
      }
    })()
    return (f) => (f.slots[slot] = apply(f.slots[slot]!, value(f)))
  }

  private call(node: Extract<Expr, { kind: 'call' }>): Eval {
    const args = node.args.map((arg) => this.expr(arg))

    // megabuf and gmegabuf are the same store here. Upstream they differ in lifetime —
    // one per invocation, one shared across them — and this evaluator runs one
    // invocation at a time, so the distinction has nowhere to show.
    if (node.name === 'megabuf' || node.name === 'gmegabuf') {
      if (args.length === 1) {
        const index = args[0]!
        return (f) => f.buffers.get(index(f)) ?? 0
      }
      if (args.length === 2) {
        const index = args[0]!
        const value = args[1]!
        return (f) => {
          const stored = value(f)
          f.buffers.set(index(f), stored)
          return stored
        }
      }
      this.issue(`${node.name} takes an index, and optionally a value to store.`, node.at)
      return () => 0
    }

    const unavailable = UNIMPLEMENTED[node.name]
    if (unavailable) {
      this.issue(`${node.name} ${unavailable}.`, node.at)
      return () => 0
    }

    const builtIn = BUILT_INS[node.name]
    if (!builtIn) {
      this.issue(`${node.name} is not a function.`, node.at)
      return () => 0
    }
    if (builtIn.arity !== -1 && builtIn.arity !== args.length) {
      this.issue(
        `${node.name} takes ${builtIn.arity} ${builtIn.arity === 1 ? 'argument' : 'arguments'}, not ${args.length}.`,
        node.at,
      )
      return () => 0
    }

    const { apply } = builtIn
    // Fixed arities get a shape with no array allocation per call, because these run
    // 262,144 times and `sin(x)` is the commonest thing in the language.
    if (args.length === 1) {
      const a = args[0]!
      return (f) => apply([a(f)])
    }
    if (args.length === 2) {
      const a = args[0]!
      const b = args[1]!
      return (f) => apply([a(f), b(f)])
    }
    return (f) => apply(args.map((arg) => arg(f)))
  }

  // ── Statements ────────────────────────────────────────────────────────────

  /**
   * Statements compile to `Exec`, and the last expression's value is the result.
   *
   * The value is kept in a slot rather than returned, because a statement sequence's
   * result is whatever the last *expression statement* produced — `a=2; a^=3; a` is 8 —
   * and threading that through every branch of `Exec` would put a return value on
   * statements that have none.
   */
  block(body: Stmt[], resultSlot: number): Exec {
    const steps = body.map((statement) => this.stmt(statement, resultSlot))
    if (steps.length === 1) return steps[0]!
    return (f) => {
      for (const step of steps) step(f)
    }
  }

  stmt(node: Stmt, result: number): Exec {
    switch (node.kind) {
      case 'empty':
        return () => {}

      case 'expr': {
        const value = this.expr(node.expr)
        return (f) => {
          f.slots[result] = value(f)
        }
      }

      case 'block':
        return this.block(node.body, result)

      case 'if': {
        const test = this.expr(node.test)
        const then = this.stmt(node.then, result)
        const otherwise = node.otherwise ? this.stmt(node.otherwise, result) : undefined
        return otherwise
          ? (f) => {
              if (test(f) !== 0) then(f)
              else otherwise(f)
            }
          : (f) => {
              if (test(f) !== 0) then(f)
            }
      }

      case 'while': {
        const test = this.expr(node.test)
        const body = this.stmt(node.body, result)
        return (f) => {
          while (test(f) !== 0) {
            tick(f)
            if (runLoopBody(body, f)) break
          }
        }
      }

      case 'do': {
        const test = this.expr(node.test)
        const body = this.stmt(node.body, result)
        return (f) => {
          do {
            tick(f)
            if (runLoopBody(body, f)) break
          } while (test(f) !== 0)
        }
      }

      case 'for': {
        const init = this.expr(node.init)
        const test = this.expr(node.test)
        const update = this.expr(node.update)
        const body = this.stmt(node.body, result)
        return (f) => {
          for (init(f); test(f) !== 0; update(f)) {
            tick(f)
            if (runLoopBody(body, f)) break
          }
        }
      }

      case 'simpleFor': {
        const counter = this.slotFor(node.counter)
        const first = this.expr(node.first)
        const last = this.expr(node.last)
        const body = this.stmt(node.body, result)
        return (f) => {
          const to = last(f)
          for (f.slots[counter] = first(f); f.slots[counter]! <= to; f.slots[counter]!++) {
            tick(f)
            if (runLoopBody(body, f)) break
          }
        }
      }

      case 'switch': {
        const target = this.expr(node.target)
        // Labelled bodies are kept in source order with the default among them, so a
        // matched label falls through into whatever follows it the way C does — including
        // into the default, if the default is not last. Treating the default as a
        // separate tail would get `case 1: … default: … case 2: …` wrong.
        const arms = node.cases.map((entry) => ({
          label: entry.value,
          body: this.block(entry.body, result),
        }))
        const bodies = arms.map((arm) => arm.body)
        const labels = arms.map((arm) => arm.label)
        const fallbackAt = node.fallbackAt
        if (node.fallback) bodies.splice(fallbackAt, 0, this.block(node.fallback, result))

        return (f) => {
          const value = target(f)
          let index = labels.indexOf(value)
          // A miss lands on the default, and a switch without one does nothing.
          if (index === -1) index = node.fallback ? fallbackAt : -1
          else if (node.fallback && index >= fallbackAt) index += 1
          if (index === -1) return
          try {
            for (let i = index; i < bodies.length; i++) bodies[i]!(f)
          } catch (signal) {
            if (signal instanceof LoopSignal && signal.kind === BREAK) return
            throw signal
          }
        }
      }

      case 'break':
        return () => {
          throw BREAK_SIGNAL
        }

      case 'continue':
        return () => {
          throw CONTINUE_SIGNAL
        }

      case 'return': {
        const value = this.expr(node.value)
        return (f) => {
          throw new ReturnSignal(value(f))
        }
      }
    }
  }
}

/** Charge one step, and stop if the budget is spent. */
function tick(frame: Frame): void {
  if (++frame.steps > frame.limit) throw new StepLimitExceeded()
}

/** Run a loop body, returning true if it asked to break. */
function runLoopBody(body: Exec, frame: Frame): boolean {
  try {
    body(frame)
    return false
  } catch (signal) {
    if (signal instanceof LoopSignal) return signal.kind === BREAK
    throw signal
  }
}

export interface CompileOptions {
  /** How many loop iterations one evaluation may take before it is stopped. */
  stepLimit?: number
}

/**
 * Compile a parsed program, or report why it cannot be.
 *
 * Issues are returned rather than thrown for the reason every validator in this codebase
 * does: an expression the user is halfway through typing is the normal case, not an
 * exceptional one.
 */
export function compileProgram(
  program: Program,
  options: CompileOptions = {},
): { expression: CompiledExpression; issues: CompileIssue[] } {
  const compiler = new Compiler()
  const resultSlot = compiler.slotFor(' result')
  const body = compiler.block(program.body, resultSlot)

  const slotNames = compiler.slotNames
  const frame: Frame = {
    slots: new Float64Array(slotNames.length),
    buffers: new Map(),
    steps: 0,
    limit: options.stepLimit ?? DEFAULT_STEP_LIMIT,
  }
  const slotIndex = new Map(slotNames.map((name, index) => [name, index]))
  const [xSlot, ySlot, zSlot] = [0, 1, 2]

  const expression: CompiledExpression = {
    evaluate(x, y, z) {
      // Every slot is cleared per point. Leaving them would let one voxel's `a` leak into
      // the next, which is invisible until an expression happens to read before writing.
      frame.slots.fill(0)
      frame.buffers.clear()
      frame.steps = 0
      frame.slots[xSlot] = x
      frame.slots[ySlot] = y
      frame.slots[zSlot] = z
      try {
        body(frame)
      } catch (signal) {
        if (signal instanceof ReturnSignal) return signal.value
        // A stray break or continue outside a loop is a no-op rather than an error, which
        // is what the reference implementation does.
        if (signal instanceof LoopSignal) return frame.slots[resultSlot]!
        throw signal
      }
      return frame.slots[resultSlot]!
    },
    slot(name) {
      const index = slotIndex.get(name)
      return index === undefined ? 0 : frame.slots[index]!
    },
    // The private result slot is named with a leading space so no source can reach it.
    slots: slotNames.filter((name) => !name.startsWith(' ')),
  }

  return { expression, issues: compiler.issues }
}
