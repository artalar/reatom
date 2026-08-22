# Radio review

Scope: `packages/ux/src/radio/**` (6 files).

## Counts

- Findings: 7 total — 0 critical, 2 high, 2 medium, 3 low.
- Resolution: 6 fixed, 1 open.
- Bundle-size checks: 1 single-use private helper inlined; 1 duplicated
  package-level helper (`adoptAtom`) moved to a shared module.
- Code changed: yes.

## Findings

- [High][Fixed] `RadioUnits.select`, `RadioUnits.item`, and `RadioOptions.items`:
  a narrowed model still accepted every `RadioValue`, including when its type
  was inferred from `valueAtom`. It also allowed a non-null state union with
  neither an initial value nor an adopted atom, so the runtime started at
  `null` under a non-null TypeScript contract.
  Why it matters: `reatomRadio<'free' | 'pro' | null>().item('team').select()`
  wrote `"team"` while reporting the narrowed return type, and
  `reatomRadio<'free' | 'pro'>({})()` reported a non-null union while returning
  `null`.
  Fix: derive item and selection inputs from `T`, add a value-atom-specific
  inference overload, narrow initial items, and require a value source when `T`
  excludes `null`. Type regressions cover each boundary.

- [High][Fixed] `radioItemId`: supported values were not unique identities.
  `1` and `"1"` produced the same id, as did `"a b"` and `"a/b"`; the
  five-value regression produced only three ids before the fix.
  Why it matters: the composite collection is keyed by id, so distinct radio
  models could update and navigate through the same item node. Duplicate DOM
  ids also break labels and `aria-activedescendant`.
  Fix: preserve ordinary string ids, but encode the value type and Unicode code
  points for numbers, unsafe strings, and reserved encoding-shaped strings.
  The resulting ids remain deterministic and contain only word characters and
  hyphens.

- [Medium][Fixed] `reatomRadio.createItem`: numeric and string values with the
  same rendering had identical trace names (`item(1)` and `item("1")` were both
  `${name}#1`).
  Why it matters: Reatom logs could not distinguish actions and computed state
  belonging to two different radios.
  Fix: derive the item-name segment from the same collision-free segment used
  by its id. Common names such as `plan#free` remain unchanged.

- [Medium][Fixed] `isRadioItemChecked`: strict equality meant a `NaN` radio
  could select `NaN` into the group state but could never report itself checked.
  Why it matters: `RadioItemValue` promises every `number`, and the item cache
  already uses JavaScript's SameValueZero key semantics.
  Fix: use SameValueZero comparison, matching the cache for both `NaN` and
  signed zero, with a regression assertion.

- [Low][Fixed] `ariaOrientation`: this private helper had one call site and only
  mapped `"both"` to `undefined`.
  Why it matters: the symbol and call added bytes and indirection without reuse
  or a separate semantic boundary.
  Fix: inline the conditional into the group prop record.

- [Low][Open] `isRadioItemChecked` without an `itemValue`: the Ariakit-compatible
  `Boolean(state)` fallback reports `false` for selected numeric states `0` and
  `NaN`, despite the local docs describing it as “something is selected.”
  Why it matters: the helper is exported and its public state type includes all
  numbers, although the model itself never creates a valueless radio.
  Fix: either remove the unused optional form in a deliberate API change, or
  define it as `state !== null` and document the intentional divergence from
  Ariakit. Port fidelity versus local semantics needs an API decision.

- [Low][Fixed] `adoptAtom`: the same pass-through
  `createAtom`/`withMiddleware` implementation was duplicated in radio,
  checkbox, combobox, and select.
  Why it matters: `@reatom/ux` emits one entry bundle, so each copy adds bytes
  and can drift independently.
  Fix: moved to `interactions/adoptAtom.ts`; the four models now import the one
  shared helper.

## Bundle and Reatom audit

`isRadioItemChecked`, `radioItemId`, `radioItemProps`, `radioProps`, and
`withRadioProps` remain exported package API; they are not private one-use
helpers that can be removed in a scoped refactor. The remaining private
functions have multiple call sites or own stable handler/model identity.

There is no awaited work in scope. DOM callbacks enter Reatom through `wrap`,
the element synchronization effect is created on demand with a documented
`unsubscribe()` lifecycle, `getCalls(model.select)` is consumed only in the
current effect batch, and every test suite resets the default context.

## Verification

- `pnpm -F @reatom/ux exec vitest run src/radio`: 3 files passed, 47 tests
  passed, no type errors.
- `pnpm -F @reatom/ux exec vitest run --config=vitest.browser.config.ts src/radio`:
  1 file passed, 8 Chromium tests passed.

## Residual risks

- JavaScript callers can still pass values outside an application-level union;
  that union has no runtime representation to validate against.
- `reatomRadioElementSync` depends on adapters calling `unsubscribe()` at
  unmount; the browser suite covers the documented lifecycle, not a consumer
  that forgets cleanup.
