import type { Action, Atom, Computed } from '@reatom/core'
import { action, atom, computed, named, ReatomError } from '@reatom/core'

import { adoptAtom } from '../interactions/adoptAtom'
import { checkboxProps, type CheckboxPropsRecords } from './props'

/**
 * The value of a single checkbox inside a group — the `value` attribute of the
 * bound element.
 *
 * @remarks
 *   Ariakit accepts `readonly string[]` here too and collapses it with
 *   `getPrimitiveValue` (`value.toString()`). That only exists to support the
 *   native `<input value>` typing, so the model keeps the primitive union.
 */
export type CheckboxItemValue = string | number

/** Tri-state checked flag, as reported to `aria-checked`. */
export type CheckboxChecked = boolean | 'mixed'

/**
 * State a checkbox model can hold.
 *
 * @remarks
 *   A standalone checkbox holds {@link CheckboxChecked}. A group holds either an
 *   array of the checked item values (multi-select) or a single item value
 *   (single-select, where unchecking falls back to `false`) — the two shapes
 *   Ariakit's `CheckboxStoreValue` supports.
 */
export type CheckboxValue =
  | boolean
  | 'mixed'
  | string
  | number
  | ReadonlyArray<CheckboxItemValue>

type CheckboxItemValueFor<T extends CheckboxValue> =
  T extends ReadonlyArray<infer Item>
    ? Extract<Item, CheckboxItemValue>
    : Extract<T, CheckboxItemValue>

/**
 * Derives the tri-state checked flag of one checkbox from the group value.
 *
 * @remarks
 *   Ported from `useCheckbox`'s `checked` derivation in
 *   `ariakit-solid-components/src/checkbox/checkbox.tsx`.
 * @example
 *   isCheckboxItemChecked(['apple'], 'apple') // true
 *   isCheckboxItemChecked('apple', 'orange') // false
 *   isCheckboxItemChecked('mixed', undefined) // 'mixed'
 *
 * @param state - The group value.
 * @param itemValue - The checkbox value, or `undefined` for a standalone
 *   checkbox that owns the whole state.
 * @returns `true`, `false`, or `'mixed'`.
 */
export const isCheckboxItemChecked = (
  state: CheckboxValue,
  itemValue?: CheckboxItemValue,
): CheckboxChecked => {
  if (itemValue != null) {
    return Array.isArray(state)
      ? state.includes(itemValue)
      : state === itemValue
  }
  // An array state always belongs to a group, so a valueless checkbox can not
  // be checked by it.
  if (Array.isArray(state)) return false
  if (state === 'mixed') return 'mixed'
  return typeof state === 'boolean' ? state : false
}

/**
 * Computes the next group value for a checkbox that became `checked`.
 *
 * @remarks
 *   Ported from the `store.setValue` updater in `useCheckbox`'s change handler
 *   (`ariakit-solid-components/src/checkbox/checkbox.tsx`). The transition is
 *   total: every state / item value / checked combination has a result.
 * @example
 *   nextCheckboxValue(['apple'], 'orange', true) // ['apple', 'orange']
 *   nextCheckboxValue(['apple'], 'apple', false) // []
 *   nextCheckboxValue('apple', 'apple', true) // false — single-select unset
 *   nextCheckboxValue(false, undefined, true) // true
 *
 * @param state - The current group value.
 * @param itemValue - The checkbox value, or `undefined` for a standalone
 *   checkbox.
 * @param checked - The checked flag the checkbox reports.
 * @returns The next group value.
 */
export const nextCheckboxValue = (
  state: CheckboxValue,
  itemValue: CheckboxItemValue | undefined,
  checked: boolean,
): CheckboxValue => {
  // Without a value the checkbox owns the whole state.
  if (itemValue == null) return checked
  // Single-select: toggling the checked item unsets the group.
  if (!Array.isArray(state)) return state === itemValue ? false : itemValue
  if (checked) {
    return state.includes(itemValue) ? state : [...state, itemValue]
  }
  return state.filter((entry) => entry !== itemValue)
}

/**
 * Maps a tri-state checked flag to the `aria-checked` attribute value.
 *
 * @remarks
 *   The result is a string because `aria-checked` is an attribute, not a
 *   property: `'mixed'` has no boolean form and `false` must be serialized
 *   instead of removing the attribute.
 */
export const toAriaChecked = (
  checked: CheckboxChecked,
): 'true' | 'false' | 'mixed' =>
  checked === 'mixed' ? 'mixed' : checked ? 'true' : 'false'

/**
 * Coerces a tri-state checked flag to the boolean the native `checked` property
 * accepts. `'mixed'` becomes `false` and is expressed by `indeterminate`
 * instead.
 */
export const toNativeChecked = (checked: CheckboxChecked): boolean =>
  checked === 'mixed' ? false : checked

/**
 * One checkbox: either a standalone checkbox, or one item of a group sharing a
 * single value atom.
 *
 * @remarks
 *   `disabled`, `readOnly`, and `editable` are the group-level units, shared by
 *   reference with every item, so a prop record can be built from an item
 *   alone.
 * @template T - The group value type.
 */
export interface CheckboxItemModel<T extends CheckboxValue = CheckboxValue> {
  /** Unit name of this checkbox — `checkbox` or `checkbox#apple`. */
  name: string
  /**
   * The value this checkbox contributes to the group, or `undefined` for a
   * standalone checkbox that owns the whole state.
   */
  itemValue: CheckboxItemValueFor<T> | undefined
  /** Tri-state checked flag derived from the group value. */
  checked: Computed<CheckboxChecked>
  /** `true` while `checked` is `'mixed'` — the source of `indeterminate`. */
  mixed: Computed<boolean>
  /** Group-level disabled flag. */
  disabled: Atom<boolean>
  /** Group-level read-only flag. */
  readOnly: Atom<boolean>
  /** `false` while user intent must be ignored: `disabled` or `readOnly`. */
  editable: Computed<boolean>
  /** The bound DOM element, assigned from the prop record's `ref`. */
  element: Atom<HTMLElement | null>
  /**
   * Applies an explicit checked flag and returns the resulting group value.
   *
   * @remarks
   *   Native `change` events carry the already flipped `checked` property, which
   *   is authoritative — pass it here instead of calling `toggle`.
   */
  change: Action<[checked: boolean], T>
  /**
   * Flips `checked` and returns the resulting group value; `'mixed'` becomes
   * `true`.
   */
  toggle: Action<[], T>
  /** Reactive prop records for this checkbox, built from the model's options. */
  props: CheckboxPropsRecords
}

/**
 * A checkbox model: the group value atom extended with the standalone checkbox
 * units and an `item` factory for group members.
 *
 * @template T - The group value type.
 */
export interface CheckboxModel<T extends CheckboxValue = CheckboxValue>
  extends Atom<T>, CheckboxItemModel<T> {
  /**
   * Returns the memoized sub-model of one group item. Calling it twice with the
   * same value returns the same model, so prop-record identity is stable.
   */
  item: (itemValue: CheckboxItemValueFor<T>) => CheckboxItemModel<T>
}

/** Options of {@link reatomCheckbox}. */
export interface CheckboxOptions<T extends CheckboxValue = CheckboxValue> {
  /**
   * Initial state of the model-owned value atom. Mutually exclusive with
   * `valueAtom`.
   *
   * @default false
   */
  value?: T
  /**
   * Adopt a caller-owned atom instead of creating one — this is what
   * "controlled" means in Reatom.
   *
   * @remarks
   *   Pass a `reatomForm` field to drop the widget into a form (the field's dirty
   *   tracking and `validateOnChange` react to the write), a search-param atom
   *   to keep the state in the URL, or the same atom to two models to share one
   *   group between two widgets.
   * @example
   *   const form = reatomForm({ agree: false }, 'form')
   *   const agree = reatomCheckbox({ valueAtom: form.fields.agree })
   */
  valueAtom?: Atom<T>
  /**
   * Initial group-level disabled flag.
   *
   * @default false
   */
  disabled?: boolean
  /**
   * Initial group-level read-only flag.
   *
   * @default false
   */
  readOnly?: boolean
  /**
   * Whether the model's `props` target a native `<input type="checkbox">`. A
   * native checkbox gets `type` / `name` / `value` / `disabled`; a custom one
   * gets `role` / `tabIndex` / keyboard handling. Rebind with a different value
   * through the standalone {@link checkboxProps} when a single model needs
   * both.
   *
   * @default true
   */
  native?: boolean
  /** The native `name` attribute for form submission, when `native`. */
  nativeName?: string
  /** Unit name; every nested unit is named after it. */
  name?: string
}

/**
 * Creates a headless checkbox model: a group value atom plus the tri-state
 * checked derivation, the toggle transitions, and the guards a checkbox needs.
 *
 * @remarks
 *   Ported from Ariakit's `createCheckboxStore`
 *   (`ariakit-components/src/checkbox/checkbox-store.ts`) together with the
 *   a11y behavior Ariakit keeps in its `Checkbox` components
 *   (`ariakit-solid-components/src/checkbox/checkbox.tsx`), MIT, © 2025–present
 *   Ariakit FZ-LLC.
 *
 *   Differences from the Ariakit store, all forced by the store → atoms mapping:
 *
 *   - There is no `setValue` identity action: write the model atom directly.
 *   - `'mixed'` is part of the model state instead of a `checked` component prop,
 *       because the model has no component to receive props.
 *   - `defaultValue` / `value` / `store` collapse into `value` (own state) and
 *       `valueAtom` (adopted state), see {@link CheckboxOptions.valueAtom}.
 *   - `disabled` / `readOnly` live in the model instead of coming from element
 *       props, so the transition guards are testable without a DOM.
 *
 *   There is deliberately no `withCheckbox` extension: `extend` mutates its
 *   target, so attaching checkbox members to a `reatomForm` field would collide
 *   on the field's own `disabled` / `change` members. Use
 *   {@link CheckboxOptions.valueAtom} instead.
 * @example
 *   // standalone checkbox
 *   const agree = reatomCheckbox({ name: 'agree' })
 *   agree.toggle()
 *   agree() // true
 *   agree.checked() // true
 *
 * @example
 *   // group sharing one value atom
 *   const fruits = reatomCheckbox<Array<string>>({
 *     value: [],
 *     name: 'fruits',
 *   })
 *   fruits.item('apple').toggle()
 *   fruits() // ['apple']
 *   fruits.item('orange').checked() // false
 *
 * @param options - See {@link CheckboxOptions}.
 * @returns The value atom extended with the checkbox units.
 */
export function reatomCheckbox<T extends CheckboxValue = CheckboxChecked>(
  options: CheckboxOptions<T> = {},
): CheckboxModel<T> {
  const {
    value: initValue = false as T,
    valueAtom,
    disabled: initDisabled = false,
    readOnly: initReadOnly = false,
    native = true,
    nativeName,
    name = named('checkbox'),
  } = options

  if (valueAtom && options.value !== undefined) {
    throw new ReatomError(
      `${name}: pass either "value" or "valueAtom", not both`,
    )
  }

  const value = (
    valueAtom ? adoptAtom(valueAtom, name) : atom(initValue, name)
  ) as Atom<T>
  const disabled = atom(initDisabled, `${name}.disabled`)
  const readOnly = atom(initReadOnly, `${name}.readOnly`)
  const editable = computed(
    () => !disabled() && !readOnly(),
    `${name}.editable`,
  )

  const createItem = (
    itemValue: CheckboxItemValueFor<T> | undefined,
    itemName: string,
  ): CheckboxItemModel<T> => {
    const checked = computed(
      () => isCheckboxItemChecked(value(), itemValue),
      `${itemName}.checked`,
    )
    const mixed = computed(() => checked() === 'mixed', `${itemName}.mixed`)
    const element = atom<HTMLElement | null>(null, `${itemName}.element`)

    const change = action((nextChecked: boolean): T => {
      if (!editable()) return value()
      return value.set(nextCheckboxValue(value(), itemValue, nextChecked) as T)
    }, `${itemName}.change`)

    const toggle = action(
      () => change(!toNativeChecked(checked())),
      `${itemName}.toggle`,
    )

    const model = {
      name: itemName,
      itemValue,
      checked,
      mixed,
      disabled,
      readOnly,
      editable,
      element,
      change,
      toggle,
    } as CheckboxItemModel<T>
    // Attached after the object exists so the records can read it back; the
    // records never read `.props`, so the momentary gap is safe.
    model.props = checkboxProps(model, { native, nativeName })
    return model
  }

  const items = new Map<CheckboxItemValueFor<T>, CheckboxItemModel<T>>()

  const item = (itemValue: CheckboxItemValueFor<T>): CheckboxItemModel<T> => {
    let model = items.get(itemValue)
    if (!model) {
      items.set(
        itemValue,
        (model = createItem(itemValue, `${name}#${itemValue}`)),
      )
    }
    return model
  }

  // The model itself is the standalone ("no item value") checkbox, so a group
  // root can render a tri-state "check all" control with the same prop records.
  const self = createItem(undefined, name)

  return value.extend(() => ({
    itemValue: self.itemValue,
    checked: self.checked,
    mixed: self.mixed,
    disabled,
    readOnly,
    editable,
    element: self.element,
    change: self.change,
    toggle: self.toggle,
    props: self.props,
    item,
  }))
}
