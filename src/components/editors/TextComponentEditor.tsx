import { useId } from 'react'
import type { SerializeContext } from '../../data/versions/types'
import {
  CLICK_ACTIONS,
  HOVER_ACTIONS,
  TEXT_CONTENT_KINDS,
  emptyTextComponent,
  type ClickAction,
  type HoverAction,
  type HoverEvent,
  type TextComponent,
  type TextContent,
  type TextContentKind,
} from '../../schema/text-component'
import type { EditorProps } from '../../schema/types'
import { TEXT_COLORS } from '../../data/authored/text-colors'
import { RegistryPicker } from './RegistryPicker'
import { FIELD, LABEL } from './fieldStyles'
import { ROW, ROW_ADD, ROW_GROUP, ROW_REMOVE } from './rowStyles'

/**
 * Backs `text_component` — and the item components that carry one.
 *
 * The component is recursive because the grammar is: `extra` children, a translate's
 * arguments, a selector's separator and a hover event's text are all whole components
 * again. Every one of those renders this same function, so the grammar is described
 * once no matter how deep a user goes.
 *
 * `text_component` is bound to fifteen arguments across five commands, so this is not
 * /tellraw's editor — /tellraw is only where it is proven.
 */

const FLAGS = ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated'] as const

interface TextComponentFieldsProps {
  value: TextComponent
  onChange: (next: TextComponent) => void
  /**
   * Prefixes every control's accessible name.
   *
   * Load-bearing under recursion rather than cosmetic: without it a component three
   * levels deep has the same five checkbox labels as its parent, and neither a screen
   * reader nor a test can say which one it reached.
   */
  ariaPrefix: string
  ctx: SerializeContext
}

export function TextComponentFields({
  value,
  onChange,
  ariaPrefix,
  ctx,
}: TextComponentFieldsProps) {
  const children = value.extra ?? []

  return (
    // A column, not a row. Children nest inside this, and a block cannot live in the
    // inline element this used to be.
    <div className="flex flex-col gap-2">
      <div className={ROW}>
        <ContentFields value={value} onChange={onChange} ariaPrefix={ariaPrefix} ctx={ctx} />
        <ColorField value={value} onChange={onChange} ariaPrefix={ariaPrefix} />
        {FLAGS.map((flag) => (
          <label key={flag} className="flex items-center gap-1">
            <input
              type="checkbox"
              className="accent-accent"
              checked={value[flag] === true}
              aria-label={`${ariaPrefix} ${flag}`}
              // Unset rather than false: a flag written as false is a field in the
              // output, and an untouched checkbox should leave the component alone.
              onChange={(e) => onChange({ ...value, [flag]: e.target.checked ? true : undefined })}
            />
            <span className={LABEL}>{flag}</span>
          </label>
        ))}
      </div>

      <EventFields value={value} onChange={onChange} ariaPrefix={ariaPrefix} ctx={ctx} />

      {children.length > 0 && (
        <div className={ROW_GROUP}>
          {children.map((child, index) => (
            <div key={index} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className={LABEL}>{`child ${index + 1}`}</span>
                <button
                  type="button"
                  className={ROW_REMOVE}
                  aria-label={`Remove ${ariaPrefix} child ${index + 1}`}
                  onClick={() => onChange({ ...value, extra: dropAt(children, index) })}
                >
                  − remove
                </button>
              </div>
              <TextComponentFields
                value={child}
                ariaPrefix={`${ariaPrefix} child ${index + 1}`}
                ctx={ctx}
                onChange={(next) => onChange({ ...value, extra: replaceAt(children, index, next) })}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          className={ROW_ADD}
          aria-label={`Add ${ariaPrefix} child`}
          onClick={() => onChange({ ...value, extra: [...children, emptyTextComponent()] })}
        >
          + child
        </button>
        <EventToggles value={value} onChange={onChange} ariaPrefix={ariaPrefix} />
      </div>
    </div>
  )
}

export function TextComponentEditor({ value, onChange, ctx }: EditorProps<TextComponent>) {
  return <TextComponentFields value={value} onChange={onChange} ariaPrefix="Message" ctx={ctx} />
}

// ── Content ─────────────────────────────────────────────────────────────────

/** A fresh content of each kind, for when the picker switches. */
function blankContent(kind: TextContentKind): TextContent {
  switch (kind) {
    case 'text':
      return { kind: 'text', text: '' }
    case 'translate':
      return { kind: 'translate', translate: '' }
    case 'selector':
      return { kind: 'selector', selector: '' }
    case 'score':
      return { kind: 'score', objective: '', name: '' }
  }
}

interface PartProps {
  value: TextComponent
  onChange: (next: TextComponent) => void
  ariaPrefix: string
  ctx: SerializeContext
}

function ContentFields({ value, onChange, ariaPrefix, ctx }: PartProps) {
  const content = value.content
  // Switching kind replaces the content outright rather than merging, so a component
  // can never carry two kinds' fields at once — which is the shape the game resolves
  // by picking one and silently ignoring the rest.
  const setKind = (kind: TextContentKind) => onChange({ ...value, content: blankContent(kind) })
  const setContent = (next: TextContent) => onChange({ ...value, content: next })

  return (
    <>
      <select
        className={FIELD}
        value={content.kind}
        aria-label={`${ariaPrefix} kind`}
        onChange={(e) => setKind(e.target.value as TextContentKind)}
      >
        {TEXT_CONTENT_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {kind}
          </option>
        ))}
      </select>

      {content.kind === 'text' && (
        <input
          type="text"
          className={FIELD}
          value={content.text}
          aria-label={`${ariaPrefix} text`}
          onChange={(e) => setContent({ ...content, text: e.target.value })}
        />
      )}

      {content.kind === 'translate' && (
        <>
          <input
            type="text"
            className={FIELD}
            value={content.translate}
            aria-label={`${ariaPrefix} translation key`}
            onChange={(e) => setContent({ ...content, translate: e.target.value })}
          />
          <input
            type="text"
            className={FIELD}
            value={content.fallback ?? ''}
            aria-label={`${ariaPrefix} fallback`}
            onChange={(e) => setContent({ ...content, fallback: e.target.value || undefined })}
          />
        </>
      )}

      {content.kind === 'selector' && (
        <input
          type="text"
          className={FIELD}
          value={content.selector}
          aria-label={`${ariaPrefix} selector`}
          onChange={(e) => setContent({ ...content, selector: e.target.value })}
        />
      )}

      {content.kind === 'score' && (
        <>
          <input
            type="text"
            className={FIELD}
            value={content.objective}
            aria-label={`${ariaPrefix} objective`}
            onChange={(e) => setContent({ ...content, objective: e.target.value })}
          />
          <input
            type="text"
            className={FIELD}
            value={content.name}
            aria-label={`${ariaPrefix} holder`}
            onChange={(e) => setContent({ ...content, name: e.target.value })}
          />
        </>
      )}

      {content.kind === 'translate' && (
        <TranslateArguments
          content={content}
          onChange={setContent}
          ariaPrefix={ariaPrefix}
          ctx={ctx}
        />
      )}
    </>
  )
}

function TranslateArguments({
  content,
  onChange,
  ariaPrefix,
  ctx,
}: {
  content: Extract<TextContent, { kind: 'translate' }>
  onChange: (next: TextContent) => void
  ariaPrefix: string
  ctx: SerializeContext
}) {
  const args = content.with ?? []
  return (
    <div className="flex flex-col gap-2">
      {args.map((argument, index) => (
        <div key={index} className={ROW_GROUP}>
          <div className="flex items-center gap-2">
            <span className={LABEL}>{`argument ${index + 1}`}</span>
            <button
              type="button"
              className={ROW_REMOVE}
              aria-label={`Remove ${ariaPrefix} argument ${index + 1}`}
              onClick={() => onChange({ ...content, with: dropAt(args, index) })}
            >
              − remove
            </button>
          </div>
          <TextComponentFields
            value={argument}
            ariaPrefix={`${ariaPrefix} argument ${index + 1}`}
            ctx={ctx}
            onChange={(next) => onChange({ ...content, with: replaceAt(args, index, next) })}
          />
        </div>
      ))}
      <button
        type="button"
        className={ROW_ADD}
        aria-label={`Add ${ariaPrefix} argument`}
        onClick={() => onChange({ ...content, with: [...args, emptyTextComponent()] })}
      >
        + argument
      </button>
    </div>
  )
}

// ── Colour ──────────────────────────────────────────────────────────────────

/**
 * A field rather than a picker, so a hex triplet can be typed.
 *
 * Hex colours have been legal since 1.16 and the select this replaced could not
 * express one — the sixteen names were the only reachable values in a field that
 * accepts far more.
 */
function ColorField({
  value,
  onChange,
  ariaPrefix,
}: {
  value: TextComponent
  onChange: (next: TextComponent) => void
  ariaPrefix: string
}) {
  const listId = useId()
  return (
    <>
      <input
        type="text"
        className={FIELD}
        value={value.color ?? ''}
        list={listId}
        aria-label={`${ariaPrefix} colour`}
        onChange={(e) => onChange({ ...value, color: e.target.value || undefined })}
      />
      <datalist id={listId}>
        {TEXT_COLORS.map((color) => (
          <option key={color} value={color} />
        ))}
      </datalist>
    </>
  )
}

// ── Events ──────────────────────────────────────────────────────────────────

function EventToggles({
  value,
  onChange,
  ariaPrefix,
}: {
  value: TextComponent
  onChange: (next: TextComponent) => void
  ariaPrefix: string
}) {
  return (
    <>
      {!value.clickEvent && (
        <button
          type="button"
          className={ROW_ADD}
          aria-label={`Add ${ariaPrefix} click event`}
          onClick={() => onChange({ ...value, clickEvent: { action: 'open_url', value: '' } })}
        >
          + click
        </button>
      )}
      {!value.hoverEvent && (
        <button
          type="button"
          className={ROW_ADD}
          aria-label={`Add ${ariaPrefix} hover event`}
          onClick={() =>
            onChange({
              ...value,
              hoverEvent: { action: 'show_text', contents: emptyTextComponent() },
            })
          }
        >
          + hover
        </button>
      )}
    </>
  )
}

/** A fresh hover event of each action, for when the picker switches. */
function blankHover(action: HoverAction): HoverEvent {
  switch (action) {
    case 'show_text':
      return { action: 'show_text', contents: emptyTextComponent() }
    case 'show_item':
      return { action: 'show_item', id: '' }
    case 'show_entity':
      return { action: 'show_entity', entityType: '', id: '' }
  }
}

function EventFields({ value, onChange, ariaPrefix, ctx }: PartProps) {
  const click = value.clickEvent
  const hover = value.hoverEvent
  if (!click && !hover) return null

  return (
    <div className={ROW_GROUP}>
      {click && (
        <div className={ROW}>
          <span className={LABEL}>click</span>
          <select
            className={FIELD}
            value={click.action}
            aria-label={`${ariaPrefix} click action`}
            onChange={(e) =>
              onChange({
                ...value,
                clickEvent: { ...click, action: e.target.value as ClickAction },
              })
            }
          >
            {CLICK_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
          <input
            type="text"
            className={FIELD}
            value={click.value}
            aria-label={`${ariaPrefix} click value`}
            onChange={(e) =>
              onChange({ ...value, clickEvent: { ...click, value: e.target.value } })
            }
          />
          <button
            type="button"
            className={ROW_REMOVE}
            aria-label={`Remove ${ariaPrefix} click event`}
            onClick={() => onChange({ ...value, clickEvent: undefined })}
          >
            − remove
          </button>
        </div>
      )}

      {hover && (
        <div className="flex flex-col gap-2">
          <div className={ROW}>
            <span className={LABEL}>hover</span>
            <select
              className={FIELD}
              value={hover.action}
              aria-label={`${ariaPrefix} hover action`}
              onChange={(e) =>
                onChange({ ...value, hoverEvent: blankHover(e.target.value as HoverAction) })
              }
            >
              {HOVER_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
            {hover.action === 'show_item' && (
              <>
                <RegistryPicker
                  value={hover.id}
                  entries={ctx.registries.entries('item')}
                  ariaLabel={`${ariaPrefix} hover item`}
                  invalid={hover.id !== '' && !ctx.registries.has('item', hover.id)}
                  onChange={(next) => onChange({ ...value, hoverEvent: { ...hover, id: next } })}
                />
                <input
                  type="number"
                  className={FIELD}
                  value={hover.count ?? ''}
                  aria-label={`${ariaPrefix} hover count`}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      hoverEvent: {
                        ...hover,
                        count: e.target.value === '' ? undefined : Number(e.target.value),
                      },
                    })
                  }
                />
              </>
            )}
            {hover.action === 'show_entity' && (
              <>
                <RegistryPicker
                  value={hover.entityType}
                  entries={ctx.registries.entries('entity_type')}
                  ariaLabel={`${ariaPrefix} hover entity type`}
                  invalid={
                    hover.entityType !== '' && !ctx.registries.has('entity_type', hover.entityType)
                  }
                  onChange={(next) =>
                    onChange({ ...value, hoverEvent: { ...hover, entityType: next } })
                  }
                />
                <input
                  type="text"
                  className={FIELD}
                  value={hover.id}
                  aria-label={`${ariaPrefix} hover entity id`}
                  onChange={(e) =>
                    onChange({ ...value, hoverEvent: { ...hover, id: e.target.value } })
                  }
                />
              </>
            )}
            <button
              type="button"
              className={ROW_REMOVE}
              aria-label={`Remove ${ariaPrefix} hover event`}
              onClick={() => onChange({ ...value, hoverEvent: undefined })}
            >
              − remove
            </button>
          </div>
          {hover.action === 'show_text' && (
            <TextComponentFields
              value={hover.contents}
              ariaPrefix={`${ariaPrefix} hover text`}
              ctx={ctx}
              onChange={(next) => onChange({ ...value, hoverEvent: { ...hover, contents: next } })}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── List helpers ────────────────────────────────────────────────────────────

const replaceAt = <T,>(list: readonly T[], index: number, next: T): T[] =>
  list.map((item, i) => (i === index ? next : item))

const dropAt = <T,>(list: readonly T[], index: number): T[] | undefined => {
  const kept = list.filter((_, i) => i !== index)
  // Undefined rather than an empty array: `extra` and `with` are typed as non-empty
  // lists, so "none left" has to mean the key is absent, not present and empty.
  return kept.length > 0 ? kept : undefined
}
