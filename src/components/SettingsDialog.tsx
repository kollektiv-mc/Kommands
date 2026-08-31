import { useEffect } from 'react'
import { applyTheme, type Theme } from '../lib/theme'
import { probedBackend } from '../storage/probe'
import { storageKind } from '../stores/useSavedCommandsStore'
import { readTheme, writeTheme } from '../storage/preferences'
import { IconButton } from './ui/IconButton'
import { Icon } from './ui/Icon'
import { LABEL } from './editors/fieldStyles'

/** A row of label and value, which is the whole vocabulary of this dialog. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-6 items-center gap-3">
      <span className={`${LABEL} w-24 shrink-0`}>{label}</span>
      {children}
    </div>
  )
}

/**
 * The settings the app actually has.
 *
 * Two sections and no more, which is the point of the file rather than a stage it is
 * passing through. The title bar this opens from matches Konnekt's, and Konnekt's
 * carries a gear; a gear that opens nothing is worse than no gear, and a gear that
 * opens a page of invented preferences is worse than either. So both rows below are
 * backed by code that already existed before this dialog did:
 *
 * - **Theme** — `tokens.css` has defined `[data-theme='light']` since the token
 *   pipeline landed and nothing has ever set it. This is the switch that was missing,
 *   not a feature being added to the token layer.
 * - **Build** — `probeLocalBackend()` already answers all three of these at startup,
 *   for the dashboard's benefit. `distribution.md` § The split must be visible asks
 *   for the difference between the builds to be stated rather than discovered; the
 *   dashboard states the consequence ("linking needs the standalone build") and this
 *   states the cause.
 *
 * A `<dialog>`-shaped panel rather than the real element: the app draws its own
 * chrome, `showModal()` renders into the top layer where `[data-theme]` on `<html>`
 * still reaches it but the app's own stacking does not, and the overlay pattern this
 * app already uses for the editor is the one to be consistent with.
 */
export function SettingsDialog({
  theme,
  onTheme,
  onClose,
}: {
  theme: Theme
  onTheme: (theme: Theme) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const backend = probedBackend()

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="bg-overlay/70 fixed inset-0 z-50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="border-hairline border-border-subtle bg-canvas rounded-panel fixed top-1/2 left-1/2 z-50 flex w-80 -translate-x-1/2 -translate-y-1/2 flex-col bg-[linear-gradient(var(--bg-surface),var(--bg-surface))]"
      >
        <div className="border-b-hairline border-border-subtle flex items-center gap-2 px-3 py-2">
          <span className="font-title text-text-secondary text-1xs">Settings</span>
          <span className="flex-1" />
          <IconButton onClick={onClose} title="Close settings">
            <Icon name="close" size="sm" />
          </IconButton>
        </div>

        <div className="flex flex-col gap-3 p-3">
          <section className="flex flex-col gap-1.5">
            <h2 className="text-text-muted text-3xs font-mono tracking-widest uppercase">
              Appearance
            </h2>
            <Row label="Theme">
              {/*
                A radiogroup, not two buttons: these are one setting with two values,
                and a screen reader reading them as two independent toggles would let
                someone press "off" on both.
              */}
              <div role="radiogroup" aria-label="Theme" className="flex gap-1">
                {(['dark', 'light'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={theme === option}
                    onClick={() => onTheme(option)}
                    className={
                      'border-hairline text-1xs rounded-md px-2 py-1 font-mono ' +
                      (theme === option
                        ? 'border-accent text-accent bg-accent/10'
                        : 'border-border-subtle text-text-secondary hover:border-border-hover')
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </Row>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="text-text-muted text-3xs font-mono tracking-widest uppercase">Build</h2>
            {/*
              Named by what it *is* rather than by what it can do. "Standalone" and
              "Web" are the two builds distribution.md names; the dashboard already
              says what follows from being one rather than the other.
            */}
            <Row label="Surface">
              <span className="text-text-primary text-1xs font-mono">
                {storageKind() === 'file' ? 'Standalone' : 'Web'}
              </span>
            </Row>
            {backend && (
              <>
                <Row label="Shell">
                  <span className="text-text-primary text-1xs font-mono">
                    {backend.shellVersion}
                  </span>
                </Row>
                <Row label="Konnekt">
                  <span className="text-text-primary text-1xs font-mono">
                    {backend.konnektPresent ? 'detected' : 'not installed'}
                  </span>
                </Row>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

/**
 * The theme to open with: what was chosen last, else dark.
 *
 * Not the OS preference. `prefers-color-scheme` would be the right default for a site
 * with no opinion, and this app has one — it is dark-first by design language, and its
 * light theme is the alternative rather than the peer. Reading the OS here would put
 * half of all first-time visitors in the mode the design was not drawn for.
 */
export function initialTheme(): Theme {
  return readTheme() ?? 'dark'
}

/** Set the theme and remember it. The pair is always done together; this is the pair. */
export function chooseTheme(theme: Theme): void {
  applyTheme(theme)
  writeTheme(theme)
}
