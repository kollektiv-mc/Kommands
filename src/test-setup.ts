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

/**
 * Give `<dialog>` its methods back under jsdom.
 *
 * jsdom implements `HTMLDialogElement` and reflects the `open` attribute, but ships
 * none of the methods — `show`, `showModal` and `close` are all `undefined` as of
 * jsdom 28. A component that opens a dialog therefore throws in tests while working
 * in every browser that has shipped the element since 2022.
 *
 * This fills in the open/closed state and the `close` event, which is what assertions
 * here look at. It deliberately does **not** reproduce the top layer, `::backdrop`,
 * focus trapping, or Escape-to-close: those are the reasons to use a real `<dialog>`
 * rather than a div, and they come from the platform. No test may claim to have
 * verified them — they are browser behaviour, and this is a stub of the two lines of
 * state the assertions need.
 */
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  const open = function (this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.show = open
  HTMLDialogElement.prototype.showModal = open
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement, returnValue?: string) {
    this.open = false
    if (returnValue !== undefined) this.returnValue = returnValue
    this.dispatchEvent(new Event('close'))
  }
}
