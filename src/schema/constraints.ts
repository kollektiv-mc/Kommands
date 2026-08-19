import type { CommandValue } from './serialize'
import { pathsForName } from './paths'
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
 * A name can resolve to several paths once it sits under a Repeat, so "set" means
 * set at any of them.
 */
function isSet(target: string, definition: CommandDefinition, value: CommandValue): boolean {
  if (target.startsWith('-')) {
    return Object.entries(value.flags).some(([path, on]) => on && path.endsWith(`/${target}`))
  }
  return pathsForName(definition.root, target, value.repeats).some((p) => {
    const v = value.args[p]
    return v !== undefined && v !== '' && v !== false
  })
}

function numericValue(
  target: string,
  definition: CommandDefinition,
  value: CommandValue,
): number | undefined {
  for (const path of pathsForName(definition.root, target, value.repeats)) {
    const v = value.args[path]
    if (typeof v === 'number') return v
  }
  return undefined
}
