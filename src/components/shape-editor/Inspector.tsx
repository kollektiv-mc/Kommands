import { useState, type ReactNode } from 'react'
import { TEMPLATES } from '../../data/authored/generate'
import { useShapeEditorStore } from '../../stores/useShapeEditorStore'
import { find, idleLayers } from '../../worldedit/stack/edit'
import {
  KIND_LABELS,
  type AxisName,
  type Layer,
  type ModifierLayer,
  type Op,
  type ReferenceLayer,
  type ShapeLayer,
  type Vec3,
} from '../../worldedit/stack/layers'
import { pivotAxes } from '../../worldedit/stack/lower'
import { partCommand, templateLayers } from '../../worldedit/stack/templates'
import { FIELD, FOCUS } from '../editors/fieldStyles'
import { Icon } from '../ui/Icon'
import { Segmented } from '../ui/Segmented'
import { FieldRow, NumberField } from './NumberField'
import { useScrub } from './scrub'
import { BUTTON, EYEBROW, OP_GLYPH, OP_LABEL, OP_TONE, PANEL_HEAD } from './styles'

/**
 * The selected layer's fields.
 *
 * Every change goes through the store tagged with the layer and the field, so a drag or
 * a burst of typing in one field is one undo step, ended when the field lets go.
 */

const AXES: readonly AxisName[] = ['x', 'y', 'z']

/** Each shape's own sizes: the field, its label and its step. */
const SIZES: Partial<Record<ShapeLayer['kind'], ReadonlyArray<readonly [string, string, number]>>> =
  {
    sphere: [['radius', 'Radius', 0.01]],
    box: [
      ['width', 'Width', 0.01],
      ['height', 'Height', 0.01],
      ['depth', 'Depth', 0.01],
    ],
    cylinder: [
      ['radius', 'Radius', 0.01],
      ['height', 'Height', 0.01],
    ],
    torus: [
      ['major', 'Ring', 0.01],
      ['minor', 'Thickness', 0.005],
    ],
    gyroid: [
      ['frequency', 'Frequency', 0.1],
      ['threshold', 'Threshold', 0.01],
    ],
    triangle: [
      ['width', 'Width', 0.01],
      ['height', 'Height', 0.01],
      ['depth', 'Depth', 0.01],
    ],
    cone: [
      ['radius', 'Radius', 0.01],
      ['height', 'Height', 0.01],
    ],
  }

function titleOf(layer: Layer): string {
  if (layer.type === 'group' || layer.type === 'reference') return KIND_LABELS[layer.type]
  return KIND_LABELS[layer.kind]
}

export function Inspector() {
  const layers = useShapeEditorStore((s) => s.layers)
  const selected = useShapeEditorStore((s) => s.selected)
  const layer = selected === null ? null : (find(layers, selected)?.layer ?? null)
  const idle = layer === null ? undefined : idleLayers(layers).get(layer.id)

  return (
    <>
      <div className={PANEL_HEAD}>{layer ? titleOf(layer) : 'Inspector'}</div>
      <div className="min-h-0 flex-1 overflow-auto">
        {layer === null ? (
          <p className="text-text-muted p-3 text-xs">No shape selected</p>
        ) : (
          // Keyed on the layer, so its fields start from its own values rather than the last one's.
          <div key={layer.id} className="flex flex-col gap-4 p-3">
            <Section>
              <NameField layer={layer} />
              {(layer.type === 'shape' || layer.type === 'group') && <OpChoice layer={layer} />}
              {idle !== undefined && <p className="text-warning text-1xs">{idle}</p>}
            </Section>
            {layer.type === 'shape' && <ShapeFields layer={layer} />}
            {layer.type === 'modifier' && <ModifierFields layer={layer} />}
            {layer.type === 'reference' && <ReferenceFields layer={layer} />}
            {layer.type !== 'modifier' && <PlacementFields layer={layer} />}
            <Actions layer={layer} />
          </div>
        )}
      </div>
    </>
  )
}

function Section({
  title,
  aside,
  children,
}: {
  title?: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      {title !== undefined && (
        <div className="flex items-center justify-between">
          <span className={EYEBROW}>{title}</span>
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

/** Change one field of the layer, as one undo step per burst. */
function useEdit(layer: Layer) {
  const change = useShapeEditorStore((s) => s.change)
  const settle = useShapeEditorStore((s) => s.settle)
  return {
    edit: (field: string, apply: (l: Layer) => Layer) =>
      change(layer.id, apply, `${layer.id}:${field}`),
    settle,
  }
}

function NameField({ layer }: { layer: Layer }) {
  const rename = useShapeEditorStore((s) => s.rename)
  return (
    <input
      aria-label="Name"
      defaultValue={layer.name}
      onBlur={(e) => rename(layer.id, e.currentTarget.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={`${FIELD} h-8 text-sm font-semibold`}
    />
  )
}

function OpChoice({ layer }: { layer: Extract<Layer, { op: Op }> }) {
  const change = useShapeEditorStore((s) => s.change)
  return (
    <fieldset
      aria-label="Operation"
      className="border-hairline border-border-subtle bg-canvas grid min-w-0 grid-cols-3 gap-0.5 rounded-md p-0.5"
    >
      {(['add', 'cut', 'overlap'] as const).map((op) => (
        <button
          key={op}
          type="button"
          aria-pressed={layer.op === op}
          onClick={() => change(layer.id, (l) => ('op' in l ? { ...l, op } : l))}
          className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-sm text-xs font-semibold ${
            layer.op === op ? OP_TONE[op] : 'text-text-secondary hover:text-text-primary'
          } ${FOCUS}`}
        >
          <span className="font-mono font-bold">{OP_GLYPH[op]}</span>
          {OP_LABEL[op]}
        </button>
      ))}
    </fieldset>
  )
}

/** A row of mutually exclusive choices, for an axis or a side. */
function Choice<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: V
  options: ReadonlyArray<readonly [V, string]>
  onChange: (value: V) => void
}) {
  return (
    <FieldRow label={label}>
      <Segmented
        aria-label={label}
        value={value}
        options={options.map(([v, text]) => ({ value: v, label: text }))}
        onChange={onChange}
        className="w-full"
      />
    </FieldRow>
  )
}

function Num({
  label,
  value,
  step,
  onChange,
  onDone,
  min,
  max,
}: {
  label: string
  value: number
  step: number
  onChange: (v: number) => void
  onDone: () => void
  min?: number
  max?: number
}) {
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
  const scrub = useScrub(value, step, (v) => onChange(clamp(v)), onDone)
  return (
    <FieldRow label={label} scrub={scrub}>
      <NumberField
        label={label}
        value={value}
        step={step}
        onChange={onChange}
        onDone={onDone}
        min={min}
        max={max}
      />
    </FieldRow>
  )
}

function ShapeFields({ layer }: { layer: ShapeLayer }) {
  const { edit, settle } = useEdit(layer)
  const sizes = SIZES[layer.kind] ?? []
  if (layer.kind === 'formula') {
    return (
      <Section title="Shape">
        <textarea
          aria-label="Expression"
          spellCheck={false}
          defaultValue={layer.params.source}
          onChange={(e) => {
            const source = e.currentTarget.value
            edit('source', (l) =>
              l.type === 'shape' && l.kind === 'formula' ? { ...l, params: { source } } : l,
            )
          }}
          onBlur={settle}
          onKeyDown={(e) => e.stopPropagation()}
          className={`${FIELD} min-h-16 resize-y leading-normal`}
        />
      </Section>
    )
  }
  if (sizes.length === 0) return null
  const params = layer.params as Readonly<Record<string, number>>
  return (
    <Section title="Shape">
      {sizes.map(([key, label, step]) => (
        <Num
          key={key}
          label={label}
          value={params[key] ?? 0}
          step={step}
          min={key === 'threshold' ? -3 : 0.001}
          onChange={(v) =>
            edit(key, (l) =>
              l.type === 'shape' ? ({ ...l, params: { ...l.params, [key]: v } } as Layer) : l,
            )
          }
          onDone={settle}
        />
      ))}
    </Section>
  )
}

function Trio({
  label,
  value,
  step,
  axes = AXES,
  onChange,
  onDone,
}: {
  label: string
  value: Vec3
  step: number
  axes?: readonly AxisName[]
  onChange: (value: Vec3) => void
  onDone: () => void
}) {
  const scrub = useScrub(value[0], step, (v) => onChange([v, value[1], value[2]]), onDone)
  return (
    <FieldRow label={label} scrub={axes.includes('x') ? scrub : undefined}>
      <div className="grid grid-cols-3 gap-1">
        {AXES.map((axis, i) =>
          axes.includes(axis) ? (
            <NumberField
              key={axis}
              label={`${label} ${axis}`}
              axis={axis}
              value={value[i]!}
              step={step}
              onChange={(v) => {
                const next: [number, number, number] = [value[0], value[1], value[2]]
                next[i] = v
                onChange(next)
              }}
              onDone={onDone}
            />
          ) : null,
        )}
      </div>
    </FieldRow>
  )
}

/** A layer's turn, in degrees about x, then y, then z. */
function RotationField({ layer }: { layer: Layer }) {
  const { edit, settle } = useEdit(layer)
  return (
    <Trio
      label="Rotation°"
      value={layer.rot}
      step={1}
      onChange={(rot) => edit('rot', (l) => ({ ...l, rot }))}
      onDone={settle}
    />
  )
}

function PlacementFields({ layer }: { layer: Exclude<Layer, ModifierLayer> }) {
  const { edit, settle } = useEdit(layer)
  const [uniform, setUniform] = useState(true)
  // A box has its own three sizes, so scaling it together is rarely what is meant.
  const together = uniform && !(layer.type === 'shape' && layer.kind === 'box')
  const scale = (next: Vec3) => {
    if (!together) return next
    const changed = next.findIndex((v, i) => v !== layer.scl[i])
    const v = next[changed] ?? next[0]
    return [v, v, v] as const
  }
  return (
    <Section
      title={layer.type === 'reference' ? 'Placement' : 'Transform'}
      aside={
        <button
          type="button"
          onClick={() =>
            edit(
              'reset',
              (l) => ({ ...l, pos: [0, 0, 0], rot: [0, 0, 0], scl: [1, 1, 1] }) as Layer,
            )
          }
          className={`text-text-muted hover:text-text-primary text-1xs ${FOCUS}`}
        >
          Reset
        </button>
      }
    >
      <Trio
        label="Position"
        value={layer.pos}
        step={0.01}
        onChange={(pos) => edit('pos', (l) => ({ ...l, pos }))}
        onDone={settle}
      />
      <RotationField layer={layer} />
      <Trio
        label="Scale"
        value={layer.scl}
        step={0.01}
        onChange={(next) => {
          const scl = scale([
            Math.max(0.01, next[0]),
            Math.max(0.01, next[1]),
            Math.max(0.01, next[2]),
          ])
          edit('scl', (l) => ({ ...l, scl }))
        }}
        onDone={settle}
      />
      {!(layer.type === 'shape' && layer.kind === 'box') && (
        <div className="flex justify-end">
          <button
            type="button"
            aria-pressed={uniform}
            onClick={() => setUniform((u) => !u)}
            className={`text-text-muted hover:text-text-primary aria-pressed:text-accent text-1xs inline-flex items-center gap-1 ${FOCUS}`}
          >
            <Icon name="link" size="xs" />
            Uniform
          </button>
        </div>
      )}
    </Section>
  )
}

const signed = (axis: AxisName) =>
  [
    ['+', `+${axis}`],
    ['-', `−${axis}`],
  ] as const

function ModifierFields({ layer }: { layer: ModifierLayer }) {
  const { edit, settle } = useEdit(layer)
  const set = (field: string, value: unknown) =>
    edit(field, (l) =>
      l.type === 'modifier' ? ({ ...l, params: { ...l.params, [field]: value } } as Layer) : l,
    )
  const axisOptions = AXES.map((a) => [a, a] as const)
  const rows: ReactNode[] = []
  const p = layer.params as Readonly<Record<string, unknown>>
  const num = (key: string, label: string, step: number, min?: number, max?: number) => (
    <Num
      key={key}
      label={label}
      value={Number(p[key])}
      step={step}
      min={min}
      max={max}
      onChange={(v) => set(key, v)}
      onDone={settle}
    />
  )
  const axis = (key: string, label: string) => (
    <Choice
      key={key}
      label={label}
      value={p[key] as AxisName}
      options={axisOptions}
      onChange={(v) => set(key, v)}
    />
  )
  switch (layer.kind) {
    case 'mirror':
      rows.push(
        axis('axis', 'Axis'),
        <Choice
          key="side"
          label="Keep"
          value={layer.params.side}
          options={signed(layer.params.axis)}
          onChange={(v) => set('side', v)}
        />,
      )
      break
    case 'distort':
      rows.push(
        <Choice
          key="type"
          label="Type"
          value={layer.params.type}
          options={[
            ['wave', 'Wave'],
            ['twist', 'Twist'],
          ]}
          onChange={(v) => set('type', v)}
        />,
      )
      if (layer.params.type === 'twist') rows.push(num('twist', 'Angle°', 1))
      else {
        rows.push(
          num('amplitude', 'Amount', 0.01),
          num('frequency', 'Frequency', 0.1),
          axis('axis', 'Push'),
          axis('along', 'Along'),
        )
      }
      break
    case 'array':
      rows.push(
        axis('axis', 'Axis'),
        num('count', 'Copies', 1, 1, 32),
        num('spacing', 'Spacing', 0.01, 0.01),
      )
      break
    case 'radial':
      rows.push(num('count', 'Copies', 1, 2, 64))
      break
    case 'bend': {
      const { axis } = layer.params
      rows.push(
        <Choice
          key="axis"
          label="Axis"
          value={axis}
          options={axisOptions}
          onChange={(v) =>
            edit('axis', (l) => {
              if (l.type !== 'modifier' || l.kind !== 'bend') return l
              const toward = l.params.toward === v ? AXES.find((a) => a !== v)! : l.params.toward
              return { ...l, params: { ...l.params, axis: v, toward } }
            })
          }
        />,
        <Choice
          key="toward"
          label="Toward"
          value={layer.params.toward}
          options={AXES.filter((a) => a !== axis).map((a) => [a, a] as const)}
          onChange={(v) => set('toward', v)}
        />,
        <Choice
          key="side"
          label="Side"
          value={layer.params.side}
          options={[['both', 'Both'], ...signed(axis)]}
          onChange={(v) => set('side', v)}
        />,
        num('angle', 'Angle°', 1, -720, 720),
      )
      break
    }
    case 'taper':
      rows.push(num('amount', 'Amount', 0.01, -0.95, 3))
      break
    case 'revolve':
      break
  }
  const turned = layer.rot.some((d) => d % 360 !== 0)
  return (
    <Section title="Modifier">
      {rows}
      <Trio
        label={layer.kind === 'mirror' && !turned ? 'Plane' : 'Pivot'}
        value={layer.pos}
        step={0.01}
        axes={turned ? AXES : pivotAxes(layer)}
        onChange={(pos) => edit('pos', (l) => ({ ...l, pos }))}
        onDone={settle}
      />
      <RotationField layer={layer} />
    </Section>
  )
}

function ReferenceFields({ layer }: { layer: ReferenceLayer }) {
  const { edit, settle } = useEdit(layer)
  return (
    <Section title="Command">
      <select
        aria-label="Command source"
        value={layer.template ?? ''}
        onChange={(e) => {
          const template = TEMPLATES.find((t) => t.id === e.currentTarget.value)
          edit('template', (l) => {
            if (l.type !== 'reference') return l
            if (!template) {
              const { template: _dropped, ...rest } = l
              return rest
            }
            const command = partCommand(template.pattern, templateLayers(template))
            return { ...l, name: template.name, template: template.id, command }
          })
          settle()
        }}
        className={`${FIELD} h-8 font-sans font-semibold`}
      >
        <option value="">Pasted command</option>
        <optgroup label="Templates">
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </optgroup>
      </select>
      <textarea
        aria-label="//generate command"
        spellCheck={false}
        value={layer.command}
        onChange={(e) => {
          const command = e.currentTarget.value
          edit('command', (l) => {
            if (l.type !== 'reference') return l
            const { template: _dropped, ...rest } = l
            return { ...rest, command }
          })
        }}
        onBlur={settle}
        onKeyDown={(e) => e.stopPropagation()}
        className={`${FIELD} min-h-16 resize-y leading-normal`}
      />
    </Section>
  )
}

function Actions({ layer }: { layer: Layer }) {
  const store = useShapeEditorStore.getState()
  return (
    <section className="flex flex-wrap gap-1.5">
      <button
        type="button"
        className={`${BUTTON} flex-1 ${FOCUS}`}
        onClick={() => store.duplicateLayer(layer.id)}
      >
        <Icon name="copy" size="sm" />
        Duplicate
      </button>
      {layer.type === 'group' ? (
        <button
          type="button"
          className={`${BUTTON} flex-1 ${FOCUS}`}
          onClick={() => store.ungroupLayer(layer.id)}
        >
          Ungroup
        </button>
      ) : (
        <button
          type="button"
          className={`${BUTTON} flex-1 ${FOCUS}`}
          onClick={() => store.wrapLayer(layer.id)}
        >
          Group
        </button>
      )}
      <button
        type="button"
        className={`${BUTTON} hover:text-danger hover:border-danger/50 flex-1 ${FOCUS}`}
        onClick={() => store.removeLayer(layer.id)}
      >
        <Icon name="trash" size="sm" />
        Remove
      </button>
    </section>
  )
}
