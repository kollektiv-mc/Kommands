import { describe, expect, test } from 'vitest'
import { CHAT_LIMIT } from '../data/authored/limits'
import { outputStatus, statusMessage } from './output-status'
import type { Segment } from './serialize'

const seg = (text: string, kind: Segment['kind'] = 'value'): Segment => ({ text, path: text, kind })

describe('outputStatus', () => {
  test('names what is missing, once each', () => {
    const status = outputStatus(
      [seg('/give', 'keyword'), seg('<targets>', 'placeholder'), seg('<item>', 'placeholder')],
      '/give <targets> <item>',
    )
    expect(status).toEqual({ kind: 'incomplete', missing: ['targets', 'item'] })
    expect(statusMessage(status)).toBe('Needs targets and item')
  })

  test('counts past the second missing part instead of listing them all', () => {
    const status = outputStatus(
      ['<a>', '<b>', '<c>', '<d>'].map((t) => seg(t, 'placeholder')),
      'x',
    )
    expect(statusMessage(status)).toBe('Needs a, b and 2 more')
  })

  test('a written default is not missing', () => {
    expect(outputStatus([seg('~ ~ ~', 'default')], '/particle flame ~ ~ ~').kind).toBe('chat')
  })

  test('says where a finished command can be run', () => {
    expect(outputStatus([seg('x')], 'x'.repeat(CHAT_LIMIT)).kind).toBe('chat')
    expect(outputStatus([seg('x')], 'x'.repeat(CHAT_LIMIT + 1)).kind).toBe('command-block')
    expect(outputStatus([seg('x')], 'x'.repeat(40_000)).kind).toBe('too-long')
    expect(statusMessage(outputStatus([], ''))).toBe('Nothing to copy yet')
  })
})
