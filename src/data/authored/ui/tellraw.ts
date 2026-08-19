import type { UiMetadata } from '../../../schema/types'

/**
 * Presentation for `/tellraw`.
 *
 * Brigadier calls the component argument `message`, which is accurate and says
 * nothing about what can go in it — the same editor builds a translation key, a
 * scoreboard readout or a hoverable link.
 */
export const tellrawUi: UiMetadata = {
  summary: 'Send a formatted message to players, as chat.',
  arguments: {
    targets: { label: 'Recipients', help: 'Who sees the message.' },
    message: {
      label: 'Message',
      help: 'Text, a translation key, a selector or a score — with children, colour and events.',
    },
  },
}
