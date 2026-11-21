---
paths:
  - '.aislop/**'
  - '.aislopignore'
  - '.github/workflows/aislop.yml'
---

# The aislop gate

`scanaislop/aislop` (MIT, run through `npx`, nothing installed) scores the tree
for what AI-assisted code leaves behind. CI runs `aislop ci` through
`.github/workflows/aislop.yml`, a workflow locked by the AllesSandro template,
which pins aislop and ruff.

`.aislop/base.yml` is the policy, locked by the template and never edited here.
`.aislop/config.yml` extends it (`extends: ./base.yml`, and the `./` is
load-bearing) with this tree's size ratchet and, until the open findings close,
the score the tree had when the gate was adopted. `.aislopignore` lists what is
generated or locked and never scored.

A finding that is a documented exception gets an inline
`// aislop-ignore-next-line <rule> -- <reason>` beside it. A bare directive with
no reason is the thing to refuse in review.

**Never run `aislop fix`**: it deletes lines by regex and rewrites
`package.json`.
