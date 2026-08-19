import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Unmount rendered trees between tests.
 *
 * Testing Library registers this itself when a test runner exposes `afterEach` as a
 * global. This project does not enable Vitest's `globals`, so nothing registered it
 * and every render stayed in the document — the second test in a file then found two
 * of everything. It surfaced as "Found multiple elements with the role textbox" in a
 * test whose own render produced exactly one.
 */
afterEach(cleanup)
