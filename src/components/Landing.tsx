import { useRef } from 'react'

/**
 * The tools the landing page advertises.
 *
 * Presentation copy, not command data — which is why it is a local list rather than
 * something read from the catalogue. Every entry is unavailable, so this is a list of
 * claims about the future, and the catalogue cannot supply it: `loadCatalogue` already
 * returns 80-odd real, routable definitions, and rendering those here would either
 * misreport working commands as unavailable or turn this placeholder into the browse
 * view it is standing in for.
 *
 * When the real browse view lands it should read `catalogueList()` instead, and this
 * const should go with the page that replaced it.
 */
const TOOLS = [
  { name: '/give', blurb: 'Items, components, enchantments' },
  { name: '/tellraw', blurb: 'Text components' },
  { name: '/execute', blurb: 'Clause chains' },
  { name: '/summon', blurb: 'Entities and their data' },
  { name: 'Selectors', blurb: 'Target selector builder' },
  { name: '//generate', blurb: 'WorldEdit shape expressions' },
  { name: '//brush', blurb: 'WorldEdit patterns and masks' },
  { name: 'All commands', blurb: 'The full 1.21.1 vanilla set' },
]

/**
 * The landing page: one title, one button, one fullscreen view of the tools.
 *
 * A placeholder standing in front of a working app — `/c/$commandId` still renders the
 * real workbench, and is still reachable by URL. This page deliberately does not link
 * to it: every tile is marked unavailable, so linking some of them would make the tags
 * on the rest read as an oversight rather than a statement.
 *
 * It lives here rather than inline in the route because it holds a ref, and a route
 * file that both defines a component and exports its route object trips
 * react-refresh/only-export-components. root.tsx and command.tsx keep their components
 * inline for that same reason; neither of them needs a hook.
 *
 * Styled with nothing but semantic utilities backed by the generated token layer — no
 * literal hex, no arbitrary pixel value, no inline style. See docs/design-tokens.md.
 */
export function Landing() {
  const tools = useRef<HTMLDialogElement>(null)

  return (
    <>
      <section className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <h1 className="font-display text-text-primary text-6xl tracking-tight sm:text-7xl">
          Kommands
        </h1>
        <button
          type="button"
          onClick={() => tools.current?.showModal()}
          className="bg-accent text-canvas border-hairline border-accent rounded-md px-5 py-2.5 font-mono text-xs font-semibold"
        >
          Browse tools
        </button>
      </section>

      {/*
        A real <dialog> opened with showModal(), not a div behind an `open` flag:
        focus trapping, Escape-to-close and the inert background come from the
        platform. The UA default is a centred box with its own max-width, max-height
        and auto margin, so all three are reset before it will fill the viewport.
      */}
      <dialog
        ref={tools}
        aria-labelledby="tools-title"
        className="bg-canvas text-text-primary backdrop:bg-canvas m-0 h-full max-h-none w-full max-w-none overflow-y-auto border-0 p-0"
      >
        <div className="border-b-hairline border-border-subtle bg-elevated sticky top-0 flex items-center justify-between gap-4 px-4 py-3">
          <h2 id="tools-title" className="text-text-secondary text-1xs font-mono tracking-widest">
            TOOLS
          </h2>
          <button
            type="button"
            onClick={() => tools.current?.close()}
            aria-label="Close"
            className="border-hairline border-border-subtle bg-hover text-text-secondary hover:border-border-hover hover:text-text-primary rounded-md px-2 py-1 font-mono text-xs"
          >
            ✕
          </button>
        </div>

        {/*
          No tile is a link or a button. Nothing here is available, and a control that
          looks pressable and does nothing is worse than a card that never claimed to
          be one. A tool ships as an <a> that drops its tag.
        */}
        <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TOOLS.map((tool) => (
            <li
              key={tool.name}
              className="border-hairline border-border-subtle bg-surface rounded-panel flex flex-col items-start gap-1.5 p-4"
            >
              <h3 className="text-text-primary font-mono text-sm font-semibold">{tool.name}</h3>
              <p className="text-text-secondary text-1xs">{tool.blurb}</p>
              <span className="border-hairline border-border-hover text-warning text-3xs mt-auto rounded-sm px-1.5 py-1 font-mono tracking-widest uppercase">
                Coming soon
              </span>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  )
}
