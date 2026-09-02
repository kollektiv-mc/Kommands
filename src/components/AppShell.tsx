import { useState, type ReactNode } from 'react'
import { TitleBar } from './TitleBar'
import { SettingsDialog, chooseTheme, initialTheme } from './SettingsDialog'
import { hasWindowChrome } from '../lib/window'

interface AppShellProps {
  /** Route content. The shell owns the frame; routes own everything inside it. */
  children: ReactNode
}

/**
 * The application frame: the title bar over a content well.
 *
 * The well no longer scrolls or pads. It did both when every route was one column of
 * content, and both became wrong once the editor arrived: that route is two panes
 * that scroll independently, and a scrolling ancestor would give it a second scrollbar
 * outside the pane the user is reading. Padding moved the same way — a full-height
 * two-pane layout wants its divider to reach the frame. Routes that do want a padded,
 * scrolling column now say so, which is one line each and honest about which layout
 * they are.
 *
 * The header became `TitleBar`, which on the desktop build *is* the window's title bar
 * (`Frameless: true` in main.go). The shell owns the theme state that its gear opens,
 * because the shell is the only thing mounted on every route and a dialog owned by a
 * route would close itself on navigation.
 *
 * This component is deliberately styled with nothing but semantic utilities backed
 * by the generated token layer — no literal hex, no arbitrary pixel value, no inline
 * style. docs/design-tokens.md names that as the goal of the token pipeline, and
 * .claude/suite.json's `no literal hex or px in components` invariant greps this
 * directory for violations.
 */
export function AppShell({ children }: AppShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Seeded from storage rather than from the DOM. `main.tsx` has already applied this
  // same value before the first paint, so the two agree without this having to read
  // back a custom property it just wrote.
  const [theme, setTheme] = useState(initialTheme)
  // Read once, for the same reason `TitleBar` reads it once: it is fixed for the life
  // of the page. Not at module scope, where the read could land before Wails attaches.
  const [chrome] = useState(hasWindowChrome)

  const shell = (
    <div className="bg-canvas text-text-primary flex h-full flex-col">
      <TitleBar onOpenSettings={() => setSettingsOpen(true)} />
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  )

  return (
    <>
      {chrome ? shell : <FloatingFrame>{shell}</FloatingFrame>}
      {settingsOpen && (
        <SettingsDialog
          theme={theme}
          onTheme={(next) => {
            setTheme(next)
            chooseTheme(next)
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  )
}

/**
 * The app as a panel on a page, for every surface that is not the desktop window.
 *
 * The hosted site and the standalone build's `--serve` browser surface both get this;
 * the Wails webview does not, because there the operating system already draws the
 * gutter and a second one inside it would be a border around a border.
 *
 * **This is a presentation question, and `hasWindowChrome()` is the right thing to ask
 * it of.** `distribution.md` § One install, two surfaces forbids answering "can this
 * session link?" by presentation — that has to probe the backend through
 * `storageKind()`, or the `--serve` surface gets the wrong answer. "Is the operating
 * system already framing this?" is the opposite kind of question, and `lib/window.ts`
 * says so in as many words. The two must not be confused: a `--serve` session floats
 * in a page here *and* saves and links exactly as the window does.
 *
 * Why it earns the change: full-bleed is a claim that the app owns the display, which
 * is true of a window and false of a tab. On a wide monitor the dashboard's six-column
 * grid stretched a three-tile row across 2560px of screen, and the title bar's
 * wordmark and the browser's own chrome sat flush against each other with nothing
 * between them.
 *
 * The ground is `bg-overlay` and the panel keeps `bg-canvas`, rather than the other way
 * round. Every translucent surface in this app — `bg-surface` on a tile, on a panel
 * header, on the editor — is authored to composite over `--bg-base`, so recolouring
 * the app's own base on one surface would change how every one of them lands. That
 * leaves the ground as the thing that moves, and it moves in opposite directions per
 * theme (lighter than base in dark, darker in light) because those are the only two
 * neutrals the token set has beside it. Separation still reads, because in this design
 * language elevation is a surface plus a hairline and never a shadow —
 * `.claude/rules/styling.md` § There are no shadows.
 *
 * Full height minus the gutter, deliberately, rather than a fixed maximum height. A
 * capped panel leaves dead ground under it on a tall display and makes the dashboard
 * scroll inside a short box while the page around it has room to spare.
 */
function FloatingFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-overlay h-full p-2 sm:p-4">
      {/*
        `max-w-6xl` is 1152px, which is the standalone window's 1100px default rounded
        to the nearest step on Tailwind's own scale — the point being that the two
        surfaces are the same product at the same size, not that either number is
        special. `overflow-hidden` is what makes the radius clip the title bar, whose
        own background would otherwise square off the top two corners.
      */}
      <div className="border-hairline border-border-subtle rounded-panel mx-auto h-full max-w-6xl overflow-hidden">
        {children}
      </div>
    </div>
  )
}
