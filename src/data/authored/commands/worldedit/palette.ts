import type { CommandDefinition, Node } from '../../../../schema/types'

// Functions rather than shared constants: authored defaults are attached by node
// identity (`withDefaults`), so one object in four places would take all four defaults.
const mask = (): Node => ({ kind: 'argument', name: 'mask', type: 'we_mask', optional: true })
const pattern = (): Node => ({ kind: 'argument', name: 'pattern', type: 'we_pattern' })
const number = (name: string, type: 'integer' | 'double', min: number, max?: number): Node => ({
  kind: 'argument',
  name,
  type,
  typeOptions: max === undefined ? { min } : { min, max },
  optional: true,
})
const hollow = (): Node => ({
  kind: 'flagset',
  flags: [{ name: '-h', char: 'h', label: 'Hollow' }],
})

/**
 * The Palette Editor: one sheet for the WorldEdit commands that take a mask(), a pattern(),
 * or both, with the command picked at the top and the tiles following it.
 *
 * One definition rather than five because what is being built is the same thing each
 * time, which blocks to touch and what to put there, and someone deciding between
 * `//replace` and a brush should not lose it by switching. The command is a Choice like
 * any other, so the renderer and serializer needed nothing new.
 *
 * Every signature is read from WorldEdit 7.3.6, the release 1.21.1 servers run:
 *
 *     RegionCommands   /replace [from: Mask = existing] <to: Pattern>
 *                      /set <pattern>
 *                      /smooth [iterations = 1] [mask()]
 *     GeneralCommands  gmask, alias /gmask: [mask()], none clears it
 *     BrushCommands    sphere [-h] <pattern> [radius = 2]
 *                      cylinder [-h] <pattern> [radius = 2] [height = 1]
 *                      set <shape> [radius = 5] <pattern>
 *                      splatter <pattern> [radius = 2] [decay = 1]
 *                      smooth [radius = 2] [iterations = 4] [mask()]
 *
 * `/brush` is registered as `brush` with `/brush` among its aliases, so it is written
 * with one slash. A mask() on any brush but smooth is a second command (`/mask`), which
 * one definition cannot emit, so those brushes take no mask() here.
 */
export const palette: CommandDefinition = {
  id: 'worldedit:palette',
  label: 'Palette Editor',
  dialect: 'worldedit',
  provenance: 'authored',
  versions: { min: '1.21.1' },
  // What someone types to find it: the commands it writes.
  aliases: ['//replace', '//set', '//gmask', '//smooth', '/brush'],
  root: {
    kind: 'choice',
    nodes: [
      { kind: 'sequence', nodes: [{ kind: 'literal', token: '//replace' }, mask(), pattern()] },
      { kind: 'sequence', nodes: [{ kind: 'literal', token: '//set' }, pattern()] },
      { kind: 'sequence', nodes: [{ kind: 'literal', token: '//gmask' }, mask()] },
      {
        kind: 'sequence',
        nodes: [{ kind: 'literal', token: '//smooth' }, number('iterations', 'integer', 1), mask()],
      },
      {
        kind: 'sequence',
        nodes: [
          { kind: 'literal', token: '/brush' },
          {
            kind: 'choice',
            nodes: [
              {
                kind: 'sequence',
                nodes: [
                  { kind: 'literal', token: 'sphere' },
                  hollow(),
                  pattern(),
                  number('radius', 'double', 0),
                ],
              },
              {
                kind: 'sequence',
                nodes: [
                  { kind: 'literal', token: 'cylinder' },
                  hollow(),
                  pattern(),
                  number('radius', 'double', 0),
                  number('height', 'integer', 1),
                ],
              },
              {
                kind: 'sequence',
                nodes: [
                  { kind: 'literal', token: 'set' },
                  { kind: 'argument', name: 'shape', type: 'we_region_shape' },
                  number('radius', 'double', 0),
                  pattern(),
                ],
              },
              {
                kind: 'sequence',
                nodes: [
                  { kind: 'literal', token: 'splatter' },
                  pattern(),
                  number('radius', 'double', 0),
                  number('decay', 'integer', 0, 10),
                ],
              },
              {
                kind: 'sequence',
                nodes: [
                  { kind: 'literal', token: 'smooth' },
                  number('radius', 'double', 0),
                  number('iterations', 'integer', 1),
                  mask(),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  ui: {
    arguments: {
      mask: { label: 'Blocks to touch' },
      pattern: { label: 'Place' },
      iterations: { label: 'Passes' },
      shape: { label: 'Shape' },
      radius: { label: 'Radius' },
      height: { label: 'Height' },
      decay: { label: 'Decay' },
    },
  },
}
