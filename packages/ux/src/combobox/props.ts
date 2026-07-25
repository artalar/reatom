/**
 * Layer 2 for `combobox`: the reactive prop records of the six elements a
 * combobox is made of — the input, its label, the list of items, one item, the
 * cancel button, and the disclosure button.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/combobox/combobox.tsx`,
 * `combobox-item.tsx`, `combobox-list.tsx`, `combobox-popover.tsx`,
 * `combobox-label.tsx`, `combobox-cancel.tsx`, and `combobox-disclosure.tsx`.
 *
 * `ComboboxValue`, `ComboboxItemValue`, `ComboboxItemCheck`, `ComboboxGroup`,
 * `ComboboxRow`, and `ComboboxSeparator` are not ported: they render text, a
 * checkmark, or a grouping element, which is a view concern with no state of
 * its own.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed, notify, wrap } from '@reatom/core'

import {
  mapEntryIntent,
  mapNavigationIntent,
} from '../composite/navigationIntent'
import { isDisclosureContentHidden } from '../disclosure/props'
import { hasFocus } from '../focusable/focusableDom'
import { isTextFieldElement } from '../interactions/describeElement'
import { isSelfTarget } from '../interactions/element'
import { queueBeforeEvent } from '../interactions/queueBeforeEvent'
import type { PopoverContentProps } from '../popover/props'
import type { ComboboxKeyEvent, ComboboxPointerEvent } from './comboboxIntent'
import {
  canShowComboboxList,
  isComboboxEnterBlocked,
  isComboboxPrimaryPress,
  isComboboxShowKey,
  isComboboxTypeaheadKey,
} from './comboboxIntent'
import type { ComboboxAutoComplete } from './comboboxValue'
import { canComboboxInline } from './comboboxValue'
import type { ComboboxModel } from './reatomCombobox'
import {
  isFocusLeavingCombobox,
  readComboboxInput,
  setComboboxInputCaret,
} from './reatomComboboxDom'

/**
 * A combobox model of any selection shape, which is what the prop records need:
 * none of them is typed by the selected value.
 */
export type AnyComboboxModel = ComboboxModel<any>

/**
 * The ARIA role of the element that holds the items — Ariakit's "any valid
 * combobox popup role".
 */
export type ComboboxPopupRole = 'listbox' | 'menu' | 'tree' | 'grid' | 'dialog'

/** The ARIA role of one item, which follows the popup's. */
export type ComboboxItemRole = 'option' | 'menuitem' | 'treeitem'

/**
 * The item role that belongs to a popup role.
 *
 * Port of Ariakit's `getItemRole` (`combobox-item.tsx`); a `grid` or `dialog`
 * popup falls back to `option`, as it does there.
 *
 * @example
 *   comboboxItemRole('listbox') // 'option'
 *   comboboxItemRole('menu') // 'menuitem'
 *   comboboxItemRole('tree') // 'treeitem'
 */
export const comboboxItemRole = (
  popupRole: ComboboxPopupRole,
): ComboboxItemRole => {
  if (popupRole === 'menu') return 'menuitem'
  if (popupRole === 'tree') return 'treeitem'
  return 'option'
}

/**
 * Whether a popup role is one that accepts `aria-multiselectable`.
 *
 * Port of Ariakit's `isCompositeRole` check in `combobox-list.tsx`: a `menu`
 * announces multiple selection through `aria-checked` on its items instead.
 */
export const isComboboxMultiSelectableRole = (
  popupRole: ComboboxPopupRole,
): boolean =>
  popupRole === 'listbox' || popupRole === 'tree' || popupRole === 'grid'

/** The minimal shape of an event every combobox record reads. */
export interface ComboboxPropsEvent {
  readonly defaultPrevented?: boolean
  preventDefault?: () => void
}

/**
 * An event that carries its targets.
 *
 * @remarks
 *   Both targets are `unknown` so that a real DOM event — whose `currentTarget`
 *   is `EventTarget | null` — stays assignable, and so a unit test can pass a
 *   plain object. The handlers narrow them at runtime.
 */
export interface ComboboxTargetedEvent extends ComboboxPropsEvent {
  readonly target: unknown
  readonly currentTarget: unknown
}

/**
 * An `input` event.
 *
 * @remarks
 *   `inputType` and `isComposing` live on the native `InputEvent`, which React
 *   wraps: its synthetic event carries them on `nativeEvent`. Both spellings
 *   are read, so the record binds correctly in either world.
 */
export interface ComboboxInputEvent extends ComboboxTargetedEvent {
  readonly inputType?: string
  readonly isComposing?: boolean
  readonly nativeEvent?: unknown
}

/** A `keydown` event. */
export interface ComboboxKeyboardEvent
  extends ComboboxTargetedEvent, ComboboxKeyEvent {
  /** A held-down key; Ariakit only resets the auto-select flag on the first one. */
  readonly repeat?: boolean
}

/** A `mousedown`, `click`, `mousemove`, or `mouseleave` event. */
export interface ComboboxMouseEvent
  extends ComboboxTargetedEvent, ComboboxPointerEvent {}

/** A `focus` or `blur` event. */
export interface ComboboxFocusEvent extends ComboboxTargetedEvent {
  /** Where focus went; `null` means it left the document. */
  readonly relatedTarget?: unknown
}

/** Props to spread on the combobox input element. */
export interface ComboboxInputProps {
  /** The input id, which the label points at; also the composite element id. */
  id: string
  role: 'combobox'
  /** The standard attribute {@link ComboboxAutoComplete} is named after. */
  'aria-autocomplete': ComboboxAutoComplete
  /** The role of the popup this input controls. */
  'aria-haspopup': ComboboxPopupRole
  'aria-expanded': boolean
  /** The list element, which must render the same id. */
  'aria-controls': string
  /**
   * The virtually focused item. `undefined` while `virtualFocus` is off — on a
   * Safari touch device, where the attribute is broken, or when the caller
   * opted out.
   */
  'aria-activedescendant': string | undefined
  /** Ariakit's styling hook for "the input itself is the active element". */
  'data-active-item': true | undefined
  /**
   * What the element must display, which is not always the model's value — see
   * {@link ComboboxModel.displayValue}.
   */
  value: string
  /**
   * Turns the browser's own autofill dropdown off, which would otherwise cover
   * the list. Ariakit sets the same attribute, and it is the reason the
   * combobox's own `autoComplete` option is a separate concept.
   */
  autoComplete: 'off'
  /**
   * `0` while the input holds focus for the widget, which with `virtualFocus`
   * is always. `undefined` — no attribute — otherwise, so the input keeps its
   * natural tab stop.
   */
  tabIndex: number | undefined
  /**
   * Assigns the composite `baseElement` and the popover's disclosure element,
   * which is what anchors the list to the input; `null` on unmount.
   */
  ref: (element: HTMLElement | null) => void
  /**
   * Stores what was typed, opens the list, and decides whether an inline
   * completion may apply.
   *
   * @remarks
   *   Ariakit's `onChange`, renamed to the event it actually needs. React's
   *   `onChange` on a text field _is_ the DOM `input` event; the DOM's own
   *   `change` event only fires on blur, which would filter the list long after
   *   the user typed.
   */
  onInput: (event: ComboboxInputEvent) => void
  /**
   * Re-enables the auto-select once an IME composition ends.
   *
   * @remarks
   *   Ariakit's comment: "the native input event that's passed to the change
   *   event above will not produce a consistent inputType value across
   *   browsers, so we can't rely on that there."
   */
  onCompositionEnd: (event?: ComboboxPropsEvent) => void
  /** Opens the list, blurs the active item, and commits an inlined value. */
  onMouseDown: (event: ComboboxMouseEvent) => void
  /** Opens the list, navigates it, and picks the active item on `Enter`. */
  onKeyDown: (event: ComboboxKeyboardEvent) => void
  /** Makes the input the active element when it takes DOM focus. */
  onFocus: (event: ComboboxFocusEvent) => void
  /** Commits an inlined value when focus leaves the widget. */
  onBlur: (event: ComboboxFocusEvent) => void
}

/** Props to spread on the label of the combobox input. */
export interface ComboboxLabelProps {
  /**
   * Labels the input. The DOM property name, so it works both as a React prop
   * and as a property assignment.
   */
  htmlFor: string
}

/** Props to spread on the element that holds the items. */
export interface ComboboxListProps {
  /** The id the input's `aria-controls` points at. */
  id: string
  role: ComboboxPopupRole
  /**
   * `true` while the combobox is multi-selectable, on a popup role that accepts
   * the attribute — see {@link isComboboxMultiSelectableRole}.
   */
  'aria-multiselectable': true | undefined
  hidden: boolean
  /** `{ display: 'none' }` while hidden, so a `display` rule cannot win. */
  style: { display: 'none' } | undefined
  /** Assigns the popover's `contentElement`; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
  /**
   * Commits an inlined value when focus leaves the widget from _inside_ the
   * list.
   *
   * @remarks
   *   The bubbling counterpart of the input's `onBlur`: without `virtualFocus`
   *   the items take DOM focus, so tabbing away happens on an item and the
   *   input blurred long before, back when focus entered the list. Ariakit
   *   registers the same `focusout` listener on both elements for exactly this
   *   (`combobox.tsx:424-446`).
   *
   *   `focusout` and not `blur`: the event has to bubble from the item. A React
   *   adapter binds it as `onBlur`, which is that event.
   */
  onFocusOut: (event: ComboboxFocusEvent) => void
}

/**
 * Props to spread on a popover that _is_ the list — Ariakit's
 * `ComboboxPopover`, which renders `ComboboxList` and `Popover` on one
 * element.
 */
export interface ComboboxPopoverProps
  extends
    Omit<PopoverContentProps, 'role'>,
    Pick<ComboboxListProps, 'role' | 'aria-multiselectable' | 'onFocusOut'> {}

/** Props to spread on one item element. */
export interface ComboboxItemProps {
  id: string
  /** Follows the popup role — see {@link comboboxItemRole}. */
  role: ComboboxItemRole
  /**
   * Only set while the combobox is multi-selectable: on a single-selectable
   * one, `aria-selected` would announce the _active_ item as selected, which is
   * not what pressing `Enter` on it would do.
   */
  'aria-selected': boolean | undefined
  'data-active-item': true | undefined
  /**
   * `-1` keeps a non-active item out of the tab order — the roving tabindex.
   * With `virtualFocus` no item is tabbable at all.
   */
  tabIndex: number | undefined
  /**
   * Assigns the element **and** registers the item as rendered, because the
   * element being in the DOM is exactly what that registration means. Pass
   * `null` on unmount.
   */
  ref: (element: HTMLElement | null) => void
  /** Picks the item: selects its value, fills the input, and closes the list. */
  onClick: (event?: ComboboxPropsEvent) => void
  /** Navigates, and hands a printable key to the input. */
  onKeyDown: (event: ComboboxKeyboardEvent) => void
  /** Focusing an item makes it the active one. */
  onFocus: (event: ComboboxFocusEvent) => void
  /** Activates the item under the pointer while `focusOnHover` is on. */
  onMouseMove: (event?: ComboboxMouseEvent) => void
  /** Blurs the item when the pointer leaves it, the counterpart of the above. */
  onMouseLeave: (event?: ComboboxMouseEvent) => void
}

/** Props to spread on the button that clears the input. */
export interface ComboboxCancelProps {
  type: 'button'
  'aria-label': string
  /**
   * Points at the input, which is what keeps the list open while this button
   * has focus — Ariakit's comment: "This aria-controls will ensure the combobox
   * popup remains visible when this element gets focused."
   */
  'aria-controls': string
  /**
   * `true` while the input is empty and
   * {@link ComboboxPropsOptions.hideWhenEmpty} is on. Ariakit unmounts the
   * button instead, which a prop record cannot do.
   */
  hidden: boolean
  /** Clears the value and moves the active item back to the input. */
  onClick: (event?: ComboboxPropsEvent) => void
}

/** Props to spread on the button that toggles the list. */
export interface ComboboxDisclosureProps {
  type: 'button'
  /**
   * Out of the tab order on purpose: the input next to it is the widget's tab
   * stop, and clicking this button moves focus there.
   */
  tabIndex: -1
  'aria-label': string
  'aria-expanded': boolean
  'aria-controls': string
  /**
   * Keeps the button from taking focus and moves the active item to the input
   * instead.
   */
  onMouseDown: (event?: ComboboxPropsEvent) => void
  /** Toggles the list, keeping the input as the element focus returns to. */
  onClick: (event?: ComboboxPropsEvent) => void
}

/** Options of {@link comboboxProps} and {@link withComboboxProps}. */
export interface ComboboxPropsOptions {
  /**
   * The ARIA role of the element that holds the items, which also decides the
   * item role and whether `aria-multiselectable` is emitted.
   *
   * @remarks
   *   Ariakit reads the role off the rendered element instead (`useAttribute(ref,
   *   'role')`), which makes the input's `aria-haspopup` wrong on the first
   *   render. Owning it as an option keeps every derived attribute correct from
   *   the start.
   * @default 'listbox'
   */
  popupRole?: ComboboxPopupRole
  /**
   * The minimum length the value must have before typing, clicking, or pressing
   * an arrow key opens the list.
   *
   * @default 0
   */
  showMinLength?: number
  /**
   * Whether typing opens the list. Defaults to the
   * {@link ComboboxPropsOptions.showMinLength} rule.
   */
  showOnChange?: boolean
  /** Whether clicking the input opens the list. Same default. */
  showOnClick?: boolean
  /** Whether an arrow key opens the list. Same default. */
  showOnKeyPress?: boolean
  /**
   * Whether typing stores the value in the model. Turn it off to derive the
   * value yourself.
   *
   * @default no `tag` — with a tag list the tag input owns the text
   */
  setValueOnChange?: boolean
  /**
   * Whether clicking the input stores the value the element _displays_, which
   * is how an inline completion is committed.
   *
   * @default true
   */
  setValueOnClick?: boolean
  /**
   * Whether clicking the input blurs the active item, i.e. makes the input
   * itself active.
   *
   * @default the model's `includesBaseElement`
   */
  blurActiveItemOnClick?: boolean
  /**
   * Whether hovering an item activates it. Off by default, as in Ariakit: on a
   * filtered list the pointer would fight the auto-select.
   *
   * @default false
   */
  focusOnHover?: boolean
  /**
   * Whether the cancel button reports `hidden` while the input is empty.
   * Ariakit unmounts the button instead, which a prop record cannot do.
   *
   * @default false
   */
  hideWhenEmpty?: boolean
  /**
   * The accessible name of the cancel button.
   *
   * @default 'Clear input'
   */
  cancelLabel?: string
  /**
   * The accessible name of the disclosure button while the list is closed.
   *
   * @default 'Show popup'
   */
  showLabel?: string
  /**
   * The accessible name of the disclosure button while the list is open.
   *
   * @default 'Hide popup'
   */
  hideLabel?: string
  /**
   * Keeps the list element visible even when it is not mounted, so a
   * third-party animation library can run its own exit transition.
   *
   * @default false
   */
  alwaysVisible?: boolean
  /** Forces the list's `hidden` prop. */
  hidden?: boolean
  /** Prefix of the prop record names. Defaults to the model name. */
  name?: string
}

/** Options of the {@link ComboboxPropRecords.item} record. */
export interface ComboboxItemPropsOptions {
  /**
   * Whether clicking the item adds its value to the selection.
   *
   * @default true
   */
  selectValueOnClick?: boolean
  /**
   * Whether clicking the item writes its value into the input.
   *
   * @default not multi-selectable — a multi-selectable combobox keeps the filter
   */
  setValueOnClick?: boolean
  /**
   * Whether clicking the item closes the list.
   *
   * @default not multi-selectable
   */
  hideOnClick?: boolean
  /**
   * Whether picking the item clears the input value.
   *
   * @default the model's `resetValueOnSelect`
   */
  resetValueOnSelect?: boolean
  /** Whether hovering this item activates it. Defaults to the model-wide option. */
  focusOnHover?: boolean
  /** The record name. Defaults to `${model}.props.item#${value}`. */
  name?: string
}

/** Reactive prop records of a combobox model. */
export interface ComboboxPropRecords {
  /** Props for the input element — the combobox itself. */
  input: Computed<ComboboxInputProps>
  /** Props for the label of the input. */
  label: Computed<ComboboxLabelProps>
  /** Props for the element that holds the items. */
  list: Computed<ComboboxListProps>
  /**
   * Props for a popover that _is_ the list: the popover's own `content` record
   * with the list's role and `aria-multiselectable` on top — Ariakit's
   * `ComboboxPopover`. Render it inside `combobox.popover.props.wrapper`, and
   * do not render {@link ComboboxPropRecords.list} as well.
   */
  popover: Computed<ComboboxPopoverProps>
  /**
   * Props for the element of one item value. The record is memoized per value,
   * so repeated calls keep the same identity; passing options returns a fresh,
   * uncached record whose policy is still remembered for the `Enter` key.
   */
  item: (
    value: string,
    options?: ComboboxItemPropsOptions,
  ) => Computed<ComboboxItemProps>
  /** Props for a button that clears the input. */
  cancel: Computed<ComboboxCancelProps>
  /** Props for a button that toggles the list. */
  disclosure: Computed<ComboboxDisclosureProps>
}

/** The resolved per item click policy, once the reactive defaults are read. */
interface ComboboxItemPolicy {
  selectValueOnClick: boolean
  setValueOnClick: boolean
  hideOnClick: boolean
  resetValueOnSelect: boolean
}

/**
 * Builds the reactive prop records of a combobox model.
 *
 * @remarks
 *   Each record is a `computed` returning a plain object, so it is memoized,
 *   lazy, traceable by name, and neutral about the view library: React spreads
 *   it, `@reatom/jsx` `$spread`s it, Vue `v-bind`s it. Handlers are created
 *   once and `wrap`ped, which re-enters the Reatom frame so the logger
 *   attributes the state change to the DOM event, and they `notify()` so a host
 *   framework sees the update in the same tick — the `bindField` precedent.
 *
 *   The item record is keyed by **value** rather than by composite item node,
 *   because the value is what a combobox item _is_: the record allocates the
 *   item id from it ({@link ComboboxModel.itemId}) and registers the item from
 *   its own `ref`. That is also why the composite's own `base` and `item`
 *   records are not reused here — they need a node that does not exist before
 *   the element mounts, and the input needs a dozen attributes they do not
 *   carry. The navigation half is the same {@link mapNavigationIntent} /
 *   {@link mapEntryIntent} pair they use.
 *
 *   Three Ariakit mechanics change shape:
 *
 *   - The custom `combobox-item-move` DOM event `ComboboxItem` dispatches on the
 *       input, so that `Combobox` can enable the inline completion, is gone:
 *       the model watches `composite.move` instead.
 *   - `Enter` on an open list picks the active item **here**. Ariakit re-fires the
 *       keyboard event on the active item element (`useKeyboardEventProxy`),
 *       which exists so that React handlers on the item component run; this
 *       port has no such indirection to preserve.
 *   - `useBooleanEvent` — every `showOn*` / `setValueOn*` prop being either a
 *       boolean or a predicate over the event — becomes a plain optional
 *       boolean. A consumer that needs the predicate can read the event in its
 *       own handler and toggle the model.
 *
 * @example
 *   const fruit = reatomCombobox({ name: 'fruit' })
 *
 *   fruit.props.input().role // 'combobox'
 *   fruit.props.item('Apple')().ref(element) // registers the item
 *   fruit.props.item('Apple')().onClick() // selects it and closes the list
 */
export const comboboxProps = (
  model: AnyComboboxModel,
  options: ComboboxPropsOptions = {},
): ComboboxPropRecords => {
  const {
    popupRole = 'listbox',
    showMinLength = 0,
    showOnChange,
    showOnClick,
    showOnKeyPress,
    setValueOnChange,
    setValueOnClick = true,
    blurActiveItemOnClick,
    focusOnHover: focusOnHoverDefault = false,
    hideWhenEmpty = false,
    cancelLabel = 'Clear input',
    showLabel = 'Show popup',
    hideLabel = 'Hide popup',
    alwaysVisible,
    hidden: hiddenProp,
    name = model.name,
  } = options

  const { composite, popover } = model
  const itemRole = comboboxItemRole(popupRole)
  const multiSelectableRole = isComboboxMultiSelectableRole(popupRole)

  /**
   * The per value option overrides, so `Enter` applies the same policy a click
   * would.
   */
  const itemOptions = new Map<string, ComboboxItemPropsOptions>()

  const policy = (value: string): ComboboxItemPolicy => {
    const {
      selectValueOnClick = true,
      setValueOnClick: itemSetValue,
      hideOnClick,
      resetValueOnSelect,
    } = itemOptions.get(value) ?? {}
    // Read once: both defaults are the same question, and Ariakit resolves them
    // from the same `Array.isArray(selectedValue)`.
    const multi = model.multiSelectable()

    return {
      selectValueOnClick,
      setValueOnClick: itemSetValue ?? !multi,
      hideOnClick: hideOnClick ?? !multi,
      resetValueOnSelect: resetValueOnSelect ?? model.resetValueOnSelect(),
    }
  }

  /** Ariakit's `ComboboxItem` click transition, in its order. */
  const activate = (value: string): void => {
    const resolved = policy(value)
    // `select` clears the value first, so a `setValueOnClick` that runs after it
    // still wins — which is how a single-selectable combobox ends up showing
    // what was picked.
    if (resolved.selectValueOnClick) {
      model.select(value, resolved.resetValueOnSelect)
    }
    if (resolved.setValueOnClick) model.set(value)
    if (resolved.hideOnClick) popover.hide()
  }

  /** The element's own value, which is what Ariakit's `canShow` measures. */
  const elementValue = (event: ComboboxTargetedEvent): string =>
    readComboboxInput(event.currentTarget).value

  const canShow = (event: ComboboxTargetedEvent, override?: boolean): boolean =>
    override ?? canShowComboboxList(elementValue(event), showMinLength)

  /**
   * Opens the list on `mouseup` rather than now.
   *
   * @remarks
   *   Ariakit's `queueBeforeEvent(currentTarget, 'mouseup', store.show)`: showing
   *   during `mousedown` would be undone by the browser's own focus handling
   *   for the same event. Without a DOM there is nothing to race, so the show
   *   is immediate — which is what a node test sees.
   */
  const showBeforeMouseUp = (target: unknown): void => {
    const element = target as EventTarget | null
    if (
      element &&
      typeof (element as EventTarget).addEventListener === 'function' &&
      typeof requestAnimationFrame === 'function'
    ) {
      queueBeforeEvent(element, 'mouseup', () => {
        popover.show()
        notify()
      })
      return
    }
    popover.show()
  }

  /**
   * The navigation half of the input's `onKeyDown`, i.e. Ariakit's
   * `useComposite`.
   */
  const navigateFromInput = (event: ComboboxKeyboardEvent): void => {
    const virtual = composite.virtualFocus()
    const active = composite.activeItem()
    // The input is always a text field, which is what keeps Home, End, and the
    // horizontal arrows with the caret.
    const shape = {
      orientation: composite.orientation(),
      baseIsTextField: true,
    }

    // With virtual focus the input is the only focused element, so it has to map
    // the keys the active item would.
    const intent =
      virtual && active
        ? mapNavigationIntent(event, {
            ...shape,
            grid: active.rowId() !== undefined,
          })
        : mapEntryIntent(event, shape)
    if (!intent) return

    if (composite.navigate(intent) !== undefined) event.preventDefault?.()
  }

  // --- the input -------------------------------------------------------------

  const inputRef = wrap((element: HTMLElement | null) => {
    // The input is the composite element, and the popover's anchor fallback
    // reads it from there — Ariakit's combobox store syncs the anchor from
    // `baseElement || disclosureElement` (`combobox-store.ts:133-157`), so an
    // explicit anchor set through `popover.props.anchor` wins over the input.
    composite.baseElement.set(element)
    // The input is also the disclosure, so Escape and focus restoration land on
    // it rather than on the disclosure button (`combobox-disclosure.tsx`: "The
    // combobox input should remain the disclosure element").
    popover.disclosureElement.set(element)
  })

  const onInput = wrap((event: ComboboxInputEvent) => {
    if (event.defaultPrevented) return

    const element = event.currentTarget
    const reading = readComboboxInput(element, event.nativeEvent ?? event)
    const { value, selectionStart, selectionEnd, isComposing } = reading

    // Ariakit sets the flag and clears it again for a composition: an IME
    // insertion is not a keystroke the user finished, and `onCompositionEnd`
    // sets it once they did.
    model.canAutoSelect.set(!isComposing)

    if (model.inline()) model.canInline.set(canComboboxInline(reading))

    // With a tag list the tag input owns the text, and writing it here would
    // race its own delimiter handling.
    if (setValueOnChange ?? !model.tag) {
      model.set(value)
      // The value reaches the element through the view, i.e. after this
      // handler, and re-assigning `value` moves the caret to the end.
      queueMicrotask(
        wrap(() =>
          setComboboxInputCaret(element, selectionStart, selectionEnd),
        ),
      )
    }

    if (canShow(event, showOnChange)) popover.show()

    // Ariakit: "If autoSelect is not set or it's not an insertion of text, focus
    // on the combobox input after changing the value." The auto-select itself
    // is `withComboboxAutoSelect()`, which needs a lifetime.
    if (!model.autoSelecting()) composite.set(null)

    notify()
  })

  const onCompositionEnd = wrap((event?: ComboboxPropsEvent) => {
    model.canAutoSelect.set(true)
    if (event?.defaultPrevented) return
    notify()
  })

  const onMouseDown = wrap((event: ComboboxMouseEvent) => {
    if (event.defaultPrevented) return
    if (!isComboboxPrimaryPress(event)) return

    // Read before the active item is blurred: the displayed value is what the
    // click commits, and blurring the item would already have cleared it.
    const displayed = model.displayValue()

    if (blurActiveItemOnClick ?? composite.includesBaseElement()) {
      composite.set(null)
    }
    if (setValueOnClick) model.set(displayed)
    if (canShow(event, showOnClick)) showBeforeMouseUp(event.currentTarget)

    notify()
  })

  const onKeyDown = wrap((event: ComboboxKeyboardEvent) => {
    // Ariakit's comment: "Run combobox-tabs and combobox-group (browser) tests."
    // A repeated key is the same interaction, so it must not disable an
    // auto-select the first press enabled.
    if (!event.repeat) model.canAutoSelect.set(false)
    if (event.defaultPrevented) return notify()

    const open = popover()

    if (isComboboxEnterBlocked(event, open)) {
      // Never let Enter submit an enclosing form while the list is open.
      event.preventDefault?.()
      const value = model.itemValue(composite())
      // An unknown active item — the input itself, or an item with no value —
      // makes Enter a no-op, which is Ariakit's behavior for a stale activeId.
      if (value !== undefined && !model.item(value)?.disabled()) {
        activate(value)
      }
      return notify()
    }

    if (!open && isComboboxShowKey(event) && canShow(event, showOnKeyPress)) {
      event.preventDefault?.()
      popover.show()
      return notify()
    }

    if (!isSelfTarget(event)) return notify()
    navigateFromInput(event)
    notify()
  })

  const onFocus = wrap((event: ComboboxFocusEvent) => {
    if (event.defaultPrevented) return
    if (!isSelfTarget(event)) return
    // With virtual focus the input never stops being the focused element, so a
    // focus event says nothing about which item is active.
    if (composite.virtualFocus()) return
    composite.set(null)
    notify()
  })

  /**
   * The inline completion is only a display value until the widget is left;
   * then it becomes the state, which is what makes it survive the blur.
   *
   * Focus moving into the list, or between two items, is not a blur of the
   * widget — the user is still choosing.
   */
  const commitInline = (event: ComboboxFocusEvent): void => {
    if (!model.inline()) return

    const leaving = isFocusLeavingCombobox(event.relatedTarget, [
      composite.baseElement(),
      popover.contentElement(),
    ])
    if (leaving) model.set(model.displayValue())
  }

  const onBlur = wrap((event: ComboboxFocusEvent) => {
    // Ariakit's comment: "If we don't reset the canAutoSelectRef here, the
    // combobox will keep the first item selected when the combobox loses focus
    // and its value gets cleared."
    model.canAutoSelect.set(false)
    if (event.defaultPrevented) return notify()

    commitInline(event)
    notify()
  })

  // --- the list --------------------------------------------------------------

  const listRef = wrap((element: HTMLElement | null) => {
    popover.contentElement.set(element)
  })

  const onListFocusOut = wrap((event: ComboboxFocusEvent) => {
    if (event.defaultPrevented) return
    commitInline(event)
    notify()
  })

  const ariaMultiSelectable = (): true | undefined =>
    multiSelectableRole && model.multiSelectable() ? true : undefined

  // --- the buttons -----------------------------------------------------------

  const onCancelClick = wrap((event?: ComboboxPropsEvent) => {
    if (event?.defaultPrevented) return
    model.set('')
    // A move, not a plain write: focus has to follow back to the input.
    composite.move(null)
    notify()
  })

  const onDisclosureMouseDown = wrap((event?: ComboboxPropsEvent) => {
    // Ariakit's comment: "We have to prevent the element from getting focused on
    // mousedown. This will immediately move focus to the combobox input."
    event?.preventDefault?.()
    composite.move(null)
    notify()
  })

  const onDisclosureClick = wrap((event?: ComboboxPropsEvent) => {
    if (event?.defaultPrevented) return
    // Ariakit's `ComboboxDisclosure` uses `DialogDisclosure` and not
    // `PopoverDisclosure` on purpose: the anchor must stay the input. The
    // disclosure element is the input too, so that Escape and focus restoration
    // land there.
    const base = composite.baseElement()
    if (base) popover.disclosureElement.set(base)
    popover.toggle()
    notify()
  })

  // --- the item --------------------------------------------------------------

  const itemRecord = (
    value: string,
    options: ComboboxItemPropsOptions = {},
  ): Computed<ComboboxItemProps> => {
    const id = model.itemId(value)
    const {
      focusOnHover = focusOnHoverDefault,
      // `#value` and not `#id`: the logger reads better with the text the user
      // sees, and it is the collection's own `items#id` convention.
      name: recordName = `${name}.props.item#${value}`,
    } = options

    const ref = wrap((element: HTMLElement | null) => {
      if (element) model.renderItem(value, { element })
      else model.unrenderItem(value)
    })

    const onClick = wrap((event?: ComboboxPropsEvent) => {
      if (event?.defaultPrevented) return
      activate(value)
      notify()
    })

    const onItemFocus = wrap((event: ComboboxFocusEvent) => {
      if (event.defaultPrevented) return
      // Items can nest (a tree), and then a child's focus event bubbles through
      // its parent item — which must not steal it.
      if (!isSelfTarget(event)) return
      composite.set(id)
      notify()
    })

    const onItemKeyDown = wrap((event: ComboboxKeyboardEvent) => {
      if (event.defaultPrevented) return
      if (!isSelfTarget(event)) return

      const base = composite.baseElement()
      // With `virtualFocus` the input keeps DOM focus, so a key press never
      // reaches an item and this branch is for the roving-tabindex mode only.
      if (base && !hasFocus(base) && isComboboxTypeaheadKey(event)) {
        // Deliberately no `preventDefault`: the microtask runs before the
        // browser performs the key's default action, so the character the user
        // pressed is inserted into the input that just received focus. That is
        // the whole trick of "start typing anywhere".
        queueMicrotask(wrap(() => base.focus()))
        // Ariakit: "the value may temporarily change based on the currently
        // selected item, but it'll be reset to the original value when the
        // combobox input is focused" — so the display value becomes the state.
        if (isTextFieldElement(base)) {
          model.set(readComboboxInput(base).value)
        }
        notify()
        return
      }

      const node = composite.items.item(id)
      const intent = mapNavigationIntent(event, {
        orientation: composite.orientation(),
        grid: node?.rowId() !== undefined,
      })
      if (!intent) return

      if (composite.navigate(intent) !== undefined) event.preventDefault?.()
      notify()
    })

    const onMouseMove = wrap(() => {
      if (!focusOnHover) return
      // A plain write and not a `move`: hovering is not a commitment, which is
      // exactly what keeps `activeValue` — and the inline completion — empty.
      composite.set(id)
      notify()
    })

    const onMouseLeave = wrap(() => {
      if (!focusOnHover) return
      composite.set(null)
      notify()
    })

    return computed((): ComboboxItemProps => {
      const node = composite.items.item(id)
      const multi = model.multiSelectable()

      return {
        id,
        role: itemRole,
        'aria-selected': multi ? model.isSelected(value) : undefined,
        'data-active-item': composite() === id || undefined,
        // An unregistered item keeps its natural tab stop, which is the
        // composite's own fallback for an item it does not know yet.
        tabIndex: node && !node.tabbable() ? -1 : undefined,
        ref,
        onClick,
        onKeyDown: onItemKeyDown,
        onFocus: onItemFocus,
        onMouseMove,
        onMouseLeave,
      }
    }, recordName)
  }

  const itemRecords = new Map<string, Computed<ComboboxItemProps>>()

  return {
    input: computed((): ComboboxInputProps => {
      const virtual = composite.virtualFocus()

      return {
        id: composite.id(),
        role: 'combobox',
        'aria-autocomplete': model.autoComplete(),
        'aria-haspopup': popupRole,
        'aria-expanded': popover(),
        'aria-controls': popover.contentId(),
        'aria-activedescendant': composite.activeDescendant(),
        'data-active-item': composite() === null || undefined,
        value: model.displayValue(),
        autoComplete: 'off',
        tabIndex: virtual || composite() === null ? 0 : undefined,
        ref: inputRef,
        onInput,
        onCompositionEnd,
        onMouseDown,
        onKeyDown,
        onFocus,
        onBlur,
      }
    }, `${name}.props.input`),

    label: computed(
      (): ComboboxLabelProps => ({ htmlFor: composite.id() }),
      `${name}.props.label`,
    ),

    list: computed((): ComboboxListProps => {
      const hidden = isDisclosureContentHidden(
        popover.mounted(),
        hiddenProp,
        alwaysVisible,
      )

      return {
        id: popover.contentId(),
        role: popupRole,
        'aria-multiselectable': ariaMultiSelectable(),
        hidden,
        style: hidden ? { display: 'none' } : undefined,
        ref: listRef,
        onFocusOut: onListFocusOut,
      }
    }, `${name}.props.list`),

    popover: computed(
      (): ComboboxPopoverProps => ({
        ...popover.props.content(),
        role: popupRole,
        'aria-multiselectable': ariaMultiSelectable(),
        onFocusOut: onListFocusOut,
      }),
      `${name}.props.popover`,
    ),

    item: (value, itemPropsOptions) => {
      // Remembered even for an uncached record, because `Enter` on the input has
      // to apply the same policy the item's own click would.
      if (itemPropsOptions) {
        itemOptions.set(value, itemPropsOptions)
        return itemRecord(value, itemPropsOptions)
      }

      let record = itemRecords.get(value)
      if (!record) itemRecords.set(value, (record = itemRecord(value)))
      return record
    },

    cancel: computed(
      (): ComboboxCancelProps => ({
        type: 'button',
        'aria-label': cancelLabel,
        'aria-controls': composite.id(),
        hidden: hideWhenEmpty && model() === '',
        onClick: onCancelClick,
      }),
      `${name}.props.cancel`,
    ),

    disclosure: computed((): ComboboxDisclosureProps => {
      const open = popover()

      return {
        type: 'button',
        tabIndex: -1,
        'aria-label': open ? hideLabel : showLabel,
        'aria-expanded': open,
        'aria-controls': popover.contentId(),
        onMouseDown: onDisclosureMouseDown,
        onClick: onDisclosureClick,
      }
    }, `${name}.props.disclosure`),
  }
}

/**
 * Attaches {@link comboboxProps} to a combobox model as `model.props`.
 *
 * {@link reatomCombobox} applies it already; use it explicitly when composing a
 * combobox model by hand.
 */
export const withComboboxProps = (
  options: ComboboxPropsOptions = {},
): AssignerExt<{ props: ComboboxPropRecords }, AnyComboboxModel> => {
  return (target) => ({ props: comboboxProps(target, options) })
}
