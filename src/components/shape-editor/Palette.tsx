import { useState } from 'react'
import {
  KIND_LABELS,
  MODIFIER_KINDS,
  SHAPE_KINDS,
  type Layer,
  type ModifierKind,
} from '../../worldedit/stack/layers'
import { group, modifier, reference, shape } from '../../worldedit/stack/make'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'
import { FOCUS } from '../editors/fieldStyles'
import { Glyph, type GlyphName } from './glyphs'
import { EYEBROW } from './styles'

/** What each modifier does, on its tooltip: the editor has no help text of its own. */
const TIPS: Readonly<Record<ModifierKind | 'half', string>> = {
  half: 'Cuts away everything below it on one side of a plane.',
  mirror: 'Reflects everything below it across a plane.',
  distort: 'Pushes everything below it into a wave, or twists it around the vertical axis.',
  array: 'Repeats everything below it in a straight line.',
  radial: 'Repeats everything below it in a circle around the vertical axis.',
  bend: 'Curves everything below it along a straight guide line.',
  taper: 'Narrows or widens everything below it from bottom to top.',
  revolve: 'Spins the front outline below it around the vertical axis, like a pottery wheel.',
}

const TILE =
  `border-hairline border-border-subtle bg-surface text-text-secondary hover:text-text-primary ` +
  `hover:border-accent hover:bg-accent/10 flex items-center justify-center rounded-md font-semibold ${FOCUS}`

interface Entry {
  key: string
  glyph: GlyphName
  label: string
  tip?: string
  make: () => Layer
  wide?: boolean
}

const SECTIONS: ReadonlyArray<{ title: string; entries: readonly Entry[] }> = [
  {
    title: 'Shapes',
    entries: SHAPE_KINDS.map((kind) => ({
      key: kind,
      glyph: kind,
      label: KIND_LABELS[kind],
      make: () => shape(kind),
    })),
  },
  {
    title: 'Modifiers',
    entries: [
      { key: 'half', glyph: 'half', label: 'Half', tip: TIPS.half, make: () => shape('half') },
      ...MODIFIER_KINDS.map((kind) => ({
        key: kind,
        glyph: kind,
        label: KIND_LABELS[kind],
        tip: TIPS[kind],
        make: () => modifier(kind),
      })),
    ],
  },
  {
    title: 'Tools',
    entries: [
      {
        key: 'reference',
        glyph: 'reference',
        label: 'Reference',
        make: () => reference(),
        wide: true,
      },
      { key: 'group', glyph: 'group', label: 'Group', make: () => group([]), wide: true },
    ],
  },
]

/** The palette: one click adds a layer where the list puts it. Each section folds away. */
export function Palette({ onAdd }: { onAdd: (layer: Layer) => void }) {
  const [shut, setShut] = useState<ReadonlySet<string>>(new Set())
  const toggle = (title: string) =>
    setShut((s) => {
      const next = new Set(s)
      if (!next.delete(title)) next.add(title)
      return next
    })

  return (
    <div className="border-b-hairline border-border-subtle flex flex-col gap-2.5 p-2.5">
      {SECTIONS.map(({ title, entries }) => {
        const open = !shut.has(title)
        return (
          <section key={title} className="flex flex-col gap-1.5">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(title)}
              className={`${EYEBROW} hover:text-text-secondary -ml-0.5 flex items-center gap-1 text-left ${FOCUS}`}
            >
              <Icon
                name="chevronDown"
                size="xs"
                className={`duration-fast transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
              />
              {title}
            </button>
            {open && (
              <div className="grid grid-cols-4 gap-1">
                {entries.map((entry) => {
                  const button = (
                    <button
                      type="button"
                      aria-label={`Add ${entry.label}`}
                      onClick={() => onAdd(entry.make())}
                      className={`${TILE} w-full ${entry.wide ? 'text-1xs gap-2 p-2' : 'text-2xs flex-col gap-1 px-0.5 pt-2 pb-1.5'}`}
                    >
                      <Glyph name={entry.glyph} size="lg" />
                      {entry.label}
                    </button>
                  )
                  return (
                    <div key={entry.key} className={entry.wide ? 'col-span-2 flex' : 'flex'}>
                      {entry.tip ? (
                        <Tooltip label={entry.tip} className="w-full">
                          {button}
                        </Tooltip>
                      ) : (
                        button
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
