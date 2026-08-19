# Adding a Minecraft version

Adding a version is **additive**: a new definition set plus trait values. If a step
here requires changing serializer control flow, the design has been violated —
stop and fix the trait model instead.

Read [`minecraft-versions.md`](minecraft-versions.md) first.

---

## Procedure

### 1. Confirm mcmeta has the version

```sh
git ls-remote --tags https://github.com/misode/mcmeta.git | grep summary
```

The tag is `<version>-summary`. If it does not exist, the version cannot be
derived yet.

### 2. Register the version

Add `src/data/versions/<version>.ts` with explicit values for **every** trait —
no inheritance, no defaults. A missing trait must be a type error, not a silent
fallback.

```ts
export const v1_21_5: VersionDefinition = {
  id: '1.21.5',
  mcmetaTag: '1.21.5-summary',
  traits: {
    itemFormat: 'components',
    enchantmentsShape: 'flat', // changed from 'levels-wrapper'
    textComponentFormat: 'snbt', // changed from 'json-string'
  },
}
```

### 3. Generate the data

```sh
pnpm gen:commands
```

Writes `src/data/generated/<version>/{commands,registries,blocks}.json`.

**Fix any hard errors before continuing.** An unmapped shallow parser fails the
build by design — it means the new version introduced a scalar type the deriver
does not understand. An unmapped _deep_ parser only warns and falls back to
`raw_text`.

### 4. Diff the registries

This is the step that catches silent breakage. Compare against the previous
version and look specifically for **removals**:

```sh
pnpm gen:diff 1.21.1 1.21.5          # a supported version, or a raw mcmeta tag
```

It groups each registry into outright removals, re-prefixings, and additions. That
middle group matters: a rename that only drops a category prefix reads as a total wipe
otherwise, and the 1.21.2 attribute change would show as 31 removed and 32 added with
the one genuinely new entry lost among them.

Removed entries mean commands that were valid before are now invalid. Additions are
harmless; removals and renames are not. The 1.21.2 attribute rename showed up here
as 31 removed and 32 added — and **only** here, since it is a registry change and no
trait describes it.

### 5. Handle syntax differences

For each trait that changed, the serializer should already branch on it. If a
difference is not captured by any existing trait:

1. Add the trait to the type.
2. Give **every** existing version an explicit value.
3. Branch on it in the serializer.

Adding a trait is expected. Adding an era enum, or a version-number comparison, is
not.

### 6. Add output fixtures

Add a canonical output block to [`minecraft-versions.md`](minecraft-versions.md)
and matching test fixtures. Every trait that differs from an existing version needs
at least one fixture demonstrating the difference — that is what stops a future
change from silently regressing this version.

### 7. Verify and commit

```sh
/suite-kit:health
```

Commit the generated data with the version definition, in one commit. The diff is
the record of what changed between Minecraft versions.

---

## Checklist

- [ ] mcmeta tag exists and is pinned
- [ ] Every trait has an explicit value — none inherited
- [ ] Generated data committed alongside the version definition
- [ ] Registry diff reviewed, **removals** specifically examined
- [ ] No version-number comparison introduced anywhere in `src/`
- [ ] Fixtures added for every differing trait
- [ ] `/suite-kit:health` passes

---

## If a version does not fit

Some changes are larger than a trait flag — a new argument parser, a restructured
component, a command that changes shape.

Handle it as: **new trait + new argument type + adapter**, still additive. The
existing version's behaviour must not change. If supporting a new version requires
editing how an old version serializes, that is a bug in the change, not a necessity
— surface it rather than working around it.
