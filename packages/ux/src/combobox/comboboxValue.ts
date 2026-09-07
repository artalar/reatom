/**
 * Layer 1 value policy for `combobox`: the pure functions behind the three
 * values a combobox juggles — what the user typed, what is selected, and what
 * the active item would complete the typing to.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): `isSelected` and the selection transition of
 * `packages/ariakit-react-components/src/combobox/combobox-item.tsx`, plus
 * `hasCompletionString`, `isFirstItemAutoSelected`, and the `value` memo of
 * `packages/ariakit-react-components/src/combobox/combobox.tsx`.
 *
 * Ariakit keeps all of them inside component bodies, where they can only be
 * tested by rendering a widget. Here they are plain data in, plain data out.
 */

/**
 * The value(s) of the selected item(s): a string for a single-selectable
 * combobox, an array of strings for a
 * [multi-selectable](https://ariakit.com/examples/combobox-multiple) one.
 *
 * The _shape_ is the mode: an array means multi-selectable, and that is what
 * flips the defaults of `resetValueOnSelect`, `resetValueOnHide`,
 * `setValueOnClick`, and `hideOnClick`. Ariakit makes the same inference with
 * `Array.isArray(selectedValue)`.
 */
export type ComboboxSelectedValue = string | ReadonlyArray<string>

/**
 * How the combobox completes what the user types, i.e. the standard
 * [`aria-autocomplete`](https://w3c.github.io/aria/#aria-autocomplete) values.
 *
 * - `list` (the default) — the items are filtered by the value, and the input
 *   value never changes on its own;
 * - `inline` — the items are static, and the input shows the active item's value
 *   while it is active;
 * - `both` — filtered items _and_ the inline completion;
 * - `none` — static items, no completion.
 */
export type ComboboxAutoComplete = 'list' | 'inline' | 'both' | 'none'

/** Whether the combobox selects several values, i.e. holds an array. */
export const isComboboxMultiSelectable = (
  selectedValue: ComboboxSelectedValue,
): boolean => Array.isArray(selectedValue)

/**
 * Whether one item is selected.
 *
 * @remarks
 *   Port of `isSelected` in `combobox-item.tsx`. `undefined` — not `false` — is
 *   Ariakit's answer for an item that has no value: such an item is not
 *   selectable at all, which is why it emits no `aria-selected` attribute.
 * @example
 *   isComboboxItemSelected('apple', 'apple') // true
 *   isComboboxItemSelected(['apple'], 'orange') // false
 *   isComboboxItemSelected('apple') // undefined — the item has no value
 */
export const isComboboxItemSelected = (
  selectedValue: ComboboxSelectedValue,
  itemValue?: string,
): boolean | undefined => {
  if (itemValue == null) return undefined
  if (Array.isArray(selectedValue)) return selectedValue.includes(itemValue)
  return selectedValue === itemValue
}

/**
 * The selected value after an item is picked: a toggle when the combobox is
 * multi-selectable, a replacement when it is not.
 *
 * @remarks
 *   Port of the `setSelectedValue` updater in `combobox-item.tsx`. The array
 *   branch appends at the end, so the selection order is the click order —
 *   which is what a tag list renders.
 * @example
 *   nextComboboxSelectedValue('apple', 'orange') // 'orange'
 *   nextComboboxSelectedValue(['apple'], 'orange') // ['apple', 'orange']
 *   nextComboboxSelectedValue(['apple', 'orange'], 'apple') // ['orange']
 *
 * @returns The next selected value. For an array it is always a new array, so
 *   the write is a real change even when the contents match.
 */
export const nextComboboxSelectedValue = <T extends ComboboxSelectedValue>(
  selectedValue: T,
  itemValue: string,
): T => {
  if (!Array.isArray(selectedValue)) return itemValue as T
  const values = selectedValue as ReadonlyArray<string>
  return (values.includes(itemValue)
    ? values.filter((value) => value !== itemValue)
    : [...values, itemValue]) as unknown as T
}

/** Whether {@link ComboboxAutoComplete} completes the value inline. */
export const isComboboxAutoCompleteInline = (
  autoComplete: ComboboxAutoComplete,
): boolean => autoComplete === 'inline' || autoComplete === 'both'

/**
 * Strips the diacritics of a string, so that `café` typed into a list of
 * unaccented items still completes.
 *
 * Port of Ariakit's `normalizeString` (`ariakit-utils/src/misc.ts`).
 */
const normalizeString = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Whether the active item's value continues what the user typed, i.e. whether
 * there is a completion string to append.
 *
 * @remarks
 *   Port of `hasCompletionString` in `combobox.tsx`. The comparison ignores case
 *   on both sides but diacritics only on the typed one, which is Ariakit's own
 *   asymmetry: an accent the user types is not required of the item, while an
 *   accent in the item _is_ required of the user. The result keeps the user's
 *   own characters either way, see {@link comboboxCompletionValue}.
 * @example
 *   hasComboboxCompletion('ap', 'Apple') // true
 *   hasComboboxCompletion('apple', 'Apple') // false — nothing left to complete
 *   hasComboboxCompletion('ple', 'Apple') // false — not a prefix
 *   hasComboboxCompletion('café', 'Cafe Latte') // true — the accent is stripped
 */
export const hasComboboxCompletion = (
  value?: string,
  activeValue?: string,
): boolean => {
  if (!activeValue) return false
  if (value == null) return false
  const normalized = normalizeString(value)
  return (
    activeValue.length > normalized.length &&
    activeValue.toLowerCase().indexOf(normalized.toLowerCase()) === 0
  )
}

/**
 * The value with the completion string appended, or `undefined` when the active
 * value does not complete it.
 *
 * @remarks
 *   Ariakit builds the same string as `storeValue + inlineActiveValue.slice(
 *   storeValue.length)` (`combobox.tsx`). Note that it keeps the _typed_ prefix
 *   and only borrows the tail from the item, so the characters the user pressed
 *   never change under their caret.
 *
 *   The tail starts where the _normalized_ typed value ends, not where the typed
 *   value does. A dead key and most IMEs insert an accented letter decomposed —
 *   the base letter plus a combining mark, two code units — so the typed value
 *   is longer than the prefix it matched in the item, and slicing the item by
 *   the typed length would eat a character of it (react-components 0.3.0,
 *   "decomposed Unicode input no longer produces misspelled completion
 *   values").
 * @example
 *   comboboxCompletionValue('ap', 'Apple') // 'apple' — 'ap' + 'ple'
 *   comboboxCompletionValue('ap', 'Banana') // undefined
 *   comboboxCompletionValue('cafe\u0301', 'Cafe Latte') // 'café Latte'
 */
export const comboboxCompletionValue = (
  value: string,
  activeValue?: string,
): string | undefined =>
  hasComboboxCompletion(value, activeValue)
    ? value + activeValue!.slice(normalizeString(value).length)
    : undefined

/** The state {@link comboboxInputValue} resolves the displayed value from. */
export interface ComboboxInputValueContext {
  /** What the user typed — the combobox `value` state. */
  value: string
  /** The value of the active item, if it was reached by keyboard. */
  activeValue?: string
  /**
   * Whether the inline completion applies right now, i.e. `autoComplete` is
   * `inline` or `both` _and_ the last interaction was one that may complete.
   *
   * @default false
   */
  inline?: boolean
  /**
   * Whether the active item is the automatically selected first item, in which
   * case the typed prefix is kept and only the completion is appended.
   *
   * @default false
   */
  autoSelected?: boolean
  /**
   * The selected value(s). An active value that is already selected is not
   * inlined: picking it again would _de_ select it, so showing it as a
   * completion would promise the opposite of what Enter does.
   */
  selectedValue?: ComboboxSelectedValue
}

/**
 * The value the input element displays, which is not always the `value` state.
 *
 * @remarks
 *   Port of the `value` memo of `combobox.tsx`. Ariakit is explicit that this
 *   "will only affect the element's value, not the combobox state": the state
 *   is what the user typed, and it is only overwritten for real when the item
 *   is picked or the combobox loses focus.
 *
 *   One Ariakit refinement is not ported: it also skips the inline completion for
 *   a value that was selected _just before_ the active one (a
 *   `prevSelectedValueRef` in the component), so that deselecting a tag does
 *   not highlight the input. That is component-lifetime bookkeeping around the
 *   same rule as the `selectedValue` check here.
 * @example
 *   comboboxInputValue({ value: 'ap', activeValue: 'Apple' }) // 'ap' — `list` mode
 *   comboboxInputValue({ value: 'ap', activeValue: 'Apple', inline: true }) // 'Apple'
 *   comboboxInputValue({
 *     value: 'ap',
 *     activeValue: 'Apple',
 *     inline: true,
 *     autoSelected: true,
 *   }) // 'apple'
 */
export const comboboxInputValue = ({
  value,
  activeValue,
  inline = false,
  autoSelected = false,
  selectedValue,
}: ComboboxInputValueContext): string => {
  if (!inline) return value
  if (!activeValue) return value
  if (
    Array.isArray(selectedValue) &&
    (selectedValue as ReadonlyArray<string>).includes(activeValue)
  ) {
    return value
  }
  if (autoSelected) return comboboxCompletionValue(value, activeValue) ?? value
  return activeValue
}

/**
 * The `input` event shape {@link canComboboxInline} reads.
 *
 * Named apart from the record-level `ComboboxInputEvent` of `props.ts`, which
 * is the full event the `input` prop record binds; both are public.
 */
export interface ComboboxInlineInputEvent {
  /**
   * The `inputType` of a native `InputEvent`. Anything else — a synthetic
   * event, a programmatic write — is not an insertion we can reason about.
   */
  inputType?: string
  /** The caret position after the insertion. */
  selectionStart?: number | null
  /** The value after the insertion. */
  value: string
}

/**
 * Whether an `input` event may be completed inline.
 *
 * @remarks
 *   Port of the `setCanInline(textInserted && caretAtEnd)` rule in the `onChange`
 *   handler of `combobox.tsx`: completing text the user is _deleting_, or text
 *   before their caret, would fight the editing. A composition insertion
 *   (`insertCompositionText`) counts, which is what makes the completion work
 *   for an IME.
 * @example
 *   canComboboxInline({
 *     inputType: 'insertText',
 *     value: 'ap',
 *     selectionStart: 2,
 *   }) // true
 *   canComboboxInline({ inputType: 'deleteContentBackward', value: 'a' }) // false
 *   canComboboxInline({
 *     inputType: 'insertText',
 *     value: 'ap',
 *     selectionStart: 1,
 *   }) // false
 */
export const canComboboxInline = ({
  inputType,
  selectionStart,
  value,
}: ComboboxInlineInputEvent): boolean => {
  const inserted =
    inputType === 'insertText' || inputType === 'insertCompositionText'
  // A field with no selection API reports `null`, which Ariakit's
  // `selectionStart === value.length` comparison reads as "not at the end".
  return inserted && selectionStart === value.length
}
