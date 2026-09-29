import { within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

/**
 * Choose `label` from a Listbox, Combobox or MenuButton, the way a person would: open
 * it, then click the option.
 *
 * The replacement for `user.selectOptions`, which only understands a native `<select>`
 * or a listbox whose options are already in the document. Picks by the visible label
 * rather than by the stored value, because the value of a choice is an index and a
 * test that says `'2'` says nothing about which branch it meant.
 *
 * An option is named by its label alone, since its description is announced as a
 * description, so the match is exact.
 */
export async function pick(user: UserEvent, trigger: HTMLElement, label: string): Promise<void> {
  await user.click(trigger)
  const listId = trigger.getAttribute('aria-controls')
  const list = listId === null ? null : document.getElementById(listId)
  if (!list) throw new Error(`pick: "${label}": the control did not open a list`)
  const target =
    within(list).queryAllByRole('option', { name: label })[0] ??
    within(list).getByRole('button', { name: label })
  await user.click(target)
}
