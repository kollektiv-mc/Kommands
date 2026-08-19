import type { CommandDefinition } from './types'

/**
 * Hand-written definitions used to exercise the schema before the deriver exists.
 *
 * These are transcribed from docs/command-schema.md § Worked examples, deliberately
 * without simplification: the point is to find out whether the documented schema can
 * express them, so an "improvement" made while copying would hide the answer.
 *
 * `/give` is replaced by the derived skeleton in #4. `/execute` stays useful past
 * that as the case that decides whether the tree schema was necessary.
 */

export const GIVE: CommandDefinition = {
  id: 'vanilla:give',
  label: '/give',
  dialect: 'vanilla',
  provenance: 'authored',
  versions: { min: '1.21.1' },
  root: {
    kind: 'sequence',
    nodes: [
      { kind: 'literal', token: 'give' },
      {
        kind: 'argument',
        name: 'targets',
        type: 'entity_selector',
        typeOptions: { type: 'players', amount: 'multiple' },
      },
      // item_stack has no editor until #7, so the parser table's `deep` kind sends it
      // to the raw_text fallback. That degradation is the documented behaviour, and
      // this fixture is where it is visible.
      { kind: 'argument', name: 'item', type: 'item_stack' },
      {
        kind: 'argument',
        name: 'count',
        type: 'integer',
        typeOptions: { min: 1 },
        optional: true,
      },
    ],
  },
}

/**
 * /execute — the acceptance case for the tree schema.
 *
 * Two things a flat argument list cannot express: clauses chain arbitrarily
 * (Brigadier `redirect: ["execute"]`, modelled as Repeat(Choice)), and `run` embeds
 * another whole command (a Ref). Abridged to four clauses; the shape is what is under
 * test, not the count.
 */
export const EXECUTE: CommandDefinition = {
  id: 'vanilla:execute',
  label: '/execute',
  dialect: 'vanilla',
  provenance: 'authored',
  versions: { min: '1.21.1' },
  root: {
    kind: 'sequence',
    nodes: [
      { kind: 'literal', token: 'execute' },
      {
        kind: 'repeat',
        min: 0,
        node: {
          kind: 'choice',
          nodes: [
            {
              kind: 'sequence',
              nodes: [
                { kind: 'literal', token: 'as' },
                {
                  kind: 'argument',
                  name: 'as_targets',
                  type: 'entity_selector',
                  typeOptions: { type: 'entities', amount: 'multiple' },
                },
              ],
            },
            {
              kind: 'sequence',
              nodes: [
                { kind: 'literal', token: 'at' },
                {
                  kind: 'argument',
                  name: 'at_targets',
                  type: 'entity_selector',
                  typeOptions: { type: 'entities', amount: 'multiple' },
                },
              ],
            },
          ],
        },
      },
      {
        kind: 'sequence',
        nodes: [
          { kind: 'literal', token: 'run' },
          { kind: 'ref', definitionId: '@any' },
        ],
      },
    ],
  },
}

/**
 * //generate — flags, a variadic tail, and a mutex constraint.
 *
 * Included because those three are the node behaviours vanilla never uses. If any of
 * them needed a second schema, that would be a finding; this fixture is how it would
 * surface.
 */
export const GENERATE: CommandDefinition = {
  id: 'worldedit:generate',
  label: '//generate',
  dialect: 'worldedit',
  provenance: 'authored',
  versions: { min: '1.21.1' },
  aliases: ['//gen', '//g'],
  root: {
    kind: 'sequence',
    nodes: [
      { kind: 'literal', token: '//generate' },
      {
        kind: 'flagset',
        flags: [
          { name: '-h', char: 'h', label: 'Hollow' },
          { name: '-r', char: 'r', label: 'Raw coordinate origin' },
          { name: '-o', char: 'o', label: 'Placement origin' },
          { name: '-c', char: 'c', label: 'Selection centre origin' },
        ],
      },
      { kind: 'argument', name: 'pattern', type: 'we_pattern' },
      { kind: 'argument', name: 'expression', type: 'we_expression', variadic: true },
    ],
  },
  constraints: [{ kind: 'mutex', targets: ['-r', '-o', '-c'], message: 'Choose one origin mode.' }],
}
