import { afterEach, expect, test } from 'vitest'
import { isRedirect } from '@tanstack/react-router'
import { skipOnInstall } from './site'
import { configureProbe } from '../storage/probe'

afterEach(() => configureProbe(null))

test('the hosted site shows the home page', () => {
  configureProbe(null)
  expect(() => skipOnInstall()).not.toThrow()
})

test('the installed app skips the site for the dashboard', () => {
  configureProbe({ shellVersion: '0.1.0', konnektPresent: false })
  let thrown: unknown
  try {
    skipOnInstall()
  } catch (e) {
    thrown = e
  }
  expect(isRedirect(thrown)).toBe(true)
  expect((thrown as { options: { to: string } }).options.to).toBe('/dashboard')
})
