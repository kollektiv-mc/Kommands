# Kommands: dependency policy and inventory

A decision record, not a lockfile mirror. Every direct dependency gets one line
saying why it is here. Removed or rejected candidates go under "Removed" with
the reason, so the same discussion does not happen twice.

## Policy

- Prefer the standard library, then what is already in the tree.
- A new dependency needs a reason a reviewer can check: what it does that the
  tree cannot reasonably do itself, and what it gets access to.
- Dependabot opens update PRs weekly (`.github/dependabot.yml`).

## Current inventory

### Go (`go.mod`, direct requires)

| Module                         | Why                                                                         |
| ------------------------------ | --------------------------------------------------------------------------- |
| `github.com/wailsapp/wails/v2` | The desktop shell: window, webview and Go bindings (`docs/distribution.md`) |

### npm (`./package.json`, direct dependencies)

| Package                                                         | Why                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `react`, `react-dom`                                            | The UI                                                                         |
| `@tanstack/react-router`                                        | Client-side routing                                                            |
| `zustand`                                                       | App state                                                                      |
| `three`, `@react-three/fiber`                                   | 3D previews, loaded only through a dynamic import (`docs/adding-a-preview.md`) |
| `@formkit/auto-animate`                                         | List and layout transitions                                                    |
| `@fontsource-variable/geist`, `@fontsource-variable/geist-mono` | Self-hosted brand fonts                                                        |

`devDependencies` are the build, type, lint, format and test tools: Vite,
TypeScript, ESLint, Prettier, Tailwind, Vitest, Testing Library, jsdom and tsx.

## Removed

| Dependency | Removed in | Why |
| ---------- | ---------- | --- |
