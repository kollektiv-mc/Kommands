# Contributing to Kommands

## Pull requests

- One pull request per piece of work, not one per tweak. Split only when a
  part is risky on its own, has to be revertable on its own, or ships at a
  different time.
- List the changes in the body's `## Changelog` section, one `- type: text`
  line each. The types are `feature`, `fix` (or `bug`), `chore`, `docs` and
  `skip`; `chore` and `docs` lines are counted in the release notes rather
  than listed.
- A pull request with no section is one change: its `type:` label files it
  and its title is its line. The `pr-labelled` status passes it with a warning
  that the notes will use the title.
- Changelog lines and titles become release-notes copy: imperative, sentence
  case, no trailing period, no em dashes. Say what changed for a user, not
  which files moved.
- Label every pull request with at least one `area:` label. The `pr-labelled`
  status stays pending until it has that and either a Changelog section or a
  `type:` label.

### Which type

Ask in order and stop at the first yes:

1. Can a user tell the difference? If not, it is `type:chore`, or `type:docs`
   when only documentation changed.
2. Was the project already meant to do this and not doing it? `type:bug`.
3. Otherwise `type:feature`.

The revert test settles most arguments: imagine the change reverted. Something
is broken again: bug. Something they never had is gone: feature. They cannot
tell: chore.

## Checks

Run `python3 .claude/suite-check.py` before opening a pull request. CI runs
CodeQL, Scorecard, the label gate and the template guard on every pull request.

## Template-managed files

Some files come from [AllesSandro](https://github.com/sandrogekeler/AllesSandro)
and are updated by Renovate PRs; `.claude/rules/template-files.md` lists them.
