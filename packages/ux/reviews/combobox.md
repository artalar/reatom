# Combobox review

Scope: `packages/ux/src/combobox/**` (9 files).

## Counts

- Findings: 6 total — 0 critical, 3 high, 2 medium, 1 low.
- Resolution: 6 fixed, 0 open.
- Bundle-size checks: 2 single-use private helpers inlined; 1 dead module
  export removed.
- Code changed: yes.

## Findings

- [High][Fixed] `reatomCombobox.autoSelectFirst`: every value change emitted
  `composite.move(firstId)`, even when that same item was already active.
  Why it matters: `withCompositeFocus` observes move calls rather than state
  changes, so auto-select focused the input again on every keystroke. This is
  the mobile-keyboard failure mode where repeated focus drops characters while
  the available viewport and rendered list are changing.
  Fix: synchronize `activeValue` without emitting another move when the target
  id is unchanged. A regression test observes one move across two keystrokes;
  it failed with two calls before the fix.

- [High][Fixed] `withComboboxAutoSelect`: the connect hook is attached to the
  combobox atom while its nested effect read that same atom.
  Why it matters: an effect created by `withConnectHook(target)` must not depend
  on `target`, directly or indirectly. This creates a connect/subscription
  feedback edge and makes disconnect behavior depend on core connection
  ordering; the same pattern has produced recursive reconnects and leaked
  effects in other UX models.
  Fix: drop the `target()` read from the effect. The auto-select reacts to
  `autoSelecting` (armed on type) and the item list, plus the popover / focus
  guards — none of which derive from the value atom — so the effect no longer
  depends on its own hook target, and the connect hook now returns a cleanup
  that unsubscribes the effect on disconnect. The timing is unchanged (the
  effect still runs in the notify-flush phase), so no test changed.

- [High][Fixed] `props.input.onCompositionEnd`: composition end armed
  auto-select synchronously, and the input contract had no `onCompositionStart`
  handler to cancel a pending arm.
  Why it matters: Korean and other multi-step IMEs can end one composition and
  start the next in adjacent frames, and the effect could move focus between
  those events.
  Fix: `onCompositionEnd` now defers the arm to `requestAnimationFrame` (with a
  synchronous fallback under Node, which has no frame to race), and a new
  `onCompositionStart` cancels a pending arm — matching Ariakit. A stray frame
  that outlives the model only sets an atom, since the auto-select effect it
  feeds (`withComboboxAutoSelect`) unsubscribes on disconnect. A Chromium
  regression drives a two-composition sequence: it asserts the arm is deferred
  (not synchronous), cancelled when the next composition starts, and fired when
  the last one ends.

- [Medium][Fixed] `comboboxProps.itemOptions`: merely creating an item record
  stored its click policy forever. Unmounting it and later rendering the same
  value with defaults still inherited the old `hideOnClick`,
  `setValueOnClick`, and selection policy.
  Why it matters: item records are routinely replaced by filtering and
  conditional rendering; stale policy made click and Enter perform behavior
  belonging to an element no longer mounted.
  Fix: register options from the record ref while mounted, remove them on that
  ref's unmount, and pass the current record's options directly to its click
  transition. The regression failed before the fix because a later default
  record left the popover open.

- [Medium][Fixed] `ComboboxItemProps.onClick`: modifier-clicking a link item
  still selected its value and hid the popover.
  Why it matters: Ctrl/Cmd-click opens a navigation target in a new tab and
  Alt-click downloads it; Ariakit treats those as navigation, not combobox
  activation. Mutating selection makes an auxiliary navigation change the
  current page's form state.
  Fix: preserve the event's target/modifier fields and skip activation for
  Ariakit's anchor/submit navigation targets. A Ctrl-click regression failed
  before the fix.

- [Low][Fixed] `props.ts` and `reatomComboboxDom.ts`: `policy` and
  `elementValue` were private one-call helpers, while `isTouchDevice` was
  exported from the module despite being used only by `isTouchSafari` and not
  re-exported by the package barrel.
  Why it matters: `@reatom/ux` emits one unminified entry bundle; one-use
  closures and dead module exports add avoidable surface and indirection.
  Fix: inline both helpers and make the touch probe private. No additional
  root-level dead export is confirmed: the remaining runtime helpers are
  deliberately exposed by `src/index.ts`, so removing them is an API decision
  outside this scoped review.

## Async/context audit

The combobox has no awaited query or mutation flow. DOM callbacks and
microtasks correctly enter Reatom through `wrap`; `queueBeforeEvent` wraps both
its animation-frame/timer callback and event listener. There is no raw
`sleep`, missing `withAbort`, async status misuse, or abort-as-business-error
path in scope. The connect-hook finding is fixed; its lifecycle nuance is noted
under residual risks.

## Verification

- `pnpm -F @reatom/ux exec vitest run src/combobox`: 4 files passed, 119 tests
  passed, no type errors.
- `pnpm -F @reatom/ux exec vitest run --config=vitest.browser.config.ts src/combobox`:
  1 file passed, 10 Chromium tests passed.

## Residual risks

- The self-dependent connect effect remains sensitive to core lifecycle
  behavior until a safe connection anchor or extension is available.
