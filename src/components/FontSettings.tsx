import { useEffect, useId, useState } from 'react'
import {
  FONT_ROLES,
  applyFonts,
  browserCanListFonts,
  browserFamilies,
  shellFamilies,
  type FontChoice,
  type FontRole,
} from '../lib/fonts'
import { readFonts, writeFonts } from '../storage/preferences'
import { FIELD, LABEL } from './editors/fieldStyles'

const ROLE_LABELS: Record<FontRole, string> = {
  sans: 'Body',
  title: 'Titles',
  display: 'Wordmark',
  mono: 'Code',
}

/**
 * Where the installed-font list stands: loading it, asking the browser for it, have
 * it, or no way to get one.
 */
type ListState = 'loading' | 'ask-browser' | 'listed' | 'typed-only'

/**
 * One text field per `--font-*` token, each suggesting the installed families.
 *
 * A field that takes any name, with the installed list as suggestions, rather than a
 * select limited to the list. The list is unavailable on most browsers, can be
 * refused on the one that has it, and cannot see every font a machine renders; a
 * select would make those cases unable to choose anything. An empty field is the
 * default, so there is nothing separate to reset.
 */
export function FontSettings() {
  const [choice, setChoice] = useState<FontChoice>(readFonts)
  const [families, setFamilies] = useState<string[]>([])
  const [list, setList] = useState<ListState>('loading')
  const listId = useId()

  useEffect(() => {
    let live = true
    void shellFamilies().then((fromShell) => {
      if (!live) return
      if (fromShell) {
        setFamilies(fromShell)
        setList('listed')
      } else {
        setList(browserCanListFonts() ? 'ask-browser' : 'typed-only')
      }
    })
    return () => {
      live = false
    }
  }, [])

  const choose = (role: FontRole, family: string) => {
    const next = { ...choice }
    if (family.trim() === '') delete next[role]
    else next[role] = family
    setChoice(next)
    applyFonts(next)
    writeFonts(next)
  }

  const askBrowser = async () => {
    setFamilies(await browserFamilies())
    setList('listed')
  }

  return (
    <>
      {FONT_ROLES.map((role) => (
        <label key={role} className="flex min-h-6 items-center gap-3">
          <span className={`${LABEL} w-24 shrink-0`}>{ROLE_LABELS[role]}</span>
          <input
            className={`${FIELD} min-w-0 flex-1`}
            list={listId}
            placeholder="Default"
            spellCheck={false}
            value={choice[role] ?? ''}
            onChange={(event) => choose(role, event.target.value)}
          />
        </label>
      ))}
      <datalist id={listId}>
        {families.map((family) => (
          <option key={family} value={family} />
        ))}
      </datalist>
      {list === 'ask-browser' && (
        <button
          type="button"
          onClick={() => void askBrowser()}
          className="border-hairline border-border-subtle text-text-secondary hover:border-border-hover text-1xs self-start rounded-md px-2 py-1 font-mono"
        >
          List installed fonts
        </button>
      )}
      {list === 'typed-only' && (
        <p className={LABEL}>This browser cannot list fonts. Type the name of an installed one.</p>
      )}
    </>
  )
}
