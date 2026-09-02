/**
 * Every icon this app draws, as raw path data.
 *
 * **Not a library.** Konnekt reaches for `lucide-react`; this app cannot. The entry
 * chunk measures 112 KB gzipped against a CI-enforced 120 KB ceiling
 * (`scripts/check-bundle.ts`), and the budget exists to keep three.js and the preview
 * modules lazy — spending a third of the remaining headroom on an icon package to draw
 * twelve glyphs would be exactly the trade it is there to prevent. `CommandOverlay`
 * already said as much in a comment when it drew its close button as a `×`; this is
 * that comment, generalised, so the next control does not invent a seventh answer.
 *
 * The geometry is lucide's, on lucide's 24-unit grid, so the two products draw the
 * same shapes at the same weight. Lucide is ISC-licensed, which permits this; the
 * point of copying rather than depending is bytes, not licensing.
 *
 * Paths, not components, so a glyph costs a string. `Icon` below is the single element
 * that renders them, which is also the single place a stroke weight or a viewBox can
 * be got wrong.
 */
export const PATHS = {
  minus: 'M5 12h14',
  square: 'M3 3h18v18H3z',
  restore: 'M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3 M3 8h12a1 1 0 0 1 1 1v12H3z',
  close: 'M18 6 6 18 M6 6l12 12',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  maximize: 'M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7',
  minimize: 'M4 14h6v6 M20 10h-6V4 M14 10l7-7 M3 21l7-7',
  pin: 'M12 17v5 M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z',
  chevronDown: 'M6 9l6 6 6-6',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  pencil:
    'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z M15 5l4 4',
  trash:
    'M10 11v6 M14 11v6 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
} as const

export type IconName = keyof typeof PATHS
