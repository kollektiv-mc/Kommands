/**
 * Writing SNBT — the notation data components are expressed in.
 *
 * There is one writer rather than one per component because the punctuation is the
 * part that is easy to get subtly wrong, and a second implementation of it would
 * drift from the first silently: both would keep producing output, and only one
 * would be right.
 *
 * The tree is a value, not a string builder. A component spec describes what it
 * means and this file decides how it is punctuated, so a spec never concatenates
 * braces and never has to remember whether a particular field is quoted.
 */

/**
 * SNBT distinguishes numeric widths by suffix. Nothing in the acceptance set needs
 * one — the fields there are ints, which take none — but a spec that does need one
 * has to be able to say so, and the alternative is a spec formatting its own number.
 */
export type NumberSuffix = 'b' | 's' | 'L' | 'f' | 'd'

export type SnbtValue =
  /**
   * An already-serialized fragment, inserted verbatim.
   *
   * This exists for exactly one shape: a pre-1.21.5 text component, which *is* a
   * quoted JSON string. Re-encoding it as an SNBT string would escape the quotes it
   * is made of.
   */
  | { kind: 'raw'; text: string }
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number; suffix?: NumberSuffix }
  | { kind: 'bool'; value: boolean }
  | { kind: 'list'; items: readonly SnbtValue[] }
  /**
   * Ordered entries, not an object.
   *
   * Field order is part of the output and is not alphabetical — an attribute modifier
   * is written `type, amount, operation, slot, id`. An object would leave that order
   * to whichever code built the value, which is a property no test can pin down.
   */
  | { kind: 'compound'; entries: ReadonlyArray<readonly [string, SnbtValue]> }

export function writeSnbt(value: SnbtValue): string {
  switch (value.kind) {
    case 'raw':
      return value.text
    case 'string':
      return quote(value.value)
    case 'number':
      // Non-finite is left to print as NaN or Infinity rather than being coerced to a
      // plausible number. This file's failure mode has to be a command that visibly
      // does not work, never one that works and means something else.
      return `${value.value}${value.suffix ?? ''}`
    case 'bool':
      return value.value ? 'true' : 'false'
    case 'list':
      return `[${value.items.map(writeSnbt).join(',')}]`
    case 'compound':
      return `{${value.entries.map(([key, v]) => `${writeKey(key)}:${writeSnbt(v)}`).join(',')}}`
  }
}

/** Bare where SNBT allows it, quoted where it does not. */
const BARE_KEY = /^[A-Za-z0-9_.+-]+$/

function writeKey(key: string): string {
  return BARE_KEY.test(key) ? key : quote(key)
}

function quote(value: string): string {
  return `"${value.replace(/(["\\])/g, '\\$1')}"`
}
