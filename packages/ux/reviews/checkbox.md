# Checkbox review

## TL;DR

- Critical: 0
- High: 1
- Medium: 2
- Low: 3
- Total: 6 (6 fixed, 0 open)

## Findings

- [High] `CheckboxModel.item` and the generic `reatomCheckbox` overload: Review-time issue (fixed): the public types accepted item values outside the model's declared state and scalar states that omitted the `false` unset value. For example, `reatomCheckbox<Array<number>>(...).item('not-a-number')` wrote a string into the number array, while `reatomCheckbox<string>(...).item('small').toggle()` returned `false` under a declared `string` return type.
  Why it matters: the action and atom contracts promised `T` while the built-in transition could produce a value outside `T`, allowing incorrect state to cross typed application boundaries.
  Fix: derive the accepted item value from `T`, require scalar group states to include `false`, and cover both constraints with type tests.

- [Medium] `checkboxProps().control.onClick`: Review-time issue (fixed): a disabled custom checkbox guarded the model transition but did not call `preventDefault` or `stopPropagation`; Ariakit's custom click path reaches the same disabled event guard as its change path.
  Why it matters: `aria-disabled` does not disable DOM behavior, so the click could still activate an enclosing link, form behavior, or delegated application handler despite the control claiming to be disabled.
  Fix: cancel and stop disabled custom clicks before returning, with a regression test.

- [Medium] `reatomCheckbox().item`: Review-time issue (fixed): numeric and string values with the same rendering received identical trace names; `item(1)` and `item('1')` are distinct cached models but were both named `${name}#1`.
  Why it matters: Reatom logging and attribution could not distinguish the two supported values in a mixed `Array<string | number>` group.
  Fix: the item name now encodes the value type through the shared `encodeTypedValueKey` (`interactions/valueKey.ts`, the same scheme `radioItemId` uses), so `item(1)` is `${name}#n-31` while `item('1')` stays `${name}#1`; covered by a regression.

- [Low] `reportedChecked`: Review-time issue (fixed): this private helper had one call site and only performed a small property type guard.
  Why it matters: the extra function and symbol add indirection and bytes without reuse or a separate semantic boundary.
  Fix: inline the narrowing in `onChange`.

- [Low][Fixed] `adoptAtom`: The same pass-through `createAtom`/`withMiddleware` helper was duplicated in checkbox, radio, combobox, and select.
  Why it matters: every copy contributed implementation and documentation bytes to the single `@reatom/ux` bundle and could drift independently.
  Fix: moved to `interactions/adoptAtom.ts`; the four models now import the one shared helper.

- [Low] `checkbox.test.ts` adopted-atom reactivity test: Review-time issue (fixed): the test called `.subscribe()` on an `effect`, although effects self-subscribe at creation, then disconnected only the redundant subscription.
  Why it matters: it models effect ownership incorrectly and leaves the actual effect connected until the next `context.reset()`.
  Fix: retain the effect itself and call its `.unsubscribe()` lifecycle method.

## Residual risks

- JavaScript callers can still provide an item value incompatible with the current state because the new invariant is compile-time only.
- `reatomCheckboxElementSync` relies on consumers calling `unsubscribe()` at unmount; the browser tests cover the documented lifecycle, not forgotten cleanup in adapters.
