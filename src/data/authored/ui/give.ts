import type { UiMetadata } from '../../../schema/types'

/**
 * Presentation for `/give`.
 *
 * Derivation cannot produce any of this: Brigadier names arguments for the parser
 * that reads them, not for the person filling them in, and it carries no help text at
 * all. Keyed by argument name rather than by path, because a name is what the
 * definition guarantees is stable.
 */
export const giveUi: UiMetadata = {
  summary: 'Give an item to one or more players.',
  arguments: {
    targets: { label: 'Recipients', help: 'Who receives the item.' },
    item: { label: 'Item stack', help: 'The item, and any data components it carries.' },
    count: { label: 'Count', help: 'How many to give. One if left empty.' },
  },
}
