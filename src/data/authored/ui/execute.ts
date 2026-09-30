import type { UiMetadata } from '../../../schema/types'

const CONTEXT = 'Change who or where'
const TEST = 'Test a condition'
const STORE = 'Store a value'

/**
 * Presentation for `/execute`.
 *
 * What each clause does is the part of `/execute` people get wrong, and none of it is
 * in the generated tree, which knows the keywords and not what they change. Checked
 * against minecraft.wiki's /execute page. Keyed by each clause's leading keyword (see
 * `UiMetadata.clauses`), and the argument labels by name, which here is shared across
 * clauses on purpose: a `targets` is the targets whichever clause holds it.
 */
export const executeUi: UiMetadata = {
  summary: 'Run a command as someone else, somewhere else, or only when a test passes.',
  clauses: {
    as: { group: CONTEXT, help: 'Run the rest as each target. The position does not move.' },
    at: { group: CONTEXT, help: "Move to each target's position, rotation and dimension." },
    positioned: { group: CONTEXT, help: 'Move the position without changing who runs it.' },
    align: { group: CONTEXT, help: 'Round the position down to whole blocks on the chosen axes.' },
    anchored: { group: CONTEXT, help: 'Measure ^ ^ ^ and facing from the eyes or the feet.' },
    facing: { group: CONTEXT, help: 'Turn toward a point or an entity.' },
    rotated: { group: CONTEXT, help: 'Set the rotation.' },
    in: { group: CONTEXT, help: 'Switch to another dimension, which moves the position too.' },
    on: { group: CONTEXT, help: 'Switch to an entity related to the current one.' },
    summon: { group: CONTEXT, help: 'Summon an entity and run the rest as it.' },
    if: { group: TEST, help: 'Continue only when the test passes.' },
    unless: { group: TEST, help: 'Continue only when the test fails.' },
    store: { group: STORE, help: 'Save the result or success of what runs, once it finishes.' },
  },
  arguments: {
    targets: { label: 'Targets' },
    anchor: { label: 'Anchor' },
    axes: { label: 'Axes' },
    pos: { label: 'Position' },
    rot: { label: 'Rotation' },
    heightmap: { label: 'Heightmap' },
    dimension: { label: 'Dimension' },
    biome: { label: 'Biome' },
    start: { label: 'From' },
    end: { label: 'To' },
    destination: { label: 'Compare with' },
    entities: { label: 'Entities' },
    predicate: { label: 'Predicate' },
    scale: { label: 'Scale', help: 'Multiplies the value before it is stored.' },
    targetObjective: { label: 'Objective' },
    range: { label: 'Range' },
  },
}
