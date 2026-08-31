/**
 * The window, for the one surface that has one.
 *
 * Wails injects its runtime into the webview as `window.runtime`, independently of any
 * Go bindings — which matters here, because `app.go` deliberately binds **no** methods
 * to the frontend: the JS↔Go surface is the HTTP API, so that the webview and the
 * `--serve` browser surface cannot drift apart. Window controls are the one thing that
 * cannot go through it. There is no window on the other side of an HTTP request, and a
 * `POST /api/window/minimise` would be an API call whose only correct implementation
 * on the browser surface is to fail.
 *
 * So this module reads `window.runtime` directly and needs no generated bindings, and
 * `app.go`'s rule survives intact: nothing here is an *application* method.
 *
 * **This asks a presentation question, and that is allowed.** `distribution.md` § One
 * install, two surfaces forbids answering "can this session link?" by presentation —
 * a user-agent sniff or a check for something the webview injects gets the local-webapp
 * surface wrong, which is why `storageKind()` probes for the backend instead. The
 * question here is the opposite kind: "is this app drawing its own window chrome?" is
 * *about* the presentation, and the browser surface is genuinely a different answer —
 * a tab has no window to minimise, and offering a control that cannot work is the
 * failure that rule exists to prevent. The two must not be confused: a standalone
 * session served to a browser saves and links exactly as the window does, and nothing
 * in this module is consulted about either.
 */

/** The subset of Wails' injected runtime this app uses. */
interface WailsRuntime {
  WindowMinimise: () => void
  WindowToggleMaximise: () => void
  WindowIsMaximised: () => Promise<boolean>
  Quit: () => void
}

function runtime(): WailsRuntime | undefined {
  return (window as { runtime?: WailsRuntime }).runtime
}

/**
 * Whether this surface draws its own window chrome.
 *
 * False on the hosted site and on the standalone build's `--serve` browser surface,
 * true in the Wails webview. Read once per render rather than cached in a module
 * variable: it is a property of the page, so there is no probe to save, and a cached
 * `false` captured before the runtime attached would be a startup race with no upside.
 */
export function hasWindowChrome(): boolean {
  return runtime() !== undefined
}

/**
 * Run a window command, tolerating there being no window.
 *
 * These hold no state to revert and write nothing, so with no runtime attached there
 * is nothing to report and nothing to retry — a browser tab has no window to minimise.
 * The controls that call these are not rendered without `hasWindowChrome()` anyway;
 * this is the belt to that's braces, and it keeps the jsdom tests honest.
 */
export function minimiseWindow(): void {
  runtime()?.WindowMinimise()
}

export function toggleMaximiseWindow(): void {
  runtime()?.WindowToggleMaximise()
}

/**
 * Quit, not a window close.
 *
 * Wails routes `Quit` through `OnBeforeClose`, which is where a shutdown hook would
 * live if this app grew one. Konnekt already relies on that to stop its scheduler and
 * its running server; this app has nothing to stop today, and using the same call
 * means it will not have to be found and changed on the day it does.
 */
export function quitWindow(): void {
  runtime()?.Quit()
}

/** Whether the window is maximised. `false` where there is no window to ask about. */
export async function windowIsMaximised(): Promise<boolean> {
  try {
    return (await runtime()?.WindowIsMaximised()) ?? false
  } catch {
    return false
  }
}
