# Minecraft Java 1.21.1 — command reference

One version-scoped reference for every generator's command syntax, components, and NBT.

**Target: vanilla 1.21.1 Java Edition only.** Uses the data-component format
introduced in 1.20.5; old NBT item syntax (`{Enchantments:[...]}`) must never be
generated. Cross-check every key against [minecraft.wiki](https://minecraft.wiki)
before implementing, and flag anything unconfirmed in code with `<!-- NOTE: verify -->`.

> **Build status:** `/give` (`generators/give/give.html`) and `/summon`
> (`generators/summon/summon.html`) are implemented. Every other generator below is
> **planned** — its tables are the target spec, not shipped behavior. The hub
> (`index.html`) marks unbuilt generators "soon".

> **Attribute IDs — verified for 1.21.1.** `give.html` and `data.js` use the prefixed
> form `generic.attack_damage`, `generic.max_health`, etc. This is correct for 1.21.1;
> the `generic.`/`player.`/`zombie.` prefix was dropped in 1.21.2+ (bare `max_health`).
> Confirmed against minecraft.wiki, Paper 1.21.1, and ViaVersion.

---

## /give — **BUILT**

```
/give <target> <item>[<component>=<value>, …] <count>
```

Component coverage. **Status** reflects what `give.html` emits today vs. what the
original spec still has planned:

| Component | Status | Notes |
|---|---|---|
| `custom_name` | built | JSON text — `[{"text":"…","italic":false}]` |
| `lore` | built | Array of JSON text lines |
| `rarity` | built | `common` / `uncommon` / `rare` / `epic` |
| `unbreakable` | built | `{}` |
| `enchantment_glint_override` | built | `true` |
| `hide_tooltip` | built | `{}` |
| `hide_additional_tooltip` | built | `{}` |
| `enchantments` | built | `{levels:{sharpness:5, …}}` |
| `attribute_modifiers` | built | See format below |
| `damage` | built | Integer |
| `max_damage` | built | Integer |
| `repair_cost` | built | Integer |
| `custom_data` | built | Raw SNBT passthrough |
| `stored_enchantments` | planned | For enchanted books |
| `food` | planned | `{nutrition:N,saturation:F,can_always_eat:true}` |
| `can_break` | planned | `{predicates:[{blocks:["minecraft:stone"]}]}` |
| `can_place_on` | planned | Same predicate format |
| `potion_contents` | planned | `{effects:[{id:"speed",amplifier:0,duration:200}]}` |
| `dyed_color` | planned | `{rgb:N}` — derive from hex picker |
| `fireworks` | planned | `{explosions:[…],flight_duration:N}` |
| `custom_model_data` | planned | Integer |

**Attribute modifier format:**
```
attribute_modifiers=[{type:"generic.attack_damage",slot:"mainhand",id:"custom:mod_0",amount:5.0,operation:"add_value"}]
```
Operations: `add_value` · `add_multiplied_base` · `add_multiplied_total`
Slots: `mainhand` · `offhand` · `hand` · `head` · `chest` · `legs` · `feet` · `armor` · `body` · `any`

**Name / lore JSON format:**
```
custom_name='[{"text":"Sword of Dawn","italic":false}]'
lore=['{"text":"A relic from the old world","italic":false}','{"text":"Handle with care","italic":false}']
```

---

## /summon — **BUILT**

```
/summon <entity_id> <x> <y> <z> {<nbt>}
```
Legacy entity NBT — entities were **not** migrated to the component format in 1.21.1.
Default position `~ ~ ~`. Every tag below verified against minecraft.wiki for Java
1.21.1, using the *Chunk format/Mob* and *Chunk format/Entity* page revisions that were
live during 1.21.1 (Jul–Sep 2024) — **not** the current wiki, which documents a later
format (see the version notes per tag).

| Tag | Type | Value (1.21.1) |
|---|---|---|
| `CustomName` | JSON-text string | `'{"text":"…"}'` — a `TAG_String`; became a compound only in 1.21.5 |
| `CustomNameVisible` | byte | `1b` |
| `Tags` | list[string] | `["tag1","tag2"]` — scoreboard tags |
| `NoAI` | byte | `1b` |
| `Invulnerable` | byte | `1b` |
| `Silent` | byte | `1b` |
| `NoGravity` | byte | `1b` |
| `Glowing` | byte | `1b` |
| `PersistenceRequired` | byte | `1b` |
| `IsBaby` | byte | `1b` (baby-capable mobs) |
| `Health` | float | `Health:20f` |
| `attributes` | list | `attributes:[{id:"generic.max_health",base:100.0}]` — see note |
| `active_effects` | list | `active_effects:[{id:"speed",amplifier:0b,duration:600}]` (opt. `ambient`/`show_particles`/`show_icon` bytes) — renamed from `ActiveEffects` in 1.20.2 (23w32a) |
| `HandItems` | list\[2\] | `[<mainhand>,<offhand>]` — merged into `equipment` only in 1.21.5 |
| `ArmorItems` | list\[4\] | `[<feet>,<legs>,<chest>,<head>]` |
| `HandDropChances` | list\[2\] float | `[0f,0f]` |
| `ArmorDropChances` | list\[4\] float | `[0f,0f,0f,0f]` — merged into `drop_chances` only in 1.21.5 |
| `Passengers` | list | `[{id:"…", …nested entity NBT…}]` |

**Equipment item stack** (1.20.5+ component item format; enchantments reuse shared
`ENCHANTS`):
```
{id:"minecraft:diamond_sword",count:1,components:{"minecraft:enchantments":{levels:{sharpness:5}}}}
```

**`attributes` shape — verified.** For 1.21.1 it is the lowercase `attributes` tag with
`id`/`base` keys, **and** the `generic.` prefix on the id:
```
attributes:[{id:"generic.max_health",base:100.0}]
```
This is neither the old `Attributes:[{Name,Base}]` (restructured to `id`/`base` in
1.20.5, *before* 1.21.1) nor the current wiki's unprefixed `id:"max_health"` (the
`generic.` prefix was dropped in 1.21.2 / 24w33a). Source: minecraft.wiki *Chunk
format/Mob* revision live during 1.21.1.

**Not emitted** (minimal, safe scope): attribute `modifiers` sub-list (base only),
`body_armor_item`, `Rotation` / `Motion` / `Fire`.

---

## /enchant — *planned*

```
/enchant <target> <enchantment> <level>
```
Fields: target selector · enchantment (searchable) · level (1–max). Applies only to
the item in hand. Show the equivalent `/give` snippet for reference. Validate: level
above the enchantment's max **warns**, does not block.

---

## /effect — *planned*

```
/effect give <target> <effect> <duration_seconds> <amplifier> [hideParticles]
/effect clear <target> [effect]
```
Fields: mode toggle · target · effect (searchable, color swatch) · duration in
seconds (show tick count) · amplifier (0 = level I) · hide-particles checkbox.
Presets: clear all · night vision (9999s) · invisibility (9999s) · resistance II (9999s).

---

## /particle — *planned*

```
/particle <name> <x> <y> <z> <dx> <dy> <dz> <speed> <count> [force|normal]
```
Fields: particle ID (searchable) · position · delta · speed · count · force/normal.
`dust` → extra color (hex) + size fields. `block` / `item` → extra block/item ID field.
(`data.js` `PARTICLES` flags which IDs take extra data via `extraData: true`.)

---

## /title — *planned*

Modes: `title` · `subtitle` · `actionbar` · `times` · `clear` · `reset`

```
/title <target> title <json_text>
/title <target> times <fadeIn> <stay> <fadeOut>
```
JSON text builder: content · color (named + hex) · bold/italic/underlined/
strikethrough/obfuscated · `extra:[…]` segments. Times in ticks with seconds shown
inline (20 ticks = 1s).

---

## /scoreboard — *planned*

| Tab | Command |
|---|---|
| `objectives add` | `/scoreboard objectives add <name> <criteria> [displayName]` |
| `objectives remove` | `/scoreboard objectives remove <name>` |
| `objectives setdisplay` | `/scoreboard objectives setdisplay <slot> [objective]` |
| `players set` | `/scoreboard players set <targets> <objective> <score>` |
| `players add` | `/scoreboard players add <targets> <objective> <score>` |
| `players remove` | `/scoreboard players remove <targets> <objective> <score>` |
| `players reset` | `/scoreboard players reset <targets> [objective]` |
| `players operation` | `/scoreboard players operation <targets> <obj> <op> <source> <srcObj>` |

Validate: objective name ≤ 16 characters (warn inline).
Criteria: `dummy` · `trigger` · `deathCount` · `playerKillCount` · `totalKillCount` ·
`health` · `food` · `air` · `armor` · `xp` · `level`.
Display slots: `list` · `sidebar` · `belowName` · `sidebar.team.{color}`.

---

## /tellraw — *planned*

```
/tellraw <target> <json_text>
```
Builder: list of text segments, each with content · color (named or `#rrggbb`) ·
bold/italic/underlined/strikethrough/obfuscated · click event (`run_command` ·
`suggest_command` · `open_url` · `copy_to_clipboard`) · hover event (`show_text` ·
`show_item` · `show_entity`). Also `translate` · `score` · `selector` · `keybind`
component types via a type dropdown. Live JSON preview beside the final command.

---

## NeoForge note

NeoForge 1.21.1 accepts the same data-component syntax (`item[component=value]`).
The item-ID field accepts arbitrary modded IDs — no special handling required.
