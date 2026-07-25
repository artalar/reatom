import type { Computed } from '@reatom/core'
import { computed, notify, withMemo, wrap } from '@reatom/core'

import type { CheckboxItemModel, CheckboxItemValue } from './reatomCheckbox'
import { toAriaChecked, toNativeChecked } from './reatomCheckbox'

/**
 * The subset of a DOM event the checkbox prop records rely on.
 *
 * @remarks
 *   Every member is optional so the handlers can be unit-tested with plain
 *   objects, and so the records stay usable with synthetic events of any
 *   framework.
 */
export interface CheckboxPropsEvent {
  readonly defaultPrevented?: boolean
  preventDefault?: () => void
  stopPropagation?: () => void
}

/** A `change` event; its target carries the authoritative native `checked` flag. */
export interface CheckboxChangeEvent extends CheckboxPropsEvent {
  /**
   * The element the handler is attached to.
   *
   * @remarks
   *   Typed as `unknown` on purpose: a narrower shape would make a real DOM
   *   `Event` (whose `currentTarget` is `EventTarget | null`) unassignable, so
   *   the handlers could not be passed to `addEventListener` without a cast.
   *   {@link reportedChecked} narrows it at runtime instead.
   */
  readonly currentTarget?: unknown
}

/** A `keydown` event. */
export interface CheckboxKeyboardEvent extends CheckboxPropsEvent {
  readonly key?: string
}

/**
 * Reads the checked flag a checkbox element reports, or `undefined` when the
 * event does not come from one.
 */
const reportedChecked = (event: CheckboxChangeEvent): boolean | undefined => {
  const target = event.currentTarget as { checked?: unknown } | null | undefined
  return typeof target?.checked === 'boolean' ? target.checked : undefined
}

/** The props of one checkbox element. */
export interface CheckboxControlProps {
  /** `'checkbox'` for a non-native element; a native input has the role already. */
  role: 'checkbox' | undefined
  /** `'checkbox'` for a native `<input>`. */
  type: 'checkbox' | undefined
  /** The native `name` attribute, for form submission. */
  name: string | undefined
  /** The native `value` attribute of a group item. */
  value: CheckboxItemValue | undefined
  /** The native `checked` property; `'mixed'` is coerced to `false`. */
  checked: boolean
  /** The native `disabled` property. */
  disabled: boolean | undefined
  /**
   * Keeps a non-native checkbox in the tab order, or takes it out when
   * disabled.
   */
  tabIndex: number | undefined
  'aria-checked': 'true' | 'false' | 'mixed'
  'aria-disabled': 'true' | undefined
  'aria-readonly': 'true' | undefined
  'aria-labelledby': string | undefined
  'aria-describedby': string | undefined
  /** Assigns the model's element handle. */
  ref: (element: HTMLElement | null) => void
  onChange: (event?: CheckboxChangeEvent) => void
  onClick: (event?: CheckboxPropsEvent) => void
  /** Absent for a native checkbox, which the browser activates by itself. */
  onKeyDown: ((event?: CheckboxKeyboardEvent) => void) | undefined
}

/** Options of {@link checkboxProps}. */
export interface CheckboxPropsOptions {
  /**
   * Whether the bound element is a native `<input type="checkbox">`.
   *
   * @remarks
   *   Ariakit sniffs the rendered tag name; a headless model can not, and the
   *   caller always knows which element it renders. A native checkbox gets
   *   `type` / `name` / `value` / `disabled` and no `role`, keyboard handling,
   *   or `tabIndex`, because the browser provides all of it.
   * @default true
   */
  native?: boolean
  /**
   * The native `name` attribute, emitted only for a native checkbox.
   *
   * @remarks
   *   Named `nativeName` because `name` is the unit name by repo convention.
   */
  nativeName?: string
  /**
   * Whether `Enter` activates the checkbox.
   *
   * @remarks
   *   Ariakit's `useCommand` default for a checkbox is `!nativeCheckbox`: a
   *   native checkbox ignores `Enter`, a custom one mimics a button.
   * @default !native
   */
  clickOnEnter?: boolean
  /** `aria-labelledby` target. */
  labelledBy?: string
  /** `aria-describedby` target. */
  describedBy?: string
  /** Unit name of the records. */
  name?: string
}

/** The prop records of one checkbox. */
export interface CheckboxPropsRecords {
  /** Props of the checkbox element itself. */
  control: Computed<CheckboxControlProps>
}

/**
 * Builds the reactive prop records of one checkbox — a standalone checkbox, a
 * group item, or a group root used as a tri-state "check all" control.
 *
 * @remarks
 *   Ported from `useCheckbox`
 *   (`ariakit-solid-components/src/checkbox/checkbox.tsx` and its React twin),
 *   MIT, © 2025–present Ariakit FZ-LLC.
 *
 *   Records are `computed` values returning plain objects, so they are
 *   framework-neutral by construction: React spreads them, `@reatom/jsx`
 *   `$spread`s them, Vue `v-bind`s them. `withMemo` keeps the previous object
 *   while the props are shallowly equal, so an unrelated group change does not
 *   re-emit an item's record. Handlers are created once and `wrap`ped, which
 *   re-enters the Reatom frame so the logger attributes the state change to the
 *   DOM event, and `notify()` flushes it so a host framework sees the update in
 *   the same tick — the `bindField` precedent.
 *
 *   ARIA members are strings (`'true'` / `'false'` / `'mixed'`) because they are
 *   attributes; DOM members (`checked`, `disabled`, `tabIndex`) keep their
 *   property types.
 *
 *   Call this once per checkbox, at model construction time: the handlers capture
 *   the frame they are created in.
 *
 *   Two Ariakit behaviors are deliberately not here, because they need a real
 *   element and belong to Layer 2 — see `reatomCheckboxDom.ts`: assigning
 *   `indeterminate` (a property with no attribute form), and re-syncing the
 *   element after a change the model refused.
 * @example
 *   const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })
 *   const apple = checkboxProps(fruits.item('apple'))
 *   // @reatom/jsx
 *   ;<input $spread={apple.control} />
 *
 * @param item - A checkbox model or one of its `item(value)` sub-models.
 * @param options - See {@link CheckboxPropsOptions}.
 * @returns The prop records, see {@link CheckboxPropsRecords}.
 */
export const checkboxProps = (
  item: CheckboxItemModel,
  options: CheckboxPropsOptions = {},
): CheckboxPropsRecords => {
  const {
    native = true,
    nativeName,
    clickOnEnter = !native,
    labelledBy,
    describedBy,
    name = `${item.name}.props`,
  } = options

  const ref = wrap((element: HTMLElement | null) => {
    item.element.set(element)
  })

  const onChange = wrap((event: CheckboxChangeEvent = {}) => {
    if (item.disabled()) {
      // A disabled checkbox must not let the change escape, mirroring Ariakit's
      // `onChange` guard.
      event.stopPropagation?.()
      event.preventDefault?.()
      return
    }
    // A native element has already flipped its own property, and that flag is
    // authoritative — a custom element has not.
    const reported = native ? reportedChecked(event) : undefined
    item.change(reported ?? !toNativeChecked(item.checked()))
    notify()
  })

  const onClick = wrap((event: CheckboxPropsEvent = {}) => {
    // A native checkbox turns the click into a `change` event by itself, so
    // handling both would toggle twice.
    if (native) return
    if (event.defaultPrevented) return
    item.toggle()
    notify()
  })

  const onKeyDown = wrap((event: CheckboxKeyboardEvent = {}) => {
    if (event.defaultPrevented) return
    if (!item.editable()) return
    const isSpace = event.key === ' '
    if (!isSpace && !(clickOnEnter && event.key === 'Enter')) return
    // `Space` scrolls the page and, on a button-like element, also produces a
    // synthetic click — preventing the default keeps the toggle single.
    event.preventDefault?.()
    item.toggle()
    notify()
  })

  const control = computed((): CheckboxControlProps => {
    const checked = item.checked()
    const disabled = item.disabled()

    return {
      role: native ? undefined : 'checkbox',
      type: native ? 'checkbox' : undefined,
      name: native ? nativeName : undefined,
      value: native ? item.itemValue : undefined,
      checked: toNativeChecked(checked),
      disabled: native && disabled ? true : undefined,
      tabIndex: native ? undefined : disabled ? -1 : 0,
      'aria-checked': toAriaChecked(checked),
      'aria-disabled': !native && disabled ? 'true' : undefined,
      'aria-readonly': item.readOnly() ? 'true' : undefined,
      'aria-labelledby': labelledBy,
      'aria-describedby': describedBy,
      ref,
      onChange,
      onClick,
      onKeyDown: native ? undefined : onKeyDown,
    }
  }, `${name}.control`).extend(withMemo())

  return { control }
}
