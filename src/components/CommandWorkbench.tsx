import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { RegistryLookup, SerializeContext, VersionDefinition } from '../data/versions/types'
import { CommandRenderer, type Catalogue } from './CommandRenderer'
import { embeddableIn } from '../data/catalogue'
import { evaluateConstraints } from '../schema/constraints'
import { EMPTY_VALUE, serializeWithReport } from '../schema/serialize'
import type { CommandDefinition } from '../schema/types'
import { previewInputsKey, readPreviewInputs } from '../previews/inputs'
import { previewModule } from '../previews/registry'
import { useCommandStore } from '../stores/useCommandStore'
import { canRedo, canUndo } from '../stores/commandHistory'
import { PreviewCanvas } from './PreviewCanvas'
import { OutputPanel } from './OutputPanel'

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
  actions,
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
  /**
   * Rendered inside the output panel, given the serialized command.
   *
   * A render prop rather than a `<SaveCommandBar>` imported here, for two reasons.
   * This component is the one that already holds the serialized string, and a caller
   * that wanted it would have to call `serializeCommand` a second time on the same
   * tree, the expensive call in this render. And knowing about saving
   * would give the workbench a dependency on persistence that nothing about editing
   * needs; a fixture test renders it today with no store at all.
   */
  actions?: (output: string) => ReactNode
}) {
  const stored = useCommandStore((s) => s.value)
  const setArg = useCommandStore((s) => s.setArg)
  const setFlag = useCommandStore((s) => s.setFlag)
  const setChoice = useCommandStore((s) => s.setChoice)
  const addInstance = useCommandStore((s) => s.addInstance)
  const reorderRepeat = useCommandStore((s) => s.reorderRepeat)
  const setRef = useCommandStore((s) => s.setRef)
  const reset = useCommandStore((s) => s.reset)
  const undo = useCommandStore((s) => s.undo)
  const redo = useCommandStore((s) => s.redo)
  const history = useCommandStore((s) => s.history)

  /**
   * Undo and redo from the keyboard, unconditionally.
   *
   * Deliberately not skipped while a text field has focus, which is the usual
   * compromise and the wrong one here. Every editor in this app is a controlled input
   * over the value tree, so the browser's own undo stack for one of them is already
   * out of step with what is on screen - React rewrites the value on each render and
   * the native stack does not hear about it. Leaving `Ctrl+Z` to the browser inside a
   * field would mean undo did something different depending on where the caret was.
   *
   * What makes taking it over feel native rather than blunt is the coalescing in
   * `commandHistory.ts`: a burst of typing in one field is one step, so undo inside a
   * field undoes what was typed there, which is what the browser would have done.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

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

  // Memoised on the tree, which the store replaces on every edit and on nothing else,
  // so a render for any other reason (a hover, a popover opening) does not walk the
  // command again.
  const report = useMemo(
    () => serializeWithReport(definition, value, ctx, { resolve }),
    [definition, value, ctx, resolve],
  )
  const warnings = useMemo(
    () => evaluateConstraints(definition, value).map((w) => w.message),
    [definition, value],
  )

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
      {/*
        The output first, above the form that produces it, and pinned there: the
        command is the product and the editors are how you reach it. Still ahead of
        the preview, as `.claude/rules/previews.md` requires.
      */}
      <OutputPanel
        text={report.text}
        segments={report.segments}
        versionId={version.id}
        warnings={warnings}
        history={{ undo, redo, canUndo: canUndo(history), canRedo: canRedo(history) }}
        actions={actions?.(report.text)}
      />

      <CommandRenderer
        definition={definition}
        value={value}
        ctx={ctx}
        actions={{ setArg, setFlag, setChoice, addInstance, reorderRepeat, setRef }}
        catalogue={embeddable}
        forced={report.forced}
      />

      {/* Last, and a sibling of the output panel rather than a wrapper around it. The
          preview is an aid and the command is the product, so nothing above can be
          taken down by a preview that fails to load. */}
      {module !== undefined && (
        <PreviewCanvas module={module} values={previewValues} registry={registries} />
      )}
    </div>
  )
}
