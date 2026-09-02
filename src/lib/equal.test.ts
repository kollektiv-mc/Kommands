import { expect, test } from 'vitest'
import { sameValue } from './equal'

test('key order is not a difference', () => {
  // The case this function exists for. A tree read back out of storage carries the
  // file's key order and a tree the editor just rebuilt carries insertion order, so a
  // stringify comparison would call an untouched command changed the moment it was
  // opened — and bump its revision for it.
  expect(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
  expect(sameValue({ x: { p: 'l', q: 'r' } }, { x: { q: 'r', p: 'l' } })).toBe(true)
})

test('a key holding undefined is the same as no key', () => {
  // `JSON.stringify` drops it, so the same tree before and after a save-and-reload
  // differs exactly here. Calling that a change would be a revision bump for opening.
  expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true)
  expect(sameValue({ a: 1 }, { a: 1, b: undefined })).toBe(true)
  // But a key that is *present and undefined* on one side and holds a real value on
  // the other is still a difference.
  expect(sameValue({ a: undefined }, { a: null })).toBe(false)
})

test('arrays compare by position, not by membership', () => {
  expect(sameValue([1, 2, 3], [1, 2, 3])).toBe(true)
  // Order is meaning here: a Repeat's instance ids and a text component's children are
  // both arrays whose order changes what the command emits.
  expect(sameValue([1, 2, 3], [3, 2, 1])).toBe(false)
  expect(sameValue([1, 2], [1, 2, 3])).toBe(false)
  // An array is never a record, whatever its keys look like.
  expect(sameValue([], {})).toBe(false)
  expect(sameValue({ 0: 'a' }, ['a'])).toBe(false)
})

test('primitives compare by identity, and types are not coerced', () => {
  expect(sameValue('1', 1)).toBe(false)
  expect(sameValue(0, false)).toBe(false)
  expect(sameValue(null, undefined)).toBe(false)
  expect(sameValue(null, {})).toBe(false)
  expect(sameValue(true, true)).toBe(true)
})

test('nesting is compared all the way down', () => {
  const tree = { args: { 'root.0': { id: 'stone', count: 1, lore: ['a', 'b'] } } }
  expect(sameValue(tree, { args: { 'root.0': { count: 1, id: 'stone', lore: ['a', 'b'] } } })).toBe(
    true,
  )
  // One character, four levels down. A shallow comparison would miss this, and the
  // command it emits would differ.
  expect(sameValue(tree, { args: { 'root.0': { id: 'stone', count: 1, lore: ['a', 'c'] } } })).toBe(
    false,
  )
})
