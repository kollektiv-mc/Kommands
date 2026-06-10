# Auth & profile subsystem

A client-side account layer: `auth.html` (sign in/up), `profile.html` (account
dashboard), and `shared/auth.js` (the logic + storage).

> **Demo-grade, not real security.** Everything runs in the browser against
> `localStorage`. Passwords are "hashed" with `btoa()` (base64 — reversible, not a
> hash). There is no server, no real authentication, and no payment integration.
> Treat it as UI scaffolding, not protection.

---

## `shared/auth.js`

Loaded **without `defer`** on every page, immediately followed by `initAuthNav()` in
a head `<script>` so nav renders in the correct state before content paints.

**Session & users**
- `signUp(username, email, password)` → `{user}` or `{error}` (min 6-char password,
  unique email).
- `signIn(email, password)` → `{user}` or `{error}`.
- `logout()` — clears the session.
- `getCurrentUser()` / `getSession()` — current user record / session id.
- `requireAuth(fallback)` — redirects to `fallback` (default `./auth.html`) if not
  signed in; used at the top of `profile.html`.
- `initAuthNav()` — adds `html.authed` / `html.unauthed`; CSS then shows/hides nav
  links marked `data-auth-show="in"` / `data-auth-show="out"`.
- `_devReset()` — console helper; wipes all mcgen auth data.

**Per-user data** (all stored on the user record)
- Tier: `getUserTier()` / `setUserTier()` — see [tiers.md](tiers.md).
- Presets: `savePreset(name, command, generator)` · `deletePreset(id)` · `getPresets()`.
- Collections: `createCollection(name)` · `deleteCollection(id)` · `getCollections()`.
- History: `addToHistory(command, generator)` · `getHistory()` — newest first, capped
  per tier (`tierFeatures().commandHistory`); the unlimited tier is bounded by
  `HISTORY_LIMIT = 200`. Generators call `addToHistory` from `copyCmd()`.

---

## Storage keys

| Key | Contents |
|---|---|
| `mcgen_users` | JSON array of user records: `{ id, username, email, passwordHash, joinedAt, tier, presets[], collections[], history[] }` |
| `mcgen_session` | id of the signed-in user |

---

## Pages

- **`auth.html`** — tabbed sign-in / sign-up; redirects to `profile.html` if already
  signed in (including on bfcache restore).
- **`profile.html`** — guarded by `requireAuth()`. Tabs: overview (stats), presets,
  history, subscription (tier carousel). Renders the tier badge from `getUserTier()`.

---

## Nav integration for new pages

```html
<script src="../../shared/auth.js"></script>
<script>initAuthNav();</script>
...
<a class="nav-link" href="../../auth.html"    data-auth-show="out">sign in</a>
<a class="nav-link" href="../../profile.html" data-auth-show="in">profile</a>
```

The `html.authed`/`html.unauthed` + `data-auth-show` rules live in `shared/style.css`.
