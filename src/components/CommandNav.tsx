import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { CommandDefinition } from '../schema/types'
import { catalogueList } from '../data/catalogue'
import type { Catalogue } from './CommandRenderer'
import { FIELD, LABEL } from './editors/fieldStyles'

/**
 * The dialect groups, in the order they are drawn.
 *
 * Grouping by dialect rather than alphabetically across everything, because the
 * distinction is load-bearing rather than cosmetic: `embeddableIn` already filters by
 * it, since `/execute … run` hands its tail to the vanilla command dispatcher and a
 * WorldEdit command offered there produces something that reads fine and cannot run.
 * A list that mixed them would be the one place in the app implying otherwise.
 *
 * Labels rather than the raw dialect keys, and held here rather than in the schema:
 * "WorldEdit" is presentation, and `dialect` is data.
 */
const GROUPS: readonly { dialect: CommandDefinition['dialect']; label: string }[] = [
  { dialect: 'vanilla', label: 'Vanilla' },
  { dialect: 'worldedit', label: 'WorldEdit' },
]

/** Whether a definition matches a typed filter, by label or by any alias. */
function matches(definition: CommandDefinition, needle: string): boolean {
  if (needle === '') return true
  const lowered = needle.toLowerCase()
  if (definition.label.toLowerCase().includes(lowered)) return true
  // Aliases are how a good half of these are actually known — someone looking for the
  // teleport command types `tp`, and a filter that only read labels would tell them it
  // does not exist.
  return (definition.aliases ?? []).some((alias) => alias.toLowerCase().includes(lowered))
}

/**
 * Every command generator the build offers, as a filterable list.
 *
 * Read from `catalogueList()`, never from a hand-authored array. The page this
 * replaced held exactly such an array — eight entries, all of them tagged "Coming
 * soon" while eighty real definitions were already routable — which is the failure
 * mode a list of claims about the catalogue has and a list *of* the catalogue does not.
 *
 * A row is a `<Link>` rather than a button with a handler, so the browser's own
 * affordances work: middle-click, open in a new tab, and the address bar all keep
 * meaning something.
 */
export function CommandNav({
  catalogue,
  activeId,
}: {
  catalogue: Catalogue
  /** The command on screen, if any. Absent on the picker's own index route. */
  activeId?: string
}) {
  const [filter, setFilter] = useState('')
  const all = useMemo(() => catalogueList(catalogue), [catalogue])

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        commands: all.filter((c) => c.dialect === group.dialect && matches(c, filter)),
      })).filter((group) => group.commands.length > 0),
    [all, filter],
  )

  return (
    <nav
      aria-label="Commands"
      className="border-r-hairline border-border-subtle flex min-h-0 w-56 shrink-0 flex-col"
    >
      <div className="border-b-hairline border-border-subtle flex flex-col gap-1 p-2">
        <label className={LABEL} htmlFor="command-filter">
          {`${all.length} commands`}
        </label>
        <input
          id="command-filter"
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter"
          className={FIELD}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.length === 0 && (
          <p className="text-text-muted text-2xs p-2">{`nothing matches ${filter}`}</p>
        )}
        {groups.map((group) => (
          <section key={group.dialect}>
            <h2 className="border-b-hairline border-border-subtle bg-surface text-text-muted text-3xs sticky top-0 px-2 py-1 font-mono tracking-widest uppercase">
              {group.label}
            </h2>
            <ul>
              {group.commands.map((command) => (
                <li key={command.id}>
                  <Link
                    to="/c/$commandId"
                    params={{ commandId: command.id }}
                    aria-current={command.id === activeId ? 'page' : undefined}
                    className={
                      'border-b-hairline border-border-subtle hover:bg-hover text-1xs block px-2 py-1 font-mono ' +
                      (command.id === activeId ? 'text-accent' : 'text-text-secondary')
                    }
                  >
                    {command.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  )
}
