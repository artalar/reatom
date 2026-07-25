# Disclosure review

Scope: `packages/ux/src/disclosure/**`

## Findings

- [High][fixed] `withDisclosureAnimation`: the connect hook was attached to the
  disclosure atom while its nested effect read that same atom.
  Why it matters: the effect became a subscriber that prevented the atom from
  disconnecting. Unsubscribing `mounted` then entered a recursive connection
  loop; the regression test exhausted the Vitest worker heap before the fix.
  Fix: anchor the hook to `mounted`, which owns the rendering lifetime and is
  not read by the nested effect. Added a regression test proving the model and
  pending timeout disconnect.
- [Low][fixed] `reatomDisclosureDom.ts`: `FRAME_MS` and `afterPaint` were private,
  single-use declarations in a package marked `sideEffects: false`.
  Why it matters: unminified distribution output retains avoidable declaration
  and call overhead on a browser-facing path.
  Fix: inline both at the sole call site while retaining the timing rationale
  next to the code.

## Result

- Findings: 2 total — 1 high, 0 medium, 1 low.
- Open findings: 0.
- Code changed: yes.
- Residual risk: browser animation timing depends on real `requestAnimationFrame`
  and timer scheduling; the disclosure browser suite remains the end-to-end
  guard for that behavior.
