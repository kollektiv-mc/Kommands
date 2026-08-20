import type { CommandDefinition } from '../../../../schema/types'

/**
 * `//generate` — the first WorldEdit definition.
 *
 * Verified against WorldEdit's `GenerationCommands.java`:
 *
 *     name = "/generate", aliases = { "/gen", "/g" }
 *     @Arg  Pattern pattern
 *     @Arg(variable = true) List<String> expression      // joined with " "
 *     @Switch('h') hollow   @Switch('r') useRawCoords
 *     @Switch('o') offsetPlacement   @Switch('c') offsetCenter
 *
 * The doubled slash is not a typo and not a prefix the serializer adds: WorldEdit
 * registers its commands under a leading `/`, so the in-game name of `"/generate"` is
 * `//generate`. Vanilla literals are bare and `serializeCommand` prefixes them by
 * dialect; a WorldEdit token carries its own slashes, which is the whole of what
 * `dialect` changes about serialization.
 *
 * This definition is `authored` where a vanilla one is `derived`, and that is the only
 * difference between them. Nothing downstream — renderer, serializer, constraints,
 * routing — is told which it is holding.
 */
export const generate: CommandDefinition = {
  id: 'worldedit:generate',
  label: '//generate',
  dialect: 'worldedit',
  provenance: 'authored',
  // WorldEdit's own syntax does not move with Minecraft's. The range says which
  // versions of *this app* offer the command, and 1.21.1 is the only one there is.
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
      // Last, and variadic because it is last. The expression contains spaces, so any
      // node after it would be tokens the expression had already swallowed.
      { kind: 'argument', name: 'expression', type: 'we_expression', variadic: true },
    ],
  },
  constraints: [
    {
      kind: 'mutex',
      targets: ['-r', '-o', '-c'],
      // Warns, never blocks — and the warning says what actually happens rather than
      // that something is forbidden. WorldEdit accepts all three together and silently
      // takes the first it finds, in this order: TransformUtil returns on `useRawCoords`
      // before it looks at `offsetPlacement`, and at that before `offsetCenter`. The
      // command runs; two of the three modes are simply ignored.
      message: 'Only one origin mode applies. WorldEdit takes -r first, then -o, then -c.',
    },
  ],
  ui: {
    summary:
      'Fills the selection with a shape, placing a block wherever the expression is true. ' +
      'x, y and z run from -1 to 1 across the selection unless an origin mode says otherwise.',
    arguments: {
      pattern: {
        label: 'Blocks',
        help: 'What to place. Several blocks share the shape by relative chance.',
      },
      expression: {
        label: 'Expression',
        help: 'Truthy places a block. A sphere is x^2+y^2+z^2 < 1.',
      },
    },
  },
}
