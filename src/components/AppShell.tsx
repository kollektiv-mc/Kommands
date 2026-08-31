import { useState, type ReactNode } from 'react'
import { TitleBar } from './TitleBar'
import { SettingsDialog, chooseTheme, initialTheme } from './SettingsDialog'

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

  return (
    <div className="bg-canvas text-text-primary flex h-full flex-col">
      <TitleBar onOpenSettings={() => setSettingsOpen(true)} />
      <main className="min-h-0 flex-1">{children}</main>
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
    </div>
  )
}
