# The home page and the download page

What the web build opens on, and the page the standalone app is downloaded from. Both
were settled in a prototype reviewed in November 2026; this file records what it decided.
Both pages are built (`src/components/home/`), except the download page's scenes.

The dashboard moved from `/` to `/dashboard` to make room. Which build opens on which
page is in [`distribution.md`](distribution.md#one-install-two-surfaces).

---

## Shared shape

Two pages, one header: the mark and name on the left, and on the right a plain link
(GitHub on the home page, **Open Dashboard** on the download page) beside **Download**, an
outlined orange button. The background is the
dashboard's own dot grid (`DotGrid`), so leaving the home for the dashboard does not
change the ground under it.

Below the fold on both pages the content uses the block design of Konnekt's website: one
bordered block per section, a numbered band heading each. The footer reads
`Kommands · Konnekt` and `Not affiliated with Mojang or Microsoft`.

Copy follows `.claude/rules/copy.md`: no eyebrows, no subtitles under buttons, no lines
that explain what the page already shows.

## The home page

### The hero

There is no visible headline. The page's `h1` is screen-reader only, and the hero is a
command that types itself in large monospace, then turns into its own editor:

1. The command types out on the rows it will finally occupy. The final layout is measured
   first and reserved, so nothing reflows while it types.
2. Its arguments colour in one at a time (`--arg-1` to `--arg-4`: orange and yellow only)
   and space apart.
3. Each argument becomes the editor tile it is edited in, in place: the box glides from
   its text size to its tile size while a label, a control and any chips grow inside it.
   Text a tile shows elsewhere (an item's components, an NBT compound) fades out in place
   before the glide, rather than the box closing over it.
4. The rows rebalance so no row runs much longer than the others, and the command
   holds, then fades.

Motion rule: every change that alters a size pushes its neighbours with animation, on one
curve (1.1s, `cubic-bezier(.45, 0, .2, 1)`). Nothing snaps.

The commands, in a fixed order that shows `//generate` every third or fourth time
(`/give`, `/effect`, `//generate`, `/execute`, `/playsound`, `//generate`, `/data`,
`/particle`, `//generate`), each using as many of its arguments as it can:

| Command                                                         | Tiles                                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/give @p diamond_sword[enchantments={levels:{sharpness:5}}] 1` | Recipients, Item stack (an `enchantments` chip and **+ Add component**), Count                               |
| `/effect give @a speed 30 1 true`                               | Targets, Effect (with its colour swatch), Seconds, Amplifier, Hide particles                                 |
| `//generate <block> <expression>`                               | Blocks (with a swatch), Expression; a 3D preview beside it, see below                                        |
| `/execute ...`                                                  | The step chain (`as`, `at`, `if`, `run`) as tiles on the right; a step slots in, another is edited           |
| `/playsound block.note_block.bell master @a ~ ~ ~ 1 2 0.5`      | Sound, Source, Targets, Position, Volume, Pitch, Min volume                                                  |
| `/data merge entity @n[type=zombie] {NoAI:1b,Silent:1b}`        | Target type, Target (`@n` with a **type zombie** dropdown under it), NBT (a dropdown per tag, **+ Add tag**) |
| `/particle flame ~ ~1 ~ 0.3 0.5 0.3 0.02 40 force @a`           | Particle, Position, Delta, Speed, Count, Mode, Viewers                                                       |

`/data`'s NBT as a list of tags with a dropdown each, and a selector's filters as
dropdowns under its field, are not in the editor today. The hero shows them as the editor
should have them.

**`//generate`** cycles five shapes (a tower, a copper ring, a heart, a dome with a door, a
twisted quartz tower). A cursor drags the shape's gizmo in a voxel preview and the
expression updates with each drag; long expressions fold to `…` but the dragged numbers
stay visible. Every variant names a block. Some variants add a second object and switch
it from Add to Cut. Shapes are solid: the hero uses no flags.

Below the hero: **Open Dashboard** (grey, secondary) and one line,
`Java Edition 1.21.1 · WorldEdit · free, MIT`.

### Below the hero

- **Works with**: Vanilla 1.21.1, WorldEdit, Konnekt.
- **01 Generators**, four tiles: _78 Commands_, _3D Editor_, _Execute Builder_ and
  _Command Dashboard_, each with a small live visual.
- **Get Kommands.**: **Download** (orange, primary) and **Open Dashboard** (grey).

## The download page

One viewport tall. On the left, `Download`, the release line
(`0.1.0 snapshot · Windows, macOS and Linux · MIT`) and the download tiles; on the right,
scenes. The footer sits below the fold.

**Downloads.** Windows (orange, white on hover), macOS, and Linux, which opens in place:
the tile cross-fades into _Linux RPM_ and _Linux binary_ slides out from under it while
the list grows. Labels only, no file names. Every tile points at the snapshot release, the only one published so far.

**Scenes.** App windows floating on the dot grid, without a frame around the stage. A
scene's windows open as it starts and close before the next. Two scenes alternate, each
cycling its variants:

- **Konnekt**: a saved command is linked in Kommands and lands in Konnekt, as a button on
  its Commands tile or as a Command block in its Scheduler, and is run there; the console
  answers. Linked commands show their name only.
- **Saved commands**: a command is saved, its tile flips into the dashboard, and it is
  browsed, dragged into a group and tagged.

A tab per scene sits under the stage with a progress bar. Game text in the scenes is the
1.21.1 `en_us.json` wording, and mockup player names are Snadrochka, crocodealer420,
frogipogi and ceramichello.

## Open

- **macOS.** Unsigned until there is a paid Developer ID
  ([#159](https://github.com/kollektiv-mc/Kommands/issues/159)); the tile links the DMG the
  release workflows build once that lands.
- **The hosted app's URL**, which **Open Dashboard** on a separately hosted page would need.
- **Konnekt's Scheduler** has no way today to pick a command linked from Kommands; the
  Konnekt scene shows one.
