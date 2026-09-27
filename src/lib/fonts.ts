/**
 * Per-person font overrides, and where the list of installed fonts comes from.
 *
 * The default look is the token stacks as generated: the suite's named faces first,
 * then the system faces. This repo ships no font files (docs/design-tokens.md § The
 * three faces), so on most machines the default *is* the system faces. A chosen
 * family is written in front of its token's own stack on `<html>`, the same inline
 * override `lib/theme.ts` uses for the accent, so a name that turns out not to be
 * installed falls through to exactly what the person saw before choosing it.
 */
import { probedBackend } from '../storage/probe'

/** The `--font-*` tokens a person can override, in the order the dialog lists them. */
export const FONT_ROLES = ['sans', 'title', 'display', 'mono'] as const
export type FontRole = (typeof FONT_ROLES)[number]

/** A family per role. An absent role keeps the token's default stack. */
export type FontChoice = Partial<Record<FontRole, string>>

/**
 * A family name as a CSS string. Quoted always, because an unquoted family has to be a
 * sequence of identifiers, and names like "Source Code Pro 2" or "Font-Awesome 6" are not.
 */
export function quoteFamily(name: string): string {
  return `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Apply a choice to the root element.
 *
 * Every role is cleared first and then rebuilt, rather than patched: the default
 * stack is read back from the stylesheet, which is only possible while no inline
 * override is standing in front of it. `sans` goes first, so a `title` or `display`
 * default that falls back to `var(--font-sans)` already carries the chosen body face.
 */
export function applyFonts(choice: FontChoice, root: HTMLElement = document.documentElement): void {
  for (const role of FONT_ROLES) root.style.removeProperty(`--font-${role}`)
  for (const role of FONT_ROLES) {
    const family = choice[role]?.trim()
    if (!family) continue
    const property = `--font-${role}`
    const stack = getComputedStyle(root).getPropertyValue(property).trim()
    root.style.setProperty(
      property,
      stack ? `${quoteFamily(family)}, ${stack}` : quoteFamily(family),
    )
  }
}

/**
 * The installed families the local shell reports, or null when there is no shell.
 *
 * Null rather than an empty list, because the two mean different things to the
 * dialog: empty is "this machine has none we could read", null is "ask the browser".
 */
export async function shellFamilies(): Promise<string[] | null> {
  if (!probedBackend()) return null
  try {
    const response = await fetch('/api/fonts')
    if (!response.ok) return []
    const body: unknown = await response.json()
    const families = (body as { families?: unknown }).families
    return Array.isArray(families)
      ? families.filter((name): name is string => typeof name === 'string')
      : []
  } catch {
    return []
  }
}

interface LocalFontData {
  family: string
}

type QueryLocalFonts = () => Promise<LocalFontData[]>

function queryLocalFonts(): QueryLocalFonts | null {
  const query = (window as Window & { queryLocalFonts?: unknown }).queryLocalFonts
  return typeof query === 'function' ? (query.bind(window) as QueryLocalFonts) : null
}

/**
 * Whether the browser can list installed fonts itself. Chromium 103 and later only:
 * Firefox, Safari and the WebKit webviews do not implement the Local Font Access API.
 */
export function browserCanListFonts(): boolean {
  return queryLocalFonts() !== null
}

/**
 * The installed families as the browser reports them.
 *
 * Must be called from a user gesture: the browser asks for permission, and refuses
 * without one. A refusal is an empty list, not an error, because the dialog still
 * takes a typed name.
 */
export async function browserFamilies(): Promise<string[]> {
  const query = queryLocalFonts()
  if (!query) return []
  try {
    const fonts = await query()
    return [...new Set(fonts.map((font) => font.family))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    )
  } catch {
    return []
  }
}
