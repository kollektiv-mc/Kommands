'use strict';

const AUTH_USERS_KEY   = 'mcgen_users';
const AUTH_SESSION_KEY = 'mcgen_session';
// Hard ceiling for the UNLIMITED (Infinity) history tier only — keeps localStorage
// bounded. Must stay ABOVE the largest finite tier cap (diamond = 100) so an unlimited
// tier never effectively stores fewer entries than a paid finite tier (monotonic
// invariant). Finite tiers slice to their own tierFeatures().commandHistory value.
const HISTORY_LIMIT    = 200;
// The single definition of the tier order, consumed by shared/tiers.js.
// 'free' is the base tier; a user record stores null (no subscription) or one of
// these — getUserTier() returns null when unset, which tiers.js maps to 'free'.
const TIER_ORDER       = ['free', 'copper', 'iron', 'gold', 'diamond', 'netherite'];

// ── Storage ───────────────────────────────────────────────────────────────────

function _getUsers() {
  try { return JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || '[]'); }
  catch { return []; }
}

function _saveUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function _hash(pw) {
  return btoa(unescape(encodeURIComponent(pw)));
}

function _uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Session ───────────────────────────────────────────────────────────────────

function getSession() {
  try { return localStorage.getItem(AUTH_SESSION_KEY) || null; }
  catch { return null; }
}

function getCurrentUser() {
  const id = getSession();
  if (!id) return null;
  return _getUsers().find(u => u.id === id) || null;
}

function _setSession(id) {
  localStorage.setItem(AUTH_SESSION_KEY, id);
}

function logout() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function _patchUser(patch) {
  const id = getSession();
  if (!id) return false;
  const users = _getUsers();
  const i = users.findIndex(u => u.id === id);
  if (i === -1) return false;
  Object.assign(users[i], patch);
  _saveUsers(users);
  return true;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function signUp(username, email, password) {
  if (!username || !username.trim()) return { error: 'Username is required.' };
  if (!email    || !email.trim())    return { error: 'Email is required.' };
  if (!password)                     return { error: 'Password is required.' };
  if (password.length < 6)           return { error: 'Password must be at least 6 characters.' };

  const users = _getUsers();
  if (users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()))
    return { error: 'An account with that email already exists.' };

  const user = {
    id:           _uid(),
    username:     username.trim(),
    email:        email.trim().toLowerCase(),
    passwordHash: _hash(password),
    joinedAt:     new Date().toISOString().slice(0, 10),
    tier:         null,
    presets:      [],
    collections:  [],
    history:      [],
  };
  users.push(user);
  _saveUsers(users);
  _setSession(user.id);
  return { user };
}

function signIn(email, password) {
  if (!email || !password) return { error: 'Email and password are required.' };
  const users = _getUsers();
  const user  = users.find(
    u => u.email.toLowerCase() === email.trim().toLowerCase()
      && u.passwordHash === _hash(password)
  );
  if (!user) return { error: 'Incorrect email or password.' };
  _setSession(user.id);
  return { user };
}

// ── Tier ──────────────────────────────────────────────────────────────────────

function getUserTier() {
  const user = getCurrentUser();
  return (user && TIER_ORDER.includes(user.tier)) ? user.tier : null;
}

function setUserTier(tier) {
  _patchUser({ tier: TIER_ORDER.includes(tier) ? tier : null });
}

// ── Presets ───────────────────────────────────────────────────────────────────

// Tier cap is the SINGLE source of truth via tierFeatures().savedPresets. Guarded so
// a page that loads auth.js without tiers.js fails CLOSED (cap 0 → no saves) rather
// than throwing. Returns { id } on success, { error } on refusal (logged-out, empty
// name, or at/over cap). free's cap is 0 → length 0 >= 0 → always refuses.
function _presetCap() {
  return (typeof tierFeatures === 'function') ? tierFeatures().savedPresets : 0;
}

function savePreset(name, command, generator) {
  const user = getCurrentUser();
  if (!user)             return { error: 'Sign in to save presets.' };
  if (!name || !name.trim()) return { error: 'Enter a preset name.' };
  if ((user.presets || []).length >= _presetCap())
    return { error: 'Preset limit reached for your plan.' };

  const preset = {
    id:        _uid(),
    name:      name.trim(),
    command:   command.trim(),
    generator: generator || 'give',
    savedAt:   new Date().toISOString().slice(0, 10),
  };
  _patchUser({ presets: [...(user.presets || []), preset] });
  return { id: preset.id };
}

function deletePreset(id) {
  const user = getCurrentUser();
  if (!user) return false;
  return _patchUser({ presets: (user.presets || []).filter(p => p.id !== id) });
}

function getPresets() {
  return getCurrentUser()?.presets || [];
}

// ── Collections ───────────────────────────────────────────────────────────────

function createCollection(name) {
  const user = getCurrentUser();
  if (!user) return null;
  const col = {
    id:        _uid(),
    name:      name.trim(),
    presetIds: [],
    createdAt: new Date().toISOString().slice(0, 10),
  };
  _patchUser({ collections: [...(user.collections || []), col] });
  return col.id;
}

function deleteCollection(id) {
  const user = getCurrentUser();
  if (!user) return false;
  return _patchUser({ collections: (user.collections || []).filter(c => c.id !== id) });
}

function getCollections() {
  return getCurrentUser()?.collections || [];
}

// ── History ───────────────────────────────────────────────────────────────────

function addToHistory(command, generator) {
  const user = getCurrentUser();
  if (!user) return false;
  // Tier-driven: 0 = don't record at all; a finite cap is the exact ceiling; Infinity
  // falls back to HISTORY_LIMIT (a bounded ceiling > every finite tier). Guarded so a
  // page without tiers.js fails closed (cap 0 → no recording).
  const cap = (typeof tierFeatures === 'function') ? tierFeatures().commandHistory : 0;
  if (!(cap > 0)) return false;
  const limit = (cap === Infinity) ? HISTORY_LIMIT : cap;

  const entry = {
    id:        _uid(),
    command:   command.trim(),
    generator: generator || 'give',
    builtAt:   new Date().toISOString(),
  };
  const history = [entry, ...(user.history || [])].slice(0, limit);
  return _patchUser({ history });
}

function getHistory() {
  return getCurrentUser()?.history || [];
}

// ── Guards & nav ──────────────────────────────────────────────────────────────

function requireAuth(fallback) {
  if (getCurrentUser()) return true;
  // Clear any stale session key that has no matching user record.
  logout();
  location.replace(fallback || './auth.html');
  return false;
}

// Wipes all mcgen auth data from localStorage — call from the browser console
// to clear stale test data: _devReset()
function _devReset() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(AUTH_USERS_KEY);
}

// Sets html.authed / html.unauthed for CSS-driven nav visibility.
// Call this in a <head> script immediately after loading auth.js.
function initAuthNav() {
  document.documentElement.classList.add(getCurrentUser() ? 'authed' : 'unauthed');
}
