---
paths:
  - 'go.mod'
  - 'go.sum'
  - 'package.json'
  - 'pnpm-lock.yaml'
  - 'agent_docs/DEPENDENCIES.md'
---

# Before adding a dependency

`agent_docs/DEPENDENCIES.md` is the policy and the inventory: one line of
rationale for every direct dependency, and what was considered and rejected.
Read it before adding anything, and record the addition there in the same pull
request.

- Prefer the standard library and what is already in the tree over a new
  package doing the same job.
- No new dependency for what a few lines can do.
- Every dependency is code that has to be vetted, updated and trusted. Justify
  anything that adds a new surface (network, filesystem, process execution).
- Dependabot opens the update PRs; do not bump versions by hand unless fixing
  something Dependabot cannot.
