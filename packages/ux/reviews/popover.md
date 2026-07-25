# `popover` review

Scope: `packages/ux/src/popover/**` (7 files).

## Counts

| Severity  | Found | Fixed |  Open |
| --------- | ----: | ----: | ----: |
| Critical  |     0 |     0 |     0 |
| High      |     3 |     3 |     0 |
| Medium    |     0 |     0 |     0 |
| Low       |     1 |     1 |     0 |
| **Total** | **4** | **4** | **0** |

Code changed: **yes**.

## Findings

- [High][Fixed] `anchorElement`: writing `null` directly left the popover
  detached instead of restoring `anchorFallbackElement`, contrary to the
  public atom contract and the anchor-record behavior.
  Why it matters: virtual-anchor users write this atom directly; clearing a
  selection or pointer anchor could leave an open popover with no positioning
  reference even though its disclosure remained mounted.
  Fix: normalize direct and functional writes that resolve to `null` to the
  current fallback, and make the anchor ref use that same atom contract. A
  regression covers direct virtual-anchor release.

- [High][Fixed] `applyPopoverPosition`: a placement flip set the new arrow edge
  but never cleared the previous dynamic edge.
  Why it matters: after a side flip, two opposing inset properties could both
  be `100%`, producing a stretched or misplaced arrow. Ariakit gets old-style
  cleanup from React; this direct DOM port must perform it itself.
  Fix: clear the previously possible `right` and `bottom` edges before setting
  the current side; `left` and `top` are already overwritten every pass. A
  regression positions the same arrow on two sides.

- [High][Fixed] `withFloating` auto-update callback: it discarded the promise
  returned by the abortable `position` action.
  Why it matters: rapid observer updates normally abort an older measurement;
  the discarded rejected promise could surface cancellation as an unhandled
  rejection.
  Fix: handle the fire-and-forget promise, suppress only abort errors, and
  continue surfacing real positioner failures.

- [Low][Fixed][Bundle size] `popoverPlacement.ts` and
  `reatomPopoverFloating.ts`: the private `PLACEMENT_PATTERN` binding and
  `request` helper each had one production call site; the auto-update callback
  also called `notify()` redundantly after starting an action.
  Why it matters: `@reatom/ux` ships a bundled headless primitive, so private
  one-use wrappers and dead notification work add avoidable output and
  indirection.
  Fix: inline the regex and request object, and remove the redundant
  notification. Public pure helpers remain exported because removing them
  would be an API change; model-only consumers can use the tree-shakeable
  `withPopover` extension without `withPopoverProps`.

## Reatom and lifecycle audit

- Every popover atom, computed, effect, and action is named; writes use `.set`.
- The position action wraps its injected promise and uses `withAbort()` for
  latest-measurement-wins behavior.
- DOM refs and the injected auto-update callback enter Reatom context through
  `wrap`; abort cleanup owns auto-update teardown and the `positioned` reset.
- Tests reset the default context in `beforeEach`. No stale v3 APIs, async
  status/retry misuse, mutable collection snapshots, or unscoped module effects
  exist in this scope.

## Verification

- Before the fixes, the two new regressions failed: direct anchor release
  returned `null`, and a bottom-to-right arrow flip retained `bottom: 100%`.
- `pnpm exec vitest run src/popover`: 3 files passed, 62 tests passed, no type
  errors.
- `pnpm exec vitest run --config=vitest.browser.config.ts src/popover`: 1 file
  passed, 3 Chromium tests passed.
- `pnpm run build`: ESM, CJS, and declaration builds passed.
- `pnpm exec prettier --check "src/popover/**/*.ts"`: passed.

## Residual risks

- The injected positioner and auto-update implementations remain consumer
  responsibilities; this package verifies their seam but does not exercise a
  real floating-ui middleware chain.
