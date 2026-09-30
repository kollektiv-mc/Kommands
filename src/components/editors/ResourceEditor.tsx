import type { EditorProps } from '../../schema/types'
import { registryOf } from '../../schema/resource-location'
import { RegistryPicker } from './RegistryPicker'
import { TextEditor } from './TextEditor'

/**
 * Backs `resource_location`: an id, completed from its registry when the skeleton
 * names one (`/effect`'s effect, `/locate`'s biome), and a plain field when it does not
 * (a function, an advancement, a loot table), where there is nothing to offer.
 */
export function ResourceEditor(props: EditorProps<string>) {
  const { id, describedBy, value, onChange, options, diagnostics, ctx } = props
  const registry = registryOf(options)
  const entries = registry === undefined ? [] : ctx.registries.entries(registry)
  if (entries.length === 0) return <TextEditor {...props} />
  return (
    <div className="w-full max-w-md">
      <RegistryPicker
        id={id}
        describedBy={describedBy}
        value={value}
        onChange={onChange}
        entries={entries}
        ariaLabel={registry ?? ''}
        invalid={diagnostics.length > 0}
      />
    </div>
  )
}
