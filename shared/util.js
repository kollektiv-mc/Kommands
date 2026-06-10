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

// ── Tier gating primitive (see shared/tiers.js + TIERS.md) ──────────────────────
// Dims the whole block (section-locked: opacity .35, pointer-events:none) and
// disables all controls inside. Used only for stand-alone blocks entirely behind a
// tier wall. Add buttons outside the block are handled by lockControl/enforceRowCap.
//   el      — a .block div
//   minTier — tier string, e.g. 'gold'
function lockSection(el, minTier) {
  el.classList.add('section-locked');
  el.querySelectorAll('input, select, button, textarea').forEach(i => {
    i.disabled = true;
  });
}

// ── Control-level tier gate ──────────────────────────────────────────────────────
// Gates a SINGLE control or wrapper inside an otherwise-usable block. Disables all
// controls, then marks the nearest .control-card ancestor with the tier outline and
// a data-lock-tip attribute that drives the CSS tooltip. Falls back to section-locked
// for elements without a .control-card wrapper (e.g. summon.html).
//   el      — the control or its wrapper (.field-row.control-card, .toggle-item.control-card, .btn-add)
//   minTier — tier string, e.g. 'gold'
function lockControl(el, minTier) {
  if (!el) return;
  if (el.matches('input, select, button, textarea')) el.disabled = true;
  el.querySelectorAll('input, select, button, textarea').forEach(i => { i.disabled = true; });
  const card = el.classList.contains('control-card') ? el : el.closest('.control-card');
  if (card) {
    card.classList.add(`lock-outline-${minTier}`);
    card.dataset.lockTip = `requires ${minTier}`;
  } else {
    el.classList.add('section-locked');
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
