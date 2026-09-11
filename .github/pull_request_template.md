<!--
Title rules, because a merged pull request title becomes public release-notes
copy: imperative mood, sentence case, no trailing period, one line, no em
dashes. Say what changed, not which files moved. The label, not the title,
decides which section it lands in; .github/changelog.json says which paths
never reach what ships.

Keep one pull request to one concern.
-->

## Why

<!-- The problem or need this addresses. -->

## What changed

<!-- The shape of the change. Enough that a reviewer knows where to look. -->

## How it was verified

<!-- What you actually ran, and what it said. Name the gates: pnpm typecheck /
lint / test / format:check, go vet / go test over shell/, /suite-kit:health, or
a manual check in the running app. -->

---

<!--
Which label. Ask these in order and stop at the first yes:

  1. Can a user of Kommands tell the difference? If nothing they can see, run or
     click changed, it is type:chore - or type:docs when the change is
     documentation and nothing else. Refactors, tests, CI, tooling and
     dependency bumps stop here, however large the diff.
  2. Was Kommands already meant to do this, and not doing it? Then it is
     type:bug, even when the repair adds new files or new UI.
  3. Otherwise it is type:feature: the app can now do something it never
     offered.

The full ladder is kollektiv's docs/conventions.md, "Which type: label".
-->

- [ ] Labelled by the test above rather than by the title's verb: `type:feature`, `type:bug`, `type:docs` or `type:chore`.
- [ ] Labelled with an `area:` too, from kollektiv's `design/labels.json`. CI's `pr-labelled` job checks the two separately and fails on either.
- [ ] One concern.
- [ ] Generated files were regenerated rather than hand-edited (`src/data/generated/`, `src/styles/tokens.css`, lockfiles). A `fingerprints.json` diff was read, not regenerated past.
