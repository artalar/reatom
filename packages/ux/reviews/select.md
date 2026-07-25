# Select review

Scope: `packages/ux/src/select/**` (10 files).

## Counts

- Findings: 9 total — 0 critical, 4 high, 3 medium, 2 low.
- Resolution: 6 fixed, 3 open.
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

- [High][Open] `reatomSelect.itemId`: `idsByValue`, `valuesById`, and `idSeed`
  are closure state shared by every Reatom context.
  Why it matters: a module-level model reused across SSR requests can allocate
  IDs in request history order, while a fresh client allocates from one; the
  resulting server and hydration IDs can differ. `context.reset()` cannot clear
  these plain maps.
  Fix: make the registry context-owned without writing atoms during a view
  render, or move deterministic value-ID ownership into the collection. The
  combobox has the same registry and a searchable select delegates IDs to it,
  so a select-only rewrite would leave the public model internally
  inconsistent.

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

- [Medium][Open] `popupRole` item semantics: non-default roles can produce
  unsupported ARIA combinations, notably `role="menuitem"` with
  `aria-selected`, and `role="option"` under a `dialog` or direct `grid`.
  Why it matters: `aria-selected` is defined for options, rows, gridcells, and
  tabs, not plain menu items; the current comment claims menus announce
  selection through `aria-checked`, but no such prop is emitted.
  Fix: define role-specific item contracts (`menuitemcheckbox`/`aria-checked`,
  grid row/cell ownership, and dialog content) or narrow `popupRole` to the
  combinations this headless record can render correctly. That changes public
  markup types and is not a low-risk scoped patch.

- [Low][Fixed] `props.ts`, `reatomSelect.ts`, and `selectIntent.ts`: private
  `showBeforeKeyUp`, `navigateFromList`, `firstValue`, and `policy` helpers each
  had one call site; `ARROW_KEYS` allocated an array for one membership check.
  Why it matters: `@reatom/ux` emits one unminified entry bundle, so one-use
  declarations, calls, and allocations add avoidable bytes and indirection.
  Fix: inline the three flows, remove the stale policy map/helper entirely, and
  compare the four arrow keys directly.

- [Low][Open] `adoptAtom`: the pass-through `createAtom`/`withMiddleware`
  implementation is duplicated in checkbox, radio, combobox, and select.
  Why it matters: all four copies ship in the package entry and can drift in
  update semantics and documentation.
  Fix: move it to a shared internal interactions module in a package-wide
  change. Inlining this nontrivial helper would preserve the duplicated bytes;
  editing the shared modules is outside this review's scope.

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

- SSR/hydration identity remains dependent on closure-owned allocation until
  select and combobox adopt one context-safe registry design.
- Alternate popup roles remain an expert-only escape hatch without a complete
  role-specific item prop contract or accessibility-tree browser coverage.
