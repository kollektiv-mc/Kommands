/**
 * The named colours a text component may carry.
 *
 * Authored rather than derived: mcmeta's summaries publish registries, and text
 * colours are not one — they are a closed set written into the text-component format
 * itself. Still versioned game data, and still not a literal in a component, which is
 * why the list is here and not inside the editor that offers it.
 *
 * A component may also carry `#rrggbb` since 1.16. That is free-form input rather
 * than a value to enumerate, so it is accepted by the editor without appearing here.
 */
export const TEXT_COLORS: readonly string[] = [
  'black',
  'dark_blue',
  'dark_green',
  'dark_aqua',
  'dark_red',
  'dark_purple',
  'gold',
  'gray',
  'dark_gray',
  'blue',
  'green',
  'aqua',
  'red',
  'light_purple',
  'yellow',
  'white',
]
