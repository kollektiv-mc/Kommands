# Minecraft versions

**Read this before writing or changing any serializer.** It is the file that
prevents syntax bugs.

Kommands currently targets **Java Edition 1.21.1** only. Everything below is
modelled so that adding a version is a data change.

---

## Two independent axes

Version handling is often mis-modelled as a single sequence of "eras". It is two
separate things, and conflating them produces wrong output:

| Axis                  | Question                  | Where it lives                                 |
| --------------------- | ------------------------- | ---------------------------------------------- |
| **Syntax traits**     | _How_ is a value written? | `src/data/versions/<version>.ts` → `traits`    |
| **Registry contents** | _Which_ values exist?     | `src/data/generated/<version>/registries.json` |

A command can be syntactically valid and still reference an item that does not
exist in the target version, or reference a real item using the wrong syntax.
Both axes must be checked.

---

## The trait matrix

Do **not** model this as an enum of eras. Each row is an independent flag. This is
not a stylistic preference: the changes do not land together, so an era enum
cannot represent reality. Attribute IDs changed at **1.21.2**, while the
enchantments and text-component changes landed at **1.21.5**.

| Trait                 | ≤ 1.20.4      | 1.20.5 – 1.21.1  | 1.21.2 – 1.21.4  | 1.21.5+      |
| --------------------- | ------------- | ---------------- | ---------------- | ------------ |
| `itemFormat`          | `nbt`         | `components`     | `components`     | `components` |
| `enchantmentsShape`   | n/a           | `levels-wrapper` | `levels-wrapper` | `flat`       |
| `attributeIdPrefix`   | `generic.`    | `generic.`       | _(none)_         | _(none)_     |
| `textComponentFormat` | `json-string` | `json-string`    | `json-string`    | `snbt`       |

**1.21.1 is the second column.** It sits between two breaking changes, so it is
easy to get wrong in both directions — by emitting pre-1.20.5 NBT, or by emitting
post-1.21.5 flattened syntax.

### What each trait changes

**`itemFormat`**

```
nbt          minecraft:netherite_sword{Enchantments:[{id:"sharpness",lvl:5}]}
components   minecraft:netherite_sword[enchantments={levels:{sharpness:5}}]
```

**`enchantmentsShape`** — the `levels` wrapper, and the `show_in_tooltip` field
that lives alongside it, were removed in 1.21.5.

```
levels-wrapper   [enchantments={levels:{sharpness:5},show_in_tooltip:true}]
flat             [enchantments={sharpness:5}]
```

**`attributeIdPrefix`** — every one of the 31 attribute IDs was renamed in 1.21.2.
This is a total rename, not an addition:

```
generic.   generic.armor  generic.attack_damage  generic.max_health
(none)     armor          attack_damage          max_health
```

**`textComponentFormat`** — `custom_name`, `item_name`, and `lore` carry a text
component. Before 1.21.5 that is a _quoted JSON string_; from 1.21.5 it is SNBT.

```
json-string   [custom_name='{"text":"Excalibur","color":"gold"}']
snbt          [custom_name={text:"Excalibur",color:"gold"}]
```

The Minecraft Wiki keeps a separate page,
[Text component format/Before Java Edition 1.21.5](https://minecraft.wiki/w/Text_component_format/Before_Java_Edition_1.21.5),
for the older form. 1.21.1 uses that page.

---

## Canonical 1.21.1 output

Use these as regression fixtures. If a serializer change breaks one of these, the
change is wrong.

```
/give @p minecraft:netherite_sword[enchantments={levels:{sharpness:5}}] 1

/give @p minecraft:diamond_pickaxe[custom_name='{"text":"Digger","color":"aqua"}',enchantments={levels:{efficiency:5,unbreaking:3}}]

/give @p minecraft:diamond_chestplate[attribute_modifiers={modifiers:[{type:"minecraft:generic.armor",amount:4,operation:"add_value",slot:"chest",id:"kommands:bonus"}]}]

/tellraw @a {"text":"Server restarting","color":"red","bold":true}

/execute as @a at @s run particle minecraft:flame ~ ~1 ~ 0.2 0.2 0.2 0 10
```

Note `minecraft:generic.armor` in the attribute example — the `generic.` prefix is
required in 1.21.1 and forbidden from 1.21.2.

---

## Registry drift

Registry contents move independently of syntax, and entries are **removed** as well
as added. Measured between the 1.21.1 and 1.21.5 mcmeta summaries:

| Registry        | 1.21.1 | 1.21.5 | Added | Removed |
| --------------- | ------ | ------ | ----- | ------- |
| `item`          | 1333   | 1396   | 63    | 0       |
| `entity_type`   | 130    | 150    | 23    | **3**   |
| `attribute`     | 31     | 32     | 32    | **31**  |
| `particle_type` | 109    | 114    | 5     | 0       |
| `enchantment`   | 42     | 42     | 0     | 0       |
| `mob_effect`    | 39     | 39     | 0     | 0       |

Because entries are removed, a shared "latest" registry would offer the user values
that do not exist in their target version. Registries are therefore pinned per
version and never merged.

---

## Rules for serializer code

1. **Never compare version numbers.** Branch on a trait:

   ```ts
   // wrong — breaks silently when 1.21.2 is added
   if (version === '1.21.1') { … }

   // right
   if (traits.enchantmentsShape === 'levels-wrapper') { … }
   ```

   `/suite-kit:health` greps for version-literal comparisons in `src/`.

2. **Never hardcode a game value.** Read it from the version's registry.

3. **Adding a trait is allowed; adding an era is not.** If a new version differs in
   a way no existing trait captures, add a trait flag and give every existing
   version an explicit value for it.

See [`adding-a-version.md`](adding-a-version.md) for the procedure.

---

## Sources

- [misode/mcmeta](https://github.com/misode/mcmeta) — `<version>-summary` tags,
  the source of all registry and command data
- [Data component format](https://minecraft.wiki/w/Data_component_format)
- [Text component format](https://minecraft.wiki/w/Text_component_format) and its
  [pre-1.21.5 page](https://minecraft.wiki/w/Text_component_format/Before_Java_Edition_1.21.5)
- [NeoForge 1.21.5 migration primer](https://github.com/neoforged/.github/blob/main/primers/1.21.5/index.md)
  — confirms `ItemEnchantments#showInTooltip` removal
