const FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** The day a command was last saved, as "21 Oct 2026". Empty for a timestamp that is not one. */
export function savedOn(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : FORMAT.format(date)
}
