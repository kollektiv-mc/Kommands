import { useEffect, useMemo, useState } from 'react'
import type { RegistryLookup, SerializeContext, VersionDefinition } from '../data/versions/types'
import { CommandRenderer, type Catalogue } from './CommandRenderer'
import { embeddableIn } from '../data/catalogue'
import { evaluateConstraints } from '../schema/constraints'
import { EMPTY_VALUE, serializeCommand } from '../schema/serialize'
import type { CommandDefinition } from '../schema/types'
import { previewInputsKey, readPreviewInputs } from '../previews/inputs'
import { previewModule } from '../previews/registry'
import { useCommandStore } from '../stores/useCommandStore'
import { PreviewCanvas } from './PreviewCanvas'
import { LABEL, WARNING } from './editors/fieldStyles'
import { ROW_ADD } from './editors/rowStyles'

/**
 * A definition, its editors, and the command they produce.
 *
 * Like the renderer it knows nothing about which command it is showing. It exists so
 * the two halves — editing and output — share one value tree and re-render together.
 */
export function CommandWorkbench({
  definition,
  version,
  registries,
  catalogue = {},
}: {
  definition: CommandDefinition
  version: VersionDefinition
  /** The target version's registries. Loaded by the route, so the chunk stays lazy. */
  registries: RegistryLookup
  /**
   * Every command a `@any` Ref may embed.
   *
   * Supplied by the route, which has already loaded the whole map to find this
   * definition in it. Without it `/execute … run` has nothing to offer and nothing to
   * serialize, which is what made it emit a dangling `run` in the app while passing
   * its tests — the tests passed a resolver and the app did not.
   */
  catalogue?: Catalogue
}) {
  const stored = useCommandStore((s) => s.value)
  const setArg = useCommandStore((s) => s.setArg)
  const setFlag = useCommandStore((s) => s.setFlag)
  const setChoice = useCommandStore((s) => s.setChoice)
  const setRepeat = useCommandStore((s) => s.setRepeat)
  const reorderRepeat = useCommandStore((s) => s.reorderRepeat)
  const setRef = useCommandStore((s) => s.setRef)
  const reset = useCommandStore((s) => s.reset)

  /**
   * Which definition the stored value belongs to.
   *
   * Values are keyed by path, and a path means nothing outside the definition it was
   * built against — `/2` is an item in one command and a block position in the next.
   * Clearing in an effect alone would leave one render showing the previous command's
   * values under this one's labels, so the guard is read during render and the effect
   * only catches the store up.
   */
  const [shownFor, setShownFor] = useState(definition.id)
  useEffect(() => {
    if (shownFor === definition.id) return
    reset()
    setShownFor(definition.id)
  }, [definition.id, shownFor, reset])
  const value = shownFor === definition.id ? stored : EMPTY_VALUE

  const ctx: SerializeContext = useMemo(
    () => ({ traits: version.traits, registries }),
    [version, registries],
  )

  // What this command may embed, rather than everything that exists. Filtered here so
  // the picker and the serializer read the same set and cannot disagree.
  const embeddable = useMemo(() => embeddableIn(catalogue, definition), [catalogue, definition])
  const resolve = useMemo(() => (id: string) => embeddable[id], [embeddable])

  const output = serializeCommand(definition, value, ctx, { resolve })
  const warnings = evaluateConstraints(definition, value)

  /**
   * The preview's inputs, and nothing else.
   *
   * `readPreviewInputs` runs every render — it reads a handful of paths, which is
   * cheaper than deciding whether to — but its *result* is memoised on a key built from
   * the declared inputs alone. So typing in an argument the module never declared
   * leaves `values` referentially identical and the module does not recompute, which is
   * what docs/health-checklist.md § 4 asks for.
   */
  const binding = definition.preview
  const module = binding === undefined ? undefined : previewModule(binding.module)
  const inputs = binding === undefined ? {} : readPreviewInputs(definition, binding, value)
  const inputsKey = previewInputsKey(inputs)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the key *is* the dependency
  const previewValues = useMemo(() => inputs, [inputsKey])

  return (
    <div className="flex flex-col gap-3">
      <CommandRenderer
        definition={definition}
        value={value}
        ctx={ctx}
        actions={{ setArg, setFlag, setChoice, setRepeat, reorderRepeat, setRef }}
        catalogue={embeddable}
      />

      <div className="border-hairline border-border-subtle bg-elevated rounded-panel flex flex-col gap-1 p-2">
        <div className="flex items-center gap-2">
          <span className={LABEL}>{`Output · ${version.id}`}</span>
          <CopyButton text={output} />
        </div>
        <code className="text-text-primary text-1xs font-mono break-all">
          {output || <span className="text-text-faint">nothing yet</span>}
        </code>
        {warnings.map((w, i) => (
          <span key={i} className={WARNING}>
            {w.message}
          </span>
        ))}
      </div>

      {/* Last, and a sibling of the output panel rather than a wrapper around it. The
          preview is an aid and the command is the product, so nothing above can be
          taken down by a preview that fails to load. */}
      {module !== undefined && (
        <PreviewCanvas module={module} values={previewValues} registry={registries} />
      )}
    </div>
  )
}

/**
 * Copy the generated command.
 *
 * The whole product is a string the user pastes somewhere else, so this is the last
 * step of every session. The clipboard API rejects when the document is not focused
 * or permission is refused; the button says so rather than silently reporting success.
 */
function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => setState('idle'), [text])

  if (text === '') return null

  return (
    <button
      type="button"
      className={ROW_ADD}
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => setState('copied'),
          () => setState('failed'),
        )
      }}
    >
      {state === 'copied' ? 'copied' : state === 'failed' ? 'could not copy' : 'copy'}
    </button>
  )
}
