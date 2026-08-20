import type { CommandDefinition } from './types'

/**
 * Hand-written definitions the deriver cannot supply.
 *
 * These are transcribed from docs/command-schema.md § Worked examples, deliberately
 * without simplification: the point is to find out whether the documented schema can
 * express them, so an "improvement" made while copying would hide the answer.
 *
 * `/give` used to live here and is gone — the derived skeleton is the real thing now,
 * and tests read it from src/data/generated so they assert the artefact rather than a
 * transcription of it. `//generate` has followed it out: the WorldEdit dialect landed,
 * so the real definition lives in src/data/authored/commands and tests assert that
 * instead of a copy that could drift from it.
 *
 * `/execute` stays, as the case that decides whether the tree schema was necessary. It
 * is abridged where the derived skeleton is not, which is the point — the shape is
 * under test here, and the full skeleton is asserted separately.
 */

/**
 * /execute — the acceptance case for the tree schema.
 *
 * Three things a flat argument list cannot express: clauses chain arbitrarily
 * (Brigadier `redirect: ["execute"]`, modelled as Repeat(Choice)); `run` embeds
 * another whole command (a Ref); and the `run` clause may be skipped entirely, keyword
 * included, because every `if`/`unless` leaf is executable on its own — a one-branch
 * Choice with `optional` set, which is the only shape that drops the keyword with the
 * command it introduces.
 *
 * Abridged to three clauses; the shape is what is under test, not the count.
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
        kind: 'choice',
        optional: true,
        nodes: [
          {
            kind: 'sequence',
            nodes: [
              { kind: 'literal', token: 'run' },
              { kind: 'ref', definitionId: '@any' },
            ],
          },
        ],
      },
    ],
  },
}
