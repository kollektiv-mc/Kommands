import { within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

/**
 * Choose `label` from a Listbox, Combobox, MenuButton or Segmented control, the way a
 * person would: open it and click the option, or click the segment.
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
  // A segmented control is a radio group: every option is already on screen.
  if (trigger.getAttribute('role') === 'radiogroup') {
    await user.click(within(trigger).getByRole('radio', { name: label }))
    return
  }
  await user.click(trigger)
  const listId = trigger.getAttribute('aria-controls')
  const list = listId === null ? null : document.getElementById(listId)
  if (!list) throw new Error(`pick: "${label}": the control did not open a list`)
  const target =
    within(list).queryAllByRole('option', { name: label })[0] ??
    within(list).getByRole('button', { name: label })
  await user.click(target)
}
