/**
 * Layer 1 for `menu`: the `values` record and the two item shapes that read it.
 *
 * A menu is the one composite whose items can also be _form controls_:
 * `MenuItemCheckbox` and `MenuItemRadio` do not own their checked state, they
 * project one field of the menu's `values` record. Everything about that
 * projection is pure, so it lives here as plain functions over plain data.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): the `setValue` updater of
 * `packages/ariakit-components/src/menu/menu-store.ts`, plus the `getValue`
 * helpers of
 * `packages/ariakit-react-components/src/menu/menu-item-checkbox.tsx` and
 * `menu-item-radio.tsx`.
 */

import type { CheckboxValue } from '../checkbox/reatomCheckbox'
import {
  isCheckboxItemChecked,
  nextCheckboxValue,
} from '../checkbox/reatomCheckbox'

/**
 * The value of one checkbox or radio item — the `value` attribute of its
 * element.
 */
export type MenuItemValue = string | number

/**
 * A single field of the {@link MenuValues} record.
 *
 * A boolean is a standalone checkbox, a scalar is a radio group or a
 * single-select checkbox group, and an array is a multi-select checkbox group.
 * The shape of the field _is_ the mode, exactly as in `reatomCheckbox`.
 */
export type MenuValue = string | boolean | number | ReadonlyArray<MenuItemValue>

/**
 * The record `MenuItemCheckbox` and `MenuItemRadio` items read and write —
 * Ariakit's `MenuStoreValues`.
 */
export type MenuValues = Record<string, MenuValue>

/** A new field value, or a function that derives it from the previous one. */
export type MenuValueUpdate<T extends MenuValue = MenuValue> =
  | T
  | ((state: T) => T)

/**
 * Whether a name may be written into a {@link MenuValues} record.
 *
 * Ariakit's `setValue` refuses `__proto__`, `constructor`, and array-like names
 * to avoid prototype pollution — a menu field name is often user data (a
 * filter, a column, a label), so the guard is part of the transition rather
 * than of the caller.
 *
 * @example
 *   isMenuValueName('watching') // true
 *   isMenuValueName('__proto__') // false
 */
export const isMenuValueName = (name: unknown): name is string =>
  typeof name === 'string' && name !== '__proto__' && name !== 'constructor'

/**
 * Applies one field update to a {@link MenuValues} record.
 *
 * @remarks
 *   Port of Ariakit's `setValue`, including its two quirks:
 *
 *   - The record identity is kept when the field does not change, so a write that
 *       resolves to the current value notifies nothing.
 *   - `undefined` is stored as `false` (`nextValue !== undefined && nextValue`),
 *       which is what makes an unchecked radio group falsy instead of missing.
 *
 * @example
 *   nextMenuValues({}, 'watching', ['issues']) // { watching: ['issues'] }
 *   nextMenuValues({ apple: true }, 'apple', (state) => !state) // { apple: false }
 *   nextMenuValues({ apple: true }, 'apple', true) // the same object
 *
 * @param values - The current record.
 * @param name - The field to write.
 * @param update - The new value, or an updater over the previous one.
 * @returns The next record, or `values` itself when nothing changed.
 */
export const nextMenuValues = (
  values: MenuValues,
  name: string,
  update: MenuValueUpdate,
): MenuValues => {
  if (!isMenuValueName(name)) return values

  const previous = values[name]!
  const next =
    typeof update === 'function'
      ? (update as (state: MenuValue) => MenuValue | undefined)(previous)
      : update

  if (next === previous) return values
  // Ariakit stores `nextValue !== undefined && nextValue`: an updater that
  // returns nothing unsets the field rather than leaving a hole in the record.
  return { ...values, [name]: next === undefined ? false : next }
}

/**
 * Whether a checkbox menu item is checked.
 *
 * @remarks
 *   The field of a checkbox item is a {@link CheckboxValue} in every shape
 *   Ariakit's own checkbox supports, so the derivation is `reatomCheckbox`'s:
 *   an array contains the item value, a scalar equals it, and a valueless item
 *   projects the boolean field itself. `'mixed'` cannot occur here, because a
 *   {@link MenuValue} has no tri-state form — hence the boolean result.
 * @example
 *   isMenuItemChecked({ watching: ['issues'] }, 'watching', 'issues') // true
 *   isMenuItemChecked({ apple: true }, 'apple') // true
 *   isMenuItemChecked({}, 'apple') // false
 *
 * @param values - The menu's `values` record.
 * @param name - The field the item projects.
 * @param itemValue - The item's own value, or `undefined` for a boolean field.
 */
export const isMenuItemChecked = (
  values: MenuValues,
  name: string,
  itemValue?: MenuItemValue,
): boolean => {
  const state = values[name]
  if (state === undefined) return false
  return isCheckboxItemChecked(state as CheckboxValue, itemValue) === true
}

/**
 * The next field value for a checkbox menu item that reports `checked`.
 *
 * @remarks
 *   Port of `getValue` in `menu-item-checkbox.tsx`, which is `reatomCheckbox`'s
 *   own transition: an array gains or loses the item value, a scalar is
 *   replaced or unset, and a valueless item writes the boolean. An unset field
 *   starts as `[]` for an item that has a value — Ariakit's `(prevValue = [])`
 *   default — and as `false` for one that has not, so the first click on a
 *   never-touched item produces the shape the group needs.
 * @example
 *   nextMenuCheckboxValue(undefined, 'issues', true) // ['issues']
 *   nextMenuCheckboxValue(['issues'], 'issues', false) // []
 *   nextMenuCheckboxValue(undefined, undefined, true) // true
 */
export const nextMenuCheckboxValue = (
  state: MenuValue | undefined,
  itemValue: MenuItemValue | undefined,
  checked: boolean,
): MenuValue =>
  nextCheckboxValue(
    (state ?? (itemValue === undefined ? false : [])) as CheckboxValue,
    itemValue,
    checked,
  ) as MenuValue

/**
 * Whether a radio menu item is checked: its group holds exactly its value.
 *
 * @example
 *   isMenuRadioChecked({ fruit: 'apple' }, 'fruit', 'apple') // true
 *   isMenuRadioChecked({ fruit: 'apple' }, 'fruit', 'orange') // false
 */
export const isMenuRadioChecked = (
  values: MenuValues,
  name: string,
  itemValue: MenuItemValue,
): boolean => values[name] === itemValue

/**
 * The next field value for a radio menu item that reports `checked`.
 *
 * @remarks
 *   Port of `getValue` in `menu-item-radio.tsx`. A radio group is single-valued,
 *   so checking replaces the field and unchecking only clears it when _this_
 *   item held it — an unchecked report from a sibling must not wipe the group.
 * @example
 *   nextMenuRadioValue(false, 'apple', true) // 'apple'
 *   nextMenuRadioValue('apple', 'apple', false) // false
 *   nextMenuRadioValue('orange', 'apple', false) // 'orange'
 */
export const nextMenuRadioValue = (
  state: MenuValue | undefined,
  itemValue: MenuItemValue,
  checked: boolean,
): MenuValue => {
  if (checked) return itemValue
  return state === itemValue ? false : (state ?? false)
}
