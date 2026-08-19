# Kommands

A command generator for Minecraft: Java Edition. Build `/give`, `/tellraw`,
`/execute`, and WorldEdit commands through a UI instead of memorising syntax —
with 3D previews for the commands that describe shapes.

Targets **Java Edition 1.21.1**.

## Why it is built this way

Minecraft command syntax changes in ways that are easy to get wrong. Between
1.21.1 and 1.21.5 the enchantments component was restructured, every attribute ID
was renamed, and text components moved from JSON strings to SNBT. A generator that
hardcodes syntax for one version silently emits invalid commands for every other.

So Kommands treats commands as **data**:

- **Command definitions are declarative.** Adding a command means adding a
  definition, not writing a page.
- **Vanilla definitions are derived** from the Brigadier command tree published by
  [misode/mcmeta](https://github.com/misode/mcmeta), pinned per version.
- **Game values are versioned data.** Item IDs, entities, enchantments, effects and
  particles come from per-version registries — nothing is hardcoded.
- **Syntax differences are trait flags**, not version comparisons, so supporting a
  new version is a data change rather than a refactor.

## Status

Early. This repo currently contains the architecture, schema, and contributor
docs; the application is not yet scaffolded. See [`docs/roadmap.md`](docs/roadmap.md)
for what is planned Now / Next / Later, and the
[issue tracker](../../issues) for what is in flight.

## Getting started

Once the app is scaffolded:

```sh
pnpm install
pnpm gen      # derive command data + design tokens
pnpm dev
```

## Documentation

| Document                                         | Contents                                                     |
| ------------------------------------------------ | ------------------------------------------------------------ |
| [Architecture](docs/architecture.md)             | How the system fits together, and the reasoning behind it    |
| [Command schema](docs/command-schema.md)         | The authoritative definition schema                          |
| [Minecraft versions](docs/minecraft-versions.md) | Syntax trait matrix — what differs per version               |
| [Adding a command](docs/adding-a-command.md)     |                                                              |
| [Adding a version](docs/adding-a-version.md)     |                                                              |
| [Adding a preview](docs/adding-a-preview.md)     |                                                              |
| [Design tokens](docs/design-tokens.md)           |                                                              |
| [Roadmap](docs/roadmap.md)                       |                                                              |
| [Suite](docs/suite.md)                           | The umbrella this repo belongs to, and the tooling it shares |

## Credits

Minecraft data is sourced from [misode/mcmeta](https://github.com/misode/mcmeta).
WorldEdit command definitions are authored from
[EngineHub/WorldEdit](https://github.com/EngineHub/WorldEdit) sources.

Not affiliated with Mojang, Microsoft, or EngineHub.
