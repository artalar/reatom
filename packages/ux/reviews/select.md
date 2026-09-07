# Select review

Scope: `packages/ux/src/select/**` (10 files).

## Counts

- Findings: 9 total — 0 critical, 4 high, 3 medium, 2 low.
- Resolution: 9 fixed, 0 open (1 fix is partial — see the `popupRole` note).
- Bundle-size checks: 3 single-use private helpers inlined; 1 single-use
  policy helper and its stale map removed; 1 one-use key array removed.
- Code changed: yes.

## Findings

- [High][Fixed] `SelectItemProps.disabled`: disabled items were skipped by
  navigation but their click, focus, and hover handlers still selected or
  activated them.
  Why it matters: a pointer could write a value that the model declares
  unavailable, and a custom element exposed no disabled state to assistive
  technology.
  Fix: expose `aria-disabled`, suppress autofocus, and guard click, focus, and
  hover against the item node's current disabled state. The regression failed
  before the fix because the disabled item had no ARIA state and remained
  activatable.

- [High][Fixed] `reatomSelect.itemId`: generated value IDs did not probe the
  composite collection, so a direct valueless item such as `fruit-item-1`
  could be silently reused for the first select value.
  Why it matters: two logical items then shared one collection node and reverse
  lookup assigned the existing node a value it never declared.
  Fix: advance the seed until both the composite collection and value registry
  confirm that the candidate is unused, with a collision regression.

- [High][Fixed] `SelectItemProps.onKeyDown`: a custom item in roving-tabindex
  mode did not activate on `Enter` or `Space`; its handler only mapped
  navigation keys.
  Why it matters: unlike a native button, the normal `div[role=option]` view
  emits no click from those keys, so keyboard users could focus an item but
  could not choose it.
  Fix: activate custom elements from the key handler while leaving native
  button/input/link activation to the browser. The node regression failed
  before the fix, and the Chromium roving-focus flow now exercises `Enter`.

- [High][Fixed] `reatomSelect.itemId`: `idsByValue`, `valuesById`, and `idSeed`
  were closure state shared by every Reatom context.
  Why it matters: a module-level model reused across SSR requests could allocate
  IDs in request history order, while a fresh client allocates from one; the
  resulting server and hydration IDs could differ. `context.reset()` cannot
  clear plain maps.
  Fix: derive the id from the value with `encodeValueKey`
  (`interactions/valueKey.ts`, mirroring `radioItemId`), and read the value back
  from the item's `text`. The counter and both maps are gone, so the id is a
  pure function of the value — identical across contexts, with no atom written
  during render. The combobox owns the shared registry and a searchable select
  delegates to it, resolving ids against the shared composite. A regression pins
  that two models allocating in a different order produce the same id. This
  reserves the value-id namespace (no probe), like `radio`.

- [Medium][Fixed] `selectProps.itemOptions`: merely asking for an item record
  stored its click policy forever, even after that record unmounted.
  Why it matters: a later default record for the same value inherited stale
  `hideOnClick` or `setValueOnClick` behavior from an element that no longer
  existed.
  Fix: remove the map and resolve each record's own overrides in its activation
  closure. The regression failed before the fix because a later default item
  left the popover open.

- [Medium][Fixed] `SelectItemProps.onClick`: modifier-clicking an anchor or
  submit item still changed the value and closed the popover.
  Why it matters: Ctrl/Cmd-click and Alt-click are navigation/download
  gestures; mutating the current page's select state is an unrelated side
  effect. Ariakit applies this rule to `SelectItem` as well as
  `ComboboxItem`.
  Fix: preserve target and modifier fields and skip activation for modified
  navigation targets, with a regression.

- [Medium][Fixed] `popupRole` item semantics: non-default roles produced
  unsupported ARIA combinations, notably `role="menuitem"` with `aria-selected`
  and `aria-selected` under a `grid`.
  Fix: `aria-selected` is now emitted only for `listbox` (`option`) and `tree`
  (`treeitem`) items — the roles where it is defined — and is `undefined` for
  `menu` / `grid` / `dialog`, so the record no longer renders invalid ARIA. A
  regression pins that each non-`listbox`/`tree` role omits it.
  Deferred (future PR): the richer per-role _contracts_ — `menuitemcheckbox` +
  `aria-checked` for menus, grid row/cell ownership, dialog content — are a
  self-contained accessibility enhancement, not a defect, and change public
  markup types, so they are out of this PR's scope.

- [Low][Fixed] `props.ts`, `reatomSelect.ts`, and `selectIntent.ts`: private
  `showBeforeKeyUp`, `navigateFromList`, `firstValue`, and `policy` helpers each
  had one call site; `ARROW_KEYS` allocated an array for one membership check.
  Why it matters: `@reatom/ux` emits one unminified entry bundle, so one-use
  declarations, calls, and allocations add avoidable bytes and indirection.
  Fix: inline the three flows, remove the stale policy map/helper entirely, and
  compare the four arrow keys directly.

- [Low][Fixed] `adoptAtom`: the pass-through `createAtom`/`withMiddleware`
  implementation was duplicated in checkbox, radio, combobox, and select.
  Why it matters: all four copies shipped in the package entry and could drift
  in update semantics and documentation.
  Fix: moved to `interactions/adoptAtom.ts`; the four models now import the one
  helper.

## Async/context audit

The select has no awaited query or mutation flow. DOM handlers enter Reatom
through `wrap`; the label microtask is wrapped, and `queueBeforeEvent` wraps its
timer/frame callback and registers its event through `onEvent`. There is no
missing `withAsyncData`, `withAbort`, fetch signal, retry/status option, or
abort-as-business-error path in scope. The context-local registry finding above
is synchronous ownership, not an async-frame loss.

## Verification

- Before the implementation fixes, the new unit regressions reproduced five
  failures: ID collision, stale click policy, modified-link activation,
  disabled activation, and custom-item keyboard activation.
- `pnpm -F @reatom/ux exec vitest run src/select`: 5 files passed, 105 tests
  passed, no type errors.
- `pnpm -F @reatom/ux exec vitest run --config=vitest.browser.config.ts src/select`:
  1 file passed, 7 Chromium tests passed.

## Residual risks

- Alternate popup roles remain an expert-only escape hatch without a complete
  role-specific item prop contract or accessibility-tree browser coverage.
