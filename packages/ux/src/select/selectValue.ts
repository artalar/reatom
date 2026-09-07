/**
 * Layer 1 value policy for `select`: the pure functions behind the value a
 * select holds — whether it is set at all, whether an item carries it, what it
 * becomes when an item is picked, and which item the popover should focus when
 * it opens.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): the default-value listener of
 * `packages/ariakit-components/src/select/select-store.ts`, plus `isSelected`,
 * the `setValue` updater, and the `autoFocus` selector of
 * `packages/ariakit-react-components/src/select/select-item.tsx`.
 *
 * Ariakit keeps the last three inside a component body, where they can only be
 * tested by rendering a widget. Here they are plain data in, plain data out.
 */

/**
 * The value of a select: one string, or an array of strings for a
 * [multi-select](https://ariakit.com/examples/select-multiple).
 *
 * The _shape_ is the mode: an array means multi-selectable, and that is what
 * makes picking an item a toggle, keeps arrow keys from writing the value, and
 * emits `aria-multiselectable`. Ariakit makes the same inference with
 * `Array.isArray(state.value)`.
 */
export type SelectValue = string | ReadonlyArray<string>

/**
 * The state of a select whose value has not been chosen yet.
 *
 * @remarks
 *   Ariakit needs a sentinel here, because `''` is both "nothing chosen" and a
 *   legitimate value: it stores `new String('') as ''`, an object that lies
 *   about its type so that `state.value !== initialValue` distinguishes the two
 *   (`select-store.ts:98`). The comparison then leaks into every consumer, and
 *   the value a caller reads is not the primitive its type promises.
 *
 *   `undefined` says the same thing without the lie: it is not a `SelectValue`,
 *   so the type itself tells a reader that the value may be unset, and `value
 *   === undefined` is the whole check.
 */
export type SelectUnsetValue = undefined

/** Whether a select holds several values, i.e. its value is an array. */
export const isSelectMultiSelectable = (
  value: SelectValue | SelectUnsetValue,
): boolean => Array.isArray(value)

/**
 * The value as a list, which is what a multi-select's markup and the "last
 * picked" rule need.
 *
 * Port of Ariakit's `toArray` applied to the select value, with the unset value
 * mapped to an empty list.
 *
 * @example
 *   toSelectValues('Apple') // ['Apple']
 *   toSelectValues(['Apple', 'Orange']) // ['Apple', 'Orange']
 *   toSelectValues(undefined) // []
 */
export const toSelectValues = (
  value: SelectValue | SelectUnsetValue,
): ReadonlyArray<string> => {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value as string]
}

/**
 * The value picked last: the value itself for a single select, the last element
 * for a multi-select, `undefined` while nothing is picked.
 *
 * @remarks
 *   Ariakit reads the same `values[values.length - 1]` to decide which item the
 *   popover focuses when it opens, so that a multi-select opens at the item the
 *   user touched last rather than at the top of their selection.
 * @example
 *   lastSelectValue(['Apple', 'Orange']) // 'Orange'
 *   lastSelectValue('Apple') // 'Apple'
 *   lastSelectValue([]) // undefined
 */
export const lastSelectValue = (
  value: SelectValue | SelectUnsetValue,
): string | undefined => toSelectValues(value).at(-1)

/**
 * Whether one item is selected.
 *
 * @remarks
 *   Port of `isSelected` in `select-item.tsx`. `undefined` — not `false` — is
 *   Ariakit's answer for an item that has no value: such an item is not
 *   selectable at all, which is why it emits no `aria-selected` attribute.
 * @example
 *   isSelectItemSelected('Apple', 'Apple') // true
 *   isSelectItemSelected(['Apple'], 'Orange') // false
 *   isSelectItemSelected(undefined, 'Apple') // false — nothing is picked yet
 *   isSelectItemSelected('Apple') // undefined — the item has no value
 */
export const isSelectItemSelected = (
  value: SelectValue | SelectUnsetValue,
  itemValue?: string,
): boolean | undefined => {
  if (itemValue == null) return undefined
  if (value === undefined) return false
  if (Array.isArray(value)) return value.includes(itemValue)
  return value === itemValue
}

/**
 * The value after an item is picked: a toggle when the select is
 * multi-selectable, a replacement when it is not.
 *
 * @remarks
 *   Port of the `setValue` updater in `select-item.tsx`. The array branch appends
 *   at the end, so the selection order is the click order — which is both what
 *   a multi-select renders and what {@link lastSelectValue} reads.
 *
 *   An unset value is replaced, never toggled: "nothing chosen yet" is not an
 *   array, so the first pick decides the shape the same way an explicit initial
 *   value would.
 * @example
 *   nextSelectValue('Apple', 'Orange') // 'Orange'
 *   nextSelectValue(['Apple'], 'Orange') // ['Apple', 'Orange']
 *   nextSelectValue(['Apple', 'Orange'], 'Apple') // ['Orange']
 *   nextSelectValue(undefined, 'Apple') // 'Apple'
 *
 * @returns The next value. For an array it is always a new array, so the write
 *   is a real change even when the contents match.
 */
export const nextSelectValue = <T extends SelectValue>(
  value: T | SelectUnsetValue,
  itemValue: string,
): T => {
  if (!Array.isArray(value)) return itemValue as T
  const values = value as ReadonlyArray<string>
  return (values.includes(itemValue)
    ? values.filter((current) => current !== itemValue)
    : [...values, itemValue]) as unknown as T
}

/** The state {@link isSelectItemAutoFocus} decides from. */
export interface SelectAutoFocusContext {
  /** The select value. */
  value: SelectValue | SelectUnsetValue
  /** The item's own value; an item without one is never auto-focused. */
  itemValue?: string
  /** Whether the item is the widget's active item. */
  active?: boolean
  /**
   * Whether the active id addresses an item that is registered. A stale or
   * `null` active id does not, and then the selected item takes focus instead —
   * which is what makes the popover open at the current selection.
   */
  activeKnown?: boolean
}

/**
 * Whether the item should receive focus when the popover opens.
 *
 * @remarks
 *   Port of the `autoFocus` selector of `select-item.tsx`: the item picked last
 *   is the one the popover opens at, unless some _other_ registered item is
 *   already the active one — a keyboard move before the popover opened, or a
 *   `SelectItem` that asked to be focused.
 *
 *   Ariakit's own comment covers the one case this does not decide: with
 *   `virtualFocus` off (iOS Safari) the `autoFocus` prop is suppressed while
 *   `data-autofocus` is kept, "to prevent a re-mounted selected item from
 *   stealing focus from the combobox input (which dismisses the iOS keyboard)"
 *   (issue #5047). That split belongs to the prop record, which knows the focus
 *   strategy; this function answers the question both halves share.
 * @example
 *   isSelectItemAutoFocus({ value: 'Apple', itemValue: 'Apple' }) // true
 *   isSelectItemAutoFocus({ value: 'Apple', itemValue: 'Orange' }) // false
 *   isSelectItemAutoFocus({ value: ['a', 'b'], itemValue: 'b' }) // true — picked last
 *   isSelectItemAutoFocus({ value: undefined, itemValue: 'Apple' }) // false
 *   isSelectItemAutoFocus({
 *     value: 'Apple',
 *     itemValue: 'Apple',
 *     active: false,
 *     activeKnown: true,
 *   }) // false — another item is active
 */
export const isSelectItemAutoFocus = ({
  value,
  itemValue,
  active = false,
  activeKnown = false,
}: SelectAutoFocusContext): boolean => {
  if (itemValue == null) return false
  if (value === undefined) return false
  if (!active && activeKnown) return false
  return lastSelectValue(value) === itemValue
}
