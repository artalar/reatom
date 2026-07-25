# `tooltip` review

Scope: `packages/ux/src/tooltip/**` (7 files).

## Counts

| Severity  | Found | Fixed |  Open |
| --------- | ----: | ----: | ----: |
| Critical  |     0 |     0 |     0 |
| High      |     2 |     2 |     0 |
| Medium    |     0 |     0 |     0 |
| Low       |     1 |     1 |     0 |
| **Total** | **3** | **3** | **0** |

Code changed: **yes**.

## Findings

- [High][Fixed] `withTooltip`: an atom that was already `true` when extended
  never activated itself in the registry because `withChangeHook` observes only
  later transitions.
  Why it matters: the initially visible tooltip reported `active() === false`;
  another tooltip could open without closing it, violating the model's
  one-tooltip-at-a-time contract.
  Fix: activate an initially open target after installing the hook. Added a
  takeover regression for an adopted, initially `true` atom.

- [High][Fixed] `tooltipProps.anchor.onMouseMove`: a zero-delay show still
  entered the async `showDelayed` action. Re-entering before that action's
  already-resolved promise settled made `withAbort()` reject the first call as
  concurrent and surface an unhandled `AbortError`.
  Why it matters: the normal Escape-then-rehover path produced a global
  unhandled rejection; Vitest failed despite all behavior assertions passing.
  Fix: apply zero-delay shows synchronously, using the existing direct
  `showNow` path. The isolated regression and full tooltip runs now finish
  without unhandled errors.

- [Low][Fixed][Bundle] `describeFocusTarget`, `isAnchorTarget`,
  `isFocusLeavingAnchor`, and `latch`: four private helpers each had one call
  site.
  Why it matters: once-used wrappers retain avoidable functions and indirection
  in a headless primitive bundle.
  Fix: inline all four at their call sites. Public helpers remain separate
  because removing or privatizing them would change the package API.

## Reatom audit

- Tooltip-created atoms, computeds, and actions are named and nested under their
  model or registry.
- Writes use `.set`; reactive derivations use `computed` or `withComputed`.
- Prop-record callbacks that enter from the DOM use `wrap`.
- The registry release awaits `wrap(sleep(timeout))`, uses `withAbort()` for
  last-in-win cancellation, and treats abort as normal only at the intentional
  fire-and-forget boundary.
- Tests reset the shared default context in `beforeEach`.
- No eager effects, raw timers, stale APIs, mutable collection snapshots, cache
  ordering hazards, or unowned browser resources occur in scope.

## Verification

- `pnpm exec vitest run src/tooltip`: 3 files passed, 55 tests passed, no type
  errors.
- `pnpm exec vitest run --config=vitest.browser.config.ts src/tooltip`: 1 file
  passed, 10 tests passed in Chromium.
- `pnpm run build`: passed.
- `git diff --check -- packages/ux/src/tooltip`: passed.

## Residual risks

No open findings remain in the reviewed scope.
