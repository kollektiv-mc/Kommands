'use strict';

function escapeJson(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildJsonText(text, opts = {}) {
  const obj = { text };
  if (opts.color)         obj.color         = opts.color;
  if (opts.bold)          obj.bold          = true;
  if (opts.italic !== undefined) obj.italic = opts.italic;
  else                    obj.italic        = false;
  if (opts.underlined)    obj.underlined    = true;
  if (opts.strikethrough) obj.strikethrough = true;
  if (opts.obfuscated)    obj.obfuscated    = true;
  return JSON.stringify(obj);
}

function charCount(cmd) {
  const count = cmd.length;
  let status, label;
  if (count >= 256) {
    status = 'danger';
    label  = `${count} chars · requires command block`;
  } else if (count > 200) {
    status = 'warn';
    label  = `${count} chars · approaching chat limit`;
  } else {
    status = 'ok';
    label  = `${count} chars · runs in chat`;
  }
  return { count, status, label };
}

function copyToClipboard(text, btn) {
  return navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('ok');
    btn.textContent = 'copied';
    setTimeout(() => {
      btn.classList.remove('ok');
      btn.textContent = 'copy';
    }, 1800);
  });
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function updateCharCount(cmd, el) {
  const { status, label } = charCount(cmd);
  el.className = 'char-count' + (status !== 'ok' ? ' ' + status : '');
  el.textContent = label;
}

// Returns the lockable .btn-add inside `el` when the outline treatment applies:
// either `el` itself is a .btn-add, or it wraps exactly one .btn-add and no other
// interactive control (input/select/textarea). Such buttons get a tier-coloured
// outline + native-tooltip title instead of a "requires X" lock-tag span.
function _btnLockTarget(el) {
  if (el.classList && el.classList.contains('btn-add')) return el;
  const btns = el.querySelectorAll('.btn-add');
  if (btns.length === 1 && el.querySelectorAll('input, select, textarea').length === 0) {
    return btns[0];
  }
  return null;
}

// Paints the tier-outline lock (class + title tooltip) on a qualifying .btn-add in
// place of a .lock-tag. Returns true when it handled `el`, false to fall through to
// the normal lock-tag path.
function _lockButtonOutline(el, minTier) {
  const btn = _btnLockTarget(el);
  if (!btn) return false;
  btn.classList.add(`btn-locked-${minTier}`);
  // Disabled buttons suppress title in Chrome; wrap in a span to carry the tooltip.
  if (!btn.parentElement.classList.contains('btn-lock-wrap')) {
    const wrap = document.createElement('span');
    wrap.className = 'btn-lock-wrap';
    btn.parentElement.insertBefore(wrap, btn);
    wrap.appendChild(btn);
  }
  btn.parentElement.title = `requires ${minTier}`;
  return true;
}

// ── Tier gating primitive (see shared/tiers.js + TIERS.md) ──────────────────────
// Disables every control in `el` and appends a "requires X" tag (in the tier color)
// to its .block-label. The locked section stays visible — never hide what's gated.
//   el      — a DOM element (typically a .block div)
//   minTier — tier string, e.g. 'gold'
function lockSection(el, minTier) {
  el.classList.add('section-locked');
  el.querySelectorAll('input, select, button, textarea').forEach(i => {
    i.disabled = true;
  });

  const label = el.querySelector('.block-label');
  if (label && !label.querySelector('.lock-tag')) {
    const tag = document.createElement('span');
    tag.className = 'lock-tag';
    tag.style.color = `var(--${minTier})`;
    tag.textContent = `requires ${minTier}`;
    label.appendChild(tag);
  }
}

// ── Control-level tier gate (companion to lockSection) ──────────────────────────
// Gates a SINGLE control (or small group) INSIDE an otherwise-usable composite block
// — e.g. one .field-row or one .toggle-item — where the sibling controls stay live.
// Unlike lockSection it never touches a .block-label: it dims `el` itself, disables
// the controls within, and appends the inline "requires X" tag to `el`. Reuses the
// same .section-locked / .lock-tag styles.
//   el      — the control's wrapper (a .field-row or .toggle-item)
//   minTier — tier string, e.g. 'gold'
function lockControl(el, minTier) {
  if (!el) return;
  // A bare .btn-add carries its own disabled + visual state from the outline
  // treatment. Adding .section-locked to the button itself would dim it (parent
  // opacity) and block its tooltip (pointer-events:none), so skip straight to the
  // outline — never wrap a button in section-locked.
  if (el.classList.contains('btn-add')) {
    _lockButtonOutline(el, minTier);
    return;
  }
  el.classList.add('section-locked');
  el.querySelectorAll('input, select, button, textarea').forEach(i => {
    i.disabled = true;
  });
  // A wrapper holding a sole .btn-add gets a tier outline + tooltip instead of a lock-tag.
  if (_lockButtonOutline(el, minTier)) return;
  if (!el.querySelector('.lock-tag')) {
    const tag = document.createElement('span');
    tag.className = 'lock-tag';
    tag.style.color = `var(--${minTier})`;
    tag.textContent = `requires ${minTier}`;
    el.appendChild(tag);
  }
}

// ── Shared save-preset control (used by every generator) ────────────────────────
// Wires the fixed-id markup a generator drops in before its .output-block:
//   #preset-row (wrapper) · #preset-name (input) · #preset-save-btn · #preset-status
// Gating is by the savedPresets CAP ONLY — never the host generator's lock — so it
// lives outside any generator <main>. Caps/labels derive from tierFeatures() and
// minTierFor('savedPresets'); no tier strings are hardcoded here. No alert()/confirm().
function initPresetSaver(generatorKey) {
  const row    = document.getElementById('preset-row');
  const nameEl = document.getElementById('preset-name');
  const btn    = document.getElementById('preset-save-btn');
  const status = document.getElementById('preset-status');
  if (!row || !nameEl || !btn || !status) return;

  function note(text) { status.textContent = text; }

  function applyGate() {
    nameEl.disabled = false;
    btn.disabled    = false;

    // Logged-out: not a tier gate — point to sign in (built as a node, not innerHTML).
    if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
      nameEl.disabled = true;
      btn.disabled    = true;
      status.textContent = '';
      const a = document.createElement('a');
      a.href = '../../auth.html';
      a.textContent = 'sign in to save';
      status.appendChild(a);
      return;
    }

    const cap = (typeof tierFeatures === 'function') ? tierFeatures().savedPresets : 0;

    // Cap 0 (free): genuine tier gate → lock the row with a minTierFor-derived label.
    if (!(cap > 0)) {
      lockControl(row, minTierFor('savedPresets'));
      return;
    }

    const len = (typeof getPresets === 'function') ? getPresets().length : 0;
    if (len >= cap) {
      nameEl.disabled = true;
      btn.disabled    = true;
      note(`${len}/${cap} · upgrade to save more`);
      return;
    }
    note(cap === Infinity ? `${len} saved` : `${len}/${cap} saved`);
  }

  function save() {
    const out = document.getElementById('output');
    const res = savePreset(nameEl.value, out ? out.textContent : '', generatorKey);
    if (res.error) { note(res.error); return; }
    nameEl.value = '';
    note('saved ✓');
    setTimeout(applyGate, 1400);   // refresh count / flip to at-cap after the confirm
  }

  btn.addEventListener('click', save);
  nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  applyGate();
}
