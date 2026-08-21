import type { CommandValue } from './serialize'
import { pathsForTarget } from './addressing'
import type { CommandDefinition, Constraint, Diagnostic } from './types'

/**
 * Evaluate a definition's cross-argument rules.
 *
 * Every result is a warning. Constraints are inspectable, testable data precisely so
 * they are not conditionals buried in an editor — and like every other check here,
 * they never block output. A user who wants to generate a command the rules dislike
 * gets the command and the warning.
 */
export function evaluateConstraints(
  definition: CommandDefinition,
  value: CommandValue,
): Diagnostic[] {
  return (definition.constraints ?? []).flatMap((c) => evaluate(c, definition, value))
}

function evaluate(
  constraint: Constraint,
  definition: CommandDefinition,
  value: CommandValue,
): Diagnostic[] {
  const set = constraint.targets.filter((t) => isSet(t, definition, value))

  switch (constraint.kind) {
    case 'mutex':
      return set.length > 1 ? [{ severity: 'warning', message: constraint.message }] : []

    case 'requires': {
      const [first, ...rest] = constraint.targets
      if (first === undefined || !isSet(first, definition, value)) return []
      const unmet = rest.filter((t) => !isSet(t, definition, value))
      return unmet.length > 0 ? [{ severity: 'warning', message: constraint.message }] : []
    }

    case 'range': {
      const numbers = constraint.targets.map((t) => numericValue(t, definition, value))
      if (numbers.some((n) => n === undefined)) return []
      const ordered = numbers.every(
        (n, i) => i === 0 || (numbers[i - 1] as number) <= (n as number),
      )
      return ordered ? [] : [{ severity: 'warning', message: constraint.message }]
    }
  }
}

/**
 * Whether a target — an argument name or a flag name like '-h' — carries a value.
 *
 * One selector resolves to one *node*, which invariant 7 checks; that node can still
 * occupy several *paths* once it sits under a Repeat, so "set" means set at any of
 * them. That sentence used to have to cover both readings at once, which is why the
 * ambiguity was invisible.
 *
 * Flags resolve through the same walk as arguments and carry which table to read.
 * They used to be found by scanning every key in `value.flags` for one ending in the
 * target — which matched nothing at all for a typo, and reported that as "the flag is
 * not set" rather than as "there is no such flag".
 */
function isSet(target: string, definition: CommandDefinition, value: CommandValue): boolean {
  return pathsForTarget(definition.root, target, value.repeats).some(({ kind, path }) => {
    if (kind === 'flag') return value.flags[path] === true
    const held = value.args[path]
    return held !== undefined && held !== '' && held !== false
  })
}

function numericValue(
  target: string,
  definition: CommandDefinition,
  value: CommandValue,
): number | undefined {
  for (const { kind, path } of pathsForTarget(definition.root, target, value.repeats)) {
    if (kind !== 'argument') continue
    const held = value.args[path]
    if (typeof held === 'number') return held
  }
  return undefined
}
