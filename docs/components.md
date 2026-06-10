# UI patterns

HTML/CSS building blocks for generator pages. **`shared/style.css` is the single
source of truth** — every class below is already defined there. Never copy token
values or component CSS into a page or into the docs; reference the classes and
`var(--token)`s directly. Page-specific tweaks go in a small `<style>` block (see
`give.html`, which narrows `.ench-row` columns).

All examples are extracted from the live files (`generators/give/give.html`,
`profile.html`, `auth.html`).

---

## Page shell

Required on every page, identical structure:

- **Navbar** (`.navbar` → `.nav-brand` + `.nav-links` → `.nav-link`). The current
  page's link gets `.active`. Sign-in/profile links toggle via
  `data-auth-show="out"` / `data-auth-show="in"` (see [auth.md](auth.md)).
- **Header** (`<header>` → `h1` + `p`) — 11px mono uppercase title, dim subtitle.
- **Footer** (`.footer`) — not sticky, sits below all content.

Root pages link with `./…`; generators (two levels deep) link with `../../…`.

---

## Content sections

```html
<div class="block">
  <div class="block-label">section name</div>     <!-- 10px mono uppercase -->
  <div class="field-row">
    <label>name</label>
    <input type="text" id="custom-name" oninput="buildCmd()">
  </div>
</div>
```

`.block` = a horizontal-ruled section. `.block-label` = its heading (ID of the
section follows the same kebab-case text). `.field-row` = label + control(s) on one
line. Grid helpers: `.two-col`, `.three-col`, `.toggle-grid` (checkbox grid).

Checkboxes use `.toggle-item` (label wrapping `<input type=checkbox>` + `<span>`).

---

## Add / remove list rows

The core dynamic pattern (lore lines, enchantment rows, attribute modifiers). A
`+ add` ghost button (`.btn-add`) appends a row; each row carries an `×` remove
button (`.btn-icon`). Every control wires `buildCmd` so the output stays live.

```js
function addLore() {
  const row = document.createElement('div');
  row.className = 'lore-row';                 // grid defined in style.css
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = 'lore text…';
  inp.addEventListener('input', buildCmd);
  const btn = document.createElement('button');
  btn.className = 'btn-icon';
  btn.textContent = '×';
  btn.addEventListener('click', () => { row.remove(); buildCmd(); });
  row.append(inp, btn);
  document.getElementById('lore-rows').appendChild(row);
  buildCmd();
}
```

Row grids (`.lore-row`, `.ench-row`, `.attr-row`) and their `.row-header` labels are
all in `style.css`. `buildCmd()` reads the rows back with
`document.querySelectorAll('#lore-rows .lore-row input')`.

---

## Selects (native + optgroup)

Dropdowns are native `<select>` styled by `style.css` (custom arrow, focus border).
Group long lists with `<optgroup>`. The enchant grouping is **derived from `data.js`**
— sort `ENCHANTS` by `order`, bucket by `category` (shared by `give.html` and
`summon.html`; no local list):

```js
const ENCHANT_CATS = (() => {
  const cats = [], byLabel = {};
  [...ENCHANTS].sort((a, b) => a.order - b.order).forEach(e => {
    if (!byLabel[e.category]) { byLabel[e.category] = { label: e.category, enchants: [] }; cats.push(byLabel[e.category]); }
    byLabel[e.category].enchants.push(e.id);
  });
  return cats;            // → one <optgroup> per category, in curated order
})();
```

> **Searchable dropdown: not yet implemented.** The original spec calls for
> type-to-filter dropdowns; nothing in the codebase does this yet. Until a shared
> primitive exists, use native `<select>` + `<optgroup>`. Build the searchable
> version once, in `shared/`, when a generator first needs it — don't hand-roll it
> per page.

---

## Output block

Sticky bottom section: command box + char-count + copy button. Uses the real
classes (`.output-block`, `.output-label`, `.output-cmd`, `.output-footer`,
`.char-count`, `.btn-copy`) — **no inline `style`**.

```html
<div class="output-block">
  <div class="output-label">command output</div>
  <div class="output-cmd" id="output"></div>
  <div class="output-footer">
    <span class="char-count" id="char-count"></span>
    <button class="btn-copy" id="copy-btn" onclick="copyCmd()">copy</button>
  </div>
</div>
```

Char-count thresholds (256-char chat limit) and copy/`.ok` feedback are handled by
`updateCharCount()` and `copyToClipboard()` in `shared/util.js` — see
[js-architecture.md](js-architecture.md). Don't reimplement them inline.

---

## Tabs

Used in `profile.html` and `auth.html` (and any multi-section generator). Classes:
`.tab-bar` → `.tab-btn` (`.active`) controlling `.tab-panel` (`.active`).

```js
function showTab(btn, id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-' + id).classList.add('active');
}
```

---

## Other shared classes

`.tag` / `.tag-list` / `.tag-remove` (chips) · `.tier-badge.<tier>` · `.empty-state`
(empty lists/panels) · `.hint` (10px helper text under a field) · `.section-locked` +
`.lock-tag` (tier gating — dimmed/disabled block or control with an inline
`requires <tier>` tag; applied by `lockSection`/`lockControl`, see
[js-architecture.md](js-architecture.md)). Tier accent colors are
`var(--copper|iron|gold|diamond|netherite)`.

---

## Canonical layer

`shared/style.css` (classes + tokens), `shared/util.js` (helpers), and
`shared/data.js` (registries) are the canonical shared layer. Both built generators
(`give.html` and `summon.html`) load and use it — `escapeJson`, `updateCharCount`,
and `copyToClipboard` from `util.js`, and the registries from `data.js`. New
generators **must** do the same rather than reimplementing these per page (see
[js-architecture.md](js-architecture.md)).
