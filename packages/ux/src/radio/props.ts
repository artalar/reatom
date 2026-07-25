/**
 * Layer 2 for `radio`: the reactive prop records of a radio group and of one
 * radio.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/radio/radio.tsx` and
 * `radio-group.tsx`.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed, notify, withMemo, wrap } from '@reatom/core'

import type { CompositeOrientation } from '../composite/getNextId'
import type { CompositeBaseProps, CompositeItemProps } from '../composite/props'
import { isFocusEventOutside } from '../focusable/focusableDom'
import type { RadioItemModel, RadioItemValue, RadioModel } from './reatomRadio'

/**
 * The subset of a DOM event the radio prop records rely on.
 *
 * @remarks
 *   Every member is optional so the handlers can be unit-tested with plain
 *   objects, and so the records stay usable with the synthetic events of any
 *   framework. `change` and `click` need nothing else: unlike a checkbox, a
 *   radio can only ever be turned _on_, so the element's own `checked` property
 *   carries no information the model does not already have.
 */
export interface RadioPropsEvent {
  readonly defaultPrevented?: boolean
  preventDefault?: () => void
  stopPropagation?: () => void
}

/** Props to spread on the radio group element. */
export interface RadioGroupProps extends CompositeBaseProps {
  /** The [`radiogroup`](https://w3c.github.io/aria/#radiogroup) role. */
  role: 'radiogroup'
  /**
   * The navigation axis, for the rare group that is not laid out vertically.
   * Omitted while the model accepts both axes, so the ARIA default applies.
   */
  'aria-orientation': 'horizontal' | 'vertical' | undefined
  'aria-disabled': 'true' | undefined
  'aria-readonly': 'true' | undefined
  /** The `id` of the element that labels the group — usually its legend. */
  'aria-labelledby': string | undefined
  'aria-describedby': string | undefined
  /**
   * Gives the tab stop back to the checked radio when focus leaves the group,
   * so `Tab` re-enters at the checked one and not at whatever the arrow keys
   * last activated. See {@link RadioUnits.activateChecked}.
   *
   * @remarks
   *   Bind it to `focusout` rather than to the non-bubbling `blur` — Ariakit uses
   *   `onBlurCapture` on the group, and only the bubbling event reports focus
   *   moving out of a radio inside it.
   */
  onBlur: (event: FocusEvent) => void
}

/** Props to spread on one radio element. */
export interface RadioItemProps extends Omit<
  CompositeItemProps,
  'onFocus' | 'onKeyDown' | 'ref'
> {
  /** `'radio'` for a non-native element; a native input has the role already. */
  role: 'radio' | undefined
  /** `'radio'` for a native `<input>`. */
  type: 'radio' | undefined
  /**
   * The native `name` attribute, which is what groups native radios in a form.
   * Defaults to the group's `id`, so two groups on one page can not merge —
   * Ariakit issue #3833.
   */
  name: string | undefined
  /** The native `value` attribute, for form submission. */
  value: RadioItemValue | undefined
  /** The native `checked` property. */
  checked: boolean
  'aria-checked': 'true' | 'false'
  'aria-disabled': 'true' | undefined
  /**
   * The roving tabindex: `-1` on every radio but the tab stop of the group.
   *
   * @remarks
   *   The tab stop itself gets `undefined` — "no attribute" — on a native
   *   `<input>`, which is tabbable already, and `0` on a custom element, which
   *   is not. Ariakit reaches the same two values through `Focusable`, whose
   *   `getTabIndex` falls back to `tabIndex ?? 0` for anything not natively
   *   tabbable.
   */
  tabIndex: number | undefined
  'aria-labelledby': string | undefined
  'aria-describedby': string | undefined
  /**
   * Registers and renders the radio, and stores its element; pass `null` on
   * unmount to undo both.
   *
   * @remarks
   *   Registration is part of the ref — unlike a bare composite item, where the
   *   caller registers — because a radio is addressed by value, so the model
   *   can derive everything else about it before it exists in the DOM. It
   *   mirrors Ariakit, whose `useCompositeItem` also registers from a ref
   *   effect.
   */
  ref: (element: HTMLElement | null) => void
  /** Focus follows the active radio, and focusing a radio activates it. */
  onFocus: (event: FocusEvent) => void
  /**
   * Arrow, Home / End navigation, plus `Space` (and `Enter`, see
   * {@link RadioItemPropsOptions.clickOnEnter}) for a non-native radio.
   */
  onKeyDown: (event: KeyboardEvent) => void
  /** The authoritative selection event of a native radio. */
  onChange: (event?: RadioPropsEvent) => void
  /** Absent for a native radio, which the browser turns into a `change` event. */
  onClick: (event?: RadioPropsEvent) => void
}

/** Options shared by the group record and every radio record. */
export interface RadioPropsOptions {
  /**
   * Whether the bound radio elements are native `<input type="radio">`.
   *
   * @remarks
   *   Ariakit sniffs the rendered tag name; a headless model can not, and the
   *   caller always knows which element it renders. A native radio gets `type`
   *   / `name` / `value` and no `role` or keyboard handling, because the
   *   browser provides all of it.
   * @default true
   */
  native?: boolean
  /**
   * The native `name` attribute of every radio.
   *
   * @remarks
   *   Named `nativeName` because `name` is the unit name by repo convention.
   *   Defaults to the group's `id`, which is what keeps two groups apart.
   */
  nativeName?: string
  /**
   * Whether `Enter` selects a non-native radio.
   *
   * @remarks
   *   Ariakit passes `clickOnEnter: !nativeRadio` to `useCompositeItem`: a native
   *   radio ignores `Enter`, a custom one mimics a button.
   * @default !native
   */
  clickOnEnter?: boolean
  /** `aria-labelledby` target of the group. */
  labelledBy?: string
  /** `aria-describedby` target of the group. */
  describedBy?: string
  /** Prefix of the prop record names. Defaults to the model name. */
  name?: string
}

/** Options of {@link radioItemProps}. */
export interface RadioItemPropsOptions extends Omit<
  RadioPropsOptions,
  'labelledBy' | 'describedBy'
> {
  /**
   * Forces the radio into the tab order, whatever the roving tabindex says —
   * Ariakit's `tabbable` prop on `CompositeItem`.
   *
   * @default false
   */
  tabbable?: boolean
  /** `aria-labelledby` target of this radio, usually its own label element. */
  labelledBy?: string
  /** `aria-describedby` target of this radio. */
  describedBy?: string
}

/** Reactive prop records of a radio group model. */
export interface RadioPropRecords {
  /** Props for the group element. */
  group: Computed<RadioGroupProps>
  /**
   * Props for one radio element. The record is memoized per radio, so repeated
   * calls keep the same identity; passing options returns a fresh, uncached
   * record.
   */
  item: (
    item: RadioItemModel,
    options?: RadioItemPropsOptions,
  ) => Computed<RadioItemProps>
}

const ariaOrientation = (
  orientation: CompositeOrientation,
): 'horizontal' | 'vertical' | undefined =>
  orientation === 'both' ? undefined : orientation

/**
 * Reactive prop record for one radio element.
 *
 * @remarks
 *   The handlers are `wrap`ped so the state change is attributed to the DOM event
 *   in the logger, and they `notify()` so a host framework sees the update in
 *   the same tick — the `bindField` precedent. They keep a stable identity
 *   across recomputations _and_ across the radio's registration, so an adapter
 *   can attach them once, before the element is even in the DOM.
 *
 *   Navigation and focus are delegated to the composite item record of the
 *   registered node rather than reimplemented, so a radio group inherits the
 *   whole composite keyboard contract (orientation, RTL, loop, Home / End).
 *   What is not delegated is `ref`: a radio registers itself, see
 *   {@link RadioItemProps.ref}.
 * @example
 *   const plan = reatomRadio({ name: 'plan' })
 *   const props = radioItemProps(plan, plan.item('free'))
 *   props() // { id: 'plan-free', type: 'radio', checked: false, ... }
 *
 * @param model - The radio group model.
 * @param item - One of its `item(value)` sub-models.
 * @param options - See {@link RadioItemPropsOptions}.
 * @returns The reactive prop record.
 */
export const radioItemProps = (
  model: RadioModel,
  item: RadioItemModel,
  options: RadioItemPropsOptions = {},
): Computed<RadioItemProps> => {
  const {
    native = true,
    nativeName,
    clickOnEnter = !native,
    tabbable = false,
    labelledBy,
    describedBy,
    name = `${item.name}.props`,
  } = options

  /** The composite item record of the registered node, or `null` before it. */
  const compositeRecord = (): CompositeItemProps | null => {
    const node = item.node()
    return node ? model.composite.props.item(node)() : null
  }

  const change = (event: RadioPropsEvent) => {
    if (item.disabled()) {
      // A disabled radio must not let the change escape, mirroring Ariakit's
      // `onChange` guard.
      event.stopPropagation?.()
      event.preventDefault?.()
      return
    }
    // Re-selecting the checked radio is not a change (Ariakit issue #3771): the
    // browser fires `change` again when a native radio is clicked twice.
    if (item.checked()) return
    // A read-only group refuses the selection inside `select` and leaves the
    // event alone — the checkbox precedent. The action is called regardless,
    // because it is the only signal `reatomRadioElementSync` can write the
    // element back from: a refused selection changes no state.
    item.select()
  }

  const ref = wrap((element: HTMLElement | null) => {
    if (element) item.render({ element })
    else item.unrender()
    notify()
  })

  const onFocus = wrap((event: FocusEvent) => {
    compositeRecord()?.onFocus(event)
  })

  const onKeyDown = wrap((event: KeyboardEvent) => {
    compositeRecord()?.onKeyDown(event)
    // The browser selects a native radio on `Space` by itself, and turns it into
    // the `change` event this record already listens to.
    if (native) return
    if (event.defaultPrevented) return
    const isSpace = event.key === ' '
    if (!isSpace && !(clickOnEnter && event.key === 'Enter')) return
    // A guarded radio ignores the key instead of cancelling it, as a guarded
    // checkbox does: a custom element flips nothing on its own, so there is
    // nothing to undo and no reason to swallow the key from the page.
    if (!item.editable()) return
    // `Space` scrolls the page and, on a button-like element, also produces a
    // synthetic click — preventing the default keeps the selection single.
    event.preventDefault()
    change(event)
    notify()
  })

  const onChange = wrap((event: RadioPropsEvent = {}) => {
    change(event)
    notify()
  })

  const onClick = wrap((event: RadioPropsEvent = {}) => {
    if (event.defaultPrevented) return
    if (item.disabled()) {
      // Ariakit cancels the click of a disabled element in `Focusable`
      // (`useDisableEvent`), and on a native radio that is also the only way to
      // undo the selection: a cancelled click runs the HTML "canceled
      // activation steps", which restore the checkedness of the whole group
      // and skip the `change` event altogether.
      event.stopPropagation?.()
      event.preventDefault?.()
      return
    }
    // An enabled native radio turns the click into a `change` event by itself,
    // so handling both would select twice.
    if (native) return
    change(event)
    notify()
  })

  return computed((): RadioItemProps => {
    const checked = item.checked()
    const disabled = item.disabled()

    return {
      id: item.id,
      role: native ? undefined : 'radio',
      type: native ? 'radio' : undefined,
      name: native ? (nativeName ?? model.composite.id()) : undefined,
      value: native ? item.value : undefined,
      checked,
      'data-active-item': item.active() || undefined,
      tabIndex: tabbable || item.tabbable() ? (native ? undefined : 0) : -1,
      'aria-checked': checked ? 'true' : 'false',
      // Never the native `disabled` attribute: a disabled radio stays focusable
      // so a screen-reader user can read the whole group, which is Ariakit's
      // `accessibleWhenDisabled` default for composite items. The handler guards
      // keep the state safe instead.
      'aria-disabled': disabled ? 'true' : undefined,
      'aria-labelledby': labelledBy,
      'aria-describedby': describedBy,
      ref,
      onFocus,
      onKeyDown,
      onChange,
      onClick,
    }
  }, name).extend(withMemo())
}

/**
 * Builds the reactive prop records of a radio group model.
 *
 * Each record is a `computed` returning a plain object, so it is memoized,
 * lazy, traceable by name, and neutral about the view library: React spreads
 * it, `@reatom/jsx` `$spread`s it, Vue `v-bind`s it.
 *
 * @example
 *   const props = radioProps(plan)
 *   props.group() // { role: 'radiogroup', id: 'plan', ... }
 *   props.item(plan.item('free'))()
 */
export const radioProps = (
  model: RadioModel,
  options: RadioPropsOptions = {},
): RadioPropRecords => {
  const { labelledBy, describedBy, name = model.name, ...itemOptions } = options

  const records = new WeakMap<RadioItemModel, Computed<RadioItemProps>>()

  const onGroupBlur = wrap((event: FocusEvent) => {
    if (event.defaultPrevented) return
    // Moving between the radios of the group is not leaving it, and must not
    // undo the navigation the user is in the middle of.
    if (!isFocusEventOutside(event)) return
    model.activateChecked()
    notify()
  })

  return {
    group: computed((): RadioGroupProps => {
      const orientation = model.composite.orientation()

      return {
        // The composite base record already carries the id, the focus strategy,
        // and the "enter the widget" keyboard handling.
        ...model.composite.props.base(),
        role: 'radiogroup',
        'aria-orientation': ariaOrientation(orientation),
        'aria-disabled': model.disabled() ? 'true' : undefined,
        'aria-readonly': model.readOnly() ? 'true' : undefined,
        'aria-labelledby': labelledBy,
        'aria-describedby': describedBy,
        onBlur: onGroupBlur,
      }
    }, `${name}.props.group`).extend(withMemo()),

    item: (item, propsOptions) => {
      if (propsOptions) {
        return radioItemProps(model, item, { ...itemOptions, ...propsOptions })
      }

      let record = records.get(item)
      if (!record) {
        records.set(item, (record = radioItemProps(model, item, itemOptions)))
      }
      return record
    },
  }
}

/**
 * Attaches {@link radioProps} to a radio model as `model.props`.
 *
 * {@link reatomRadio} applies it already; use it explicitly when composing a
 * radio model by hand.
 */
export const withRadioProps = (
  options: RadioPropsOptions = {},
): AssignerExt<{ props: RadioPropRecords }, RadioModel> => {
  return (target) => ({ props: radioProps(target, options) })
}
