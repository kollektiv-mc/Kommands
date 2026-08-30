import { beforeEach, expect, test } from 'vitest'
import { originOf, useUiStore } from './useUiStore'

const RECT = { top: 10, left: 20, width: 100, height: 50 }

beforeEach(() => useUiStore.setState({ origin: null }))

test('the rect comes back for the thing it was captured for', () => {
  useUiStore.getState().openFrom('saved-1', RECT)
  expect(useUiStore.getState().originFor('saved-1')).toEqual(RECT)
})

test('reading is pure — the same key answers the same way every time', () => {
  useUiStore.getState().openFrom('saved-1', RECT)

  // This is the whole point of the key, and it replaced a take-and-clear that was
  // wrong in a way only StrictMode showed. React re-runs effects, so the first read
  // consumed the rect and the second found nothing and animated from the generic
  // fallback instead — every tile-to-editor open played the wrong animation, and
  // nothing about it looked broken.
  expect(useUiStore.getState().originFor('saved-1')).toEqual(RECT)
  expect(useUiStore.getState().originFor('saved-1')).toEqual(RECT)
  expect(useUiStore.getState().originFor('saved-1')).toEqual(RECT)
})

test('a rect captured for something else is not used', () => {
  useUiStore.getState().openFrom('saved-1', RECT)

  // What makes it safe never to clear: a stale entry is simply never matched. Opening
  // a different command, following a URL, or reloading all miss and get the fallback.
  expect(useUiStore.getState().originFor('saved-2')).toBeNull()
  expect(useUiStore.getState().originFor(undefined)).toBeNull()
})

test('with nothing captured there is no origin', () => {
  expect(useUiStore.getState().originFor('saved-1')).toBeNull()
})

test('an element with no rect reads as no origin rather than as zeros', () => {
  // A zeroed rect is not the same as no rect: it would divide by zero in the FLIP and
  // produce a transform of NaN, which renders nothing and looks like a mount failure.
  expect(originOf(null)).toBeNull()
})
