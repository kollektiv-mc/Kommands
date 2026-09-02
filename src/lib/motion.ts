/**
 * The millisecond value behind a duration token, for the JS half of a CSS-driven motion.
 *
 * A `setTimeout` that has to land with a transition cannot read
 * `var(--duration-panel)`, and the alternative — writing `280` into the component
 * beside a comment promising to keep it in step — is a copy of a **generated** value.
 * `tokens.css` is produced from `tokens.source.json`, which is vendored from kollektiv
 * and shared with Konnekt, so that copy drifts the first time the suite retimes
 * anything and nothing fails until someone watches a panel closely.
 *
 * So it is read back off the document, the same door
 * `previews/worldedit/shape/color.ts` takes to get `--accent` as a *value* rather than
 * a class. Konnekt answers this by generating a `tokens.ts` beside its `tokens.css`;
 * Kommands' generator emits only CSS, and adding a second generated artefact — with
 * its own clean-diff entry in `.claude/suite.json` — is a bigger change than the one
 * caller here justifies. If a second caller appears, generate it.
 *
 * `fallback` is not defensive padding. The custom property genuinely resolves to
 * nothing in an environment with no stylesheet — jsdom, which is where every test in
 * this repo runs — and a motion helper answering `NaN` there would turn a timer into
 * an immediate fire.
 */
export function durationMs(token: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  // Both CSS time units, because the token layer is free to spell 280ms as 0.28s and a
  // parser that knew only one would silently read that as 0.28 milliseconds.
  const match = /^([0-9.]+)(ms|s)$/.exec(raw)
  if (!match) return fallback
  const value = Number(match[1])
  if (!Number.isFinite(value)) return fallback
  return match[2] === 's' ? value * 1000 : value
}
