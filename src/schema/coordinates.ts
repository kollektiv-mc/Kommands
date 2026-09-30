/**
 * Coordinates, as the six Brigadier position and rotation parsers read them.
 *
 * Stored as one string, the parts joined by single spaces with an empty part kept in
 * its place (`'1  '` is x set, y and z not). A string rather than an array so a tree
 * saved when these arguments were plain text fields loads unchanged, and so a value
 * typed there, `~ ~1 ~`, is already this shape (persistence.md § Value shapes).
 *
 * Grammar checked against minecraft.wiki's Argument types page: a part is a number,
 * `~` with an optional offset, or `^` with an optional offset. Local (`^`) parts come
 * all together or not at all, and only where the parser allows them. Where a parser
 * reads whole numbers, the absolute part must be one; an offset after `~` or `^` may
 * still be a decimal (`~0.5 ~1 ~-5` is the wiki's own block position example).
 */
export interface CoordinateShape {
  /** One name per part, in order. They label the fields and the warnings. */
  axes: readonly string[]
  /** Whether an absolute part must be a whole number. */
  integral: boolean
  /** Whether `^` local coordinates are accepted. */
  local: boolean
  /** What the fill button is called: a position fills "here", a rotation "current". */
  fill: 'Here' | 'Current'
}

export const COORDINATE_SHAPES: Readonly<Record<string, CoordinateShape>> = {
  block_pos: { axes: ['x', 'y', 'z'], integral: true, local: true, fill: 'Here' },
  vec3: { axes: ['x', 'y', 'z'], integral: false, local: true, fill: 'Here' },
  column_pos: { axes: ['x', 'z'], integral: true, local: false, fill: 'Here' },
  vec2: { axes: ['x', 'z'], integral: false, local: false, fill: 'Here' },
  rotation: { axes: ['yaw', 'pitch'], integral: false, local: false, fill: 'Current' },
  angle: { axes: ['yaw'], integral: false, local: false, fill: 'Current' },
}

/** The parts of a stored value, always one per axis. */
export function splitCoordinates(value: string, count: number): string[] {
  const exact = value.split(' ')
  if (exact.length === count) return exact
  // Typed by hand into the old text field, with its own spacing.
  const loose = value.trim() === '' ? [] : value.trim().split(/\s+/)
  return Array.from({ length: count }, (_, i) => loose[i] ?? '')
}

export const joinCoordinates = (parts: readonly string[]): string => parts.join(' ')

/** Every part relative to where the command runs: `~ ~ ~`. */
export const relativeHere = (shape: CoordinateShape): string =>
  joinCoordinates(shape.axes.map(() => '~'))

/**
 * The text a value emits: every part, or nothing. A position with a part missing is
 * not a position, and writing the parts there are would slide the next argument into
 * the gap; emitting nothing lets the serializer write the `<name>` placeholder instead.
 */
export function serializeCoordinates(value: string, shape: CoordinateShape): string {
  const parts = splitCoordinates(value, shape.axes.length).map((p) => p.trim())
  return parts.every((p) => p !== '') ? joinCoordinates(parts) : ''
}

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/
const WHOLE = /^-?\d+$/

/** What is wrong with a value, worded for the row under the fields. Never blocks. */
export function coordinateProblems(value: string, shape: CoordinateShape): string[] {
  const parts = splitCoordinates(value, shape.axes.length).map((p) => p.trim())
  const filled = parts.filter((p) => p !== '')
  if (filled.length === 0) return []
  const problems: string[] = []
  if (filled.length < parts.length) {
    const missing = shape.axes.filter((_, i) => parts[i] === '')
    problems.push(`Needs ${missing.join(' and ')} too`)
  }
  parts.forEach((part, i) => {
    if (part === '') return
    const axis = shape.axes[i]
    const marker = part[0] === '~' || part[0] === '^' ? part[0] : ''
    const rest = part.slice(marker.length)
    if (marker === '^' && !shape.local) problems.push(`${axis} cannot be local (^) here`)
    else if (marker !== '' && rest !== '' && !NUMBER.test(rest)) {
      problems.push(`${axis}: an offset after ${marker} is a number`)
    } else if (marker === '' && !NUMBER.test(part)) {
      problems.push(`${axis} must be a number, ~ or ^`)
    } else if (marker === '' && shape.integral && !WHOLE.test(part)) {
      problems.push(`${axis} must be a whole number`)
    }
  })
  const locals = filled.filter((p) => p.startsWith('^')).length
  if (shape.local && locals > 0 && locals < filled.length) {
    problems.push('Local (^) coordinates cannot be mixed with others')
  }
  return problems
}
