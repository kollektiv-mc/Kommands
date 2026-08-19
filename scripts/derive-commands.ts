#!/usr/bin/env tsx
//
// Derive vanilla command skeletons and registries from the Brigadier command tree
// published by misode/mcmeta, pinned by version-summary tag.
//
// NOT IMPLEMENTED. Design in docs/architecture.md § Derivation; scope in
// https://github.com/kollektiv-mc/Kommands/issues/4.
//
// This stub exits non-zero deliberately. A stub that exited 0 and wrote nothing
// would make .claude/suite.json's `generated` clean-diff check pass against a
// src/data/generated that does not exist — a check reporting success while
// verifying nothing, which is the exact failure .claude/suite-check.py was
// written to prevent. The manifest entry is therefore removed until this lands;
// restoring it is part of #4's definition of done, tracked in
// docs/health-checklist.md § Open backlog.

console.error(
  'gen:commands is not implemented yet — see docs/architecture.md § Derivation and issue #4.',
)
process.exit(1)
