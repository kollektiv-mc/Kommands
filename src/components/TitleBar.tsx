import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  hasWindowChrome,
  minimiseWindow,
  quitWindow,
  toggleMaximiseWindow,
  windowIsMaximised,
} from '../lib/window'
import { IconButton } from './ui/IconButton'
import { Icon } from './ui/Icon'

/**
 * The app's own title bar: the wordmark, the settings gear, and — in the desktop
 * window — the window controls.
 *
 * It replaces a header that carried the product name beside the string "Java Edition
 * 1.21.1". That line was a claim the app makes everywhere else and better: every
 * command page serialises for the target version, and a version stated once in chrome
 * is the copy that goes stale the day a second version lands.
 *
 * Modelled on Konnekt's `TitleBar` deliberately and closely, because the two products
 * are one suite and a user who has both should not have to learn two window bars.
 * Same order (wordmark, gear, divider, minimise, maximise, close), same `h-9`, same
 * `danger` tone on the only irreversible control, same hairline separating the app's
 * control from the window's. What differs is written down where it differs.
 *
 * The height is Konnekt's for a reason worth repeating rather than looking up: the
 * runtime arms a 6px resize border along the top of the webview and checks it before
 * anything else, so any part of a control inside that band presses the window edge
 * instead of the control. A 24px button centred in a 36px bar starts at 6px. That is
 * the reason to add height here rather than remove it if this bar is ever restyled.
 */
export function TitleBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  // Read once per mount rather than per render: whether this surface has a window is
  // fixed for the life of the page, and re-asking on every paint would suggest
  // otherwise. Not module-level, because a module read could land before Wails
  // attaches its runtime.
  const [chrome] = useState(hasWindowChrome)
  const [maximised, setMaximised] = useState(false)

  // No Wails event reports a change of window state, so the DOM's own resize event
  // stands in: maximising, restoring, snapping to an edge and unsnapping all resize
  // the webview, and nothing that leaves its size alone changes the answer.
  // Trailing-debounced because dragging a window edge fires this continuously and each
  // sync is an IPC round trip. Konnekt's bar solves it the same way, for the same
  // absent event.
  useEffect(() => {
    if (!chrome) return
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const sync = () => {
      void windowIsMaximised().then((value) => {
        if (live) setMaximised(value)
      })
    }
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(sync, 120)
    }
    sync()
    window.addEventListener('resize', onResize)
    return () => {
      live = false
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [chrome])

  const toggleMaximise = useCallback(() => {
    // Flip the glyph now rather than waiting on the debounced round trip: it is this
    // control's own state, and 120ms of the old icon reads as a dropped click. The
    // listener corrects it if the window disagreed.
    setMaximised((was) => !was)
    toggleMaximiseWindow()
  }, [])

  return (
    <header className="titlebar-drag border-b-hairline border-border-subtle bg-surface flex h-9 shrink-0 items-center">
      {/*
        The drag half, and the only place the wordmark can be. `flex-1` so the empty
        space beside it drags too, and so double-click-to-maximise — which no runtime
        gives for free — covers that space without also firing when a double-click
        lands on a button. The buttons sit outside this element rather than inside it,
        which is cheaper than stopping propagation on each one.

        Still a `<Link>`, not a label. The editor covers the whole viewport and the
        dashboard is the only way back to what has been saved, so the product name has
        to be the way there — it is where everyone reaches for it anyway.
      */}
      <div
        onDoubleClick={chrome ? toggleMaximise : undefined}
        className="flex h-full min-w-0 flex-1 items-center pl-3"
      >
        <Link
          to="/"
          className="titlebar-no-drag text-accent font-display text-sm font-black tracking-tight"
        >
          Kommands
        </Link>
      </div>

      <div className="flex h-full items-center gap-0.5 pr-2">
        <IconButton className="titlebar-no-drag" onClick={onOpenSettings} title="Settings">
          <Icon name="settings" />
        </IconButton>
        {chrome && (
          <>
            {/*
              One hairline between the app's control and the window's. The close button
              is the only irreversible thing in this bar, and grouping by gap alone
              leaves it four pixels from a gear that opens a dialog.
            */}
            <div className="border-l-hairline border-border-subtle mx-1 h-4" />
            <IconButton
              className="titlebar-no-drag"
              onClick={minimiseWindow}
              title="Minimize window"
            >
              <Icon name="minus" size="sm" />
            </IconButton>
            <IconButton
              className="titlebar-no-drag"
              onClick={toggleMaximise}
              title={maximised ? 'Restore window' : 'Maximize window'}
            >
              <Icon name={maximised ? 'restore' : 'square'} size="sm" />
            </IconButton>
            <IconButton
              className="titlebar-no-drag"
              tone="danger"
              onClick={quitWindow}
              title="Close window"
            >
              <Icon name="close" size="sm" />
            </IconButton>
          </>
        )}
      </div>
    </header>
  )
}
