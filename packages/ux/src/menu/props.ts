/**
 * Layer 2 for `menu`: the reactive prop records.
 *
 * A menu is where the two spines of this package meet on the same elements: the
 * menu element is both the popover content and the composite container, and a
 * submenu button is both a menu item of its parent and the disclosure of its
 * own popover. Ariakit expresses that by _stacking hooks_ — `useMenuButton` is
 * `useHovercardAnchor` + `usePopoverDisclosure`, and `<MenuItem
 * render={<MenuButton />}>` stacks a composite item on top of it — so the
 * records here merge the same layers by hand, which is what keeps one element
 * from needing two `ref`s and two `onKeyDown`s.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/menu/menu-button.tsx`,
 * `menu-list.tsx`, `menu.tsx`, `menu-item.tsx`, `menu-item-checkbox.tsx`,
 * `menu-item-radio.tsx`, `menu-separator.tsx`, and the
 * `packages/ariakit-react-components/src/composite/composite-hover.tsx` half of
 * a menu item.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed, notify, wrap } from '@reatom/core'

import type { CompositeOrientation } from '../composite/getNextId'
import type {
  CompositeBaseProps,
  CompositeItemProps,
  CompositeItemPropsOptions,
  CompositePropRecords,
} from '../composite/props'
import { compositeItemProps } from '../composite/props'
import type {
  CompositeItemNode,
  CompositeModel,
} from '../composite/reatomComposite'
import { compositeElementId } from '../composite/reatomComposite'
import { contains } from '../dialog/dialogDom'
import type { PointerMovementEvent } from '../hovercard/hovercardIntent'
import { mapHovercardShowIntent } from '../hovercard/hovercardIntent'
import type {
  HovercardPropRecords,
  HovercardPropsOptions,
} from '../hovercard/props'
import { hovercardProps } from '../hovercard/props'
import { scheduleHovercardDelay } from '../hovercard/reatomHovercard'
import { getPopoverSide } from '../popover/popoverPlacement'
import type { PopoverContentProps } from '../popover/props'
import type { MenuItemLinkDescriptor } from './menuIntent'
import {
  hasExpandedMenuItem,
  isMenuItemNavigating,
  mapMenuButtonClickIntent,
  mapMenuButtonKeyIntent,
  mapMenuListKeyIntent,
  resolveMenuShowOnHover,
  shouldHideMenuOnItemClick,
} from './menuIntent'
import type { MenuItemValue } from './menuValues'
import { nextMenuCheckboxValue, nextMenuRadioValue } from './menuValues'
import type { MenuModel } from './reatomMenu'

/** The `id` a menu button renders when none is given. */
export const menuButtonId = (name: string): string =>
  `${compositeElementId(name)}-button`

/**
 * The `aria-orientation` a menu announces.
 *
 * `'both'` has no ARIA counterpart — a widget that navigates on both axes must
 * not claim an axis — matching Ariakit's `state.orientation === 'both' ?
 * undefined : state.orientation` (`menu-list.tsx`).
 *
 * @example
 *   menuAriaOrientation('vertical') // 'vertical'
 *   menuAriaOrientation('both') // undefined
 */
export const menuAriaOrientation = (
  orientation: CompositeOrientation,
): 'horizontal' | 'vertical' | undefined =>
  orientation === 'both' ? undefined : orientation

/**
 * The orientation of a separator inside a menu: perpendicular to the axis the
 * items are navigated on, so the usual vertical menu is divided by horizontal
 * rules.
 *
 * `'both'` falls back to `'horizontal'`, which is Ariakit's own default for a
 * widget with no single axis (`composite-separator.tsx`).
 *
 * @example
 *   menuSeparatorOrientation('vertical') // 'horizontal'
 *   menuSeparatorOrientation('horizontal') // 'vertical'
 */
export const menuSeparatorOrientation = (
  orientation: CompositeOrientation,
): 'horizontal' | 'vertical' =>
  orientation === 'horizontal' ? 'vertical' : 'horizontal'

/**
 * The minimal shape of an event every menu record reads.
 *
 * Structural on purpose, and every member optional: a DOM event, a React
 * synthetic event, and a plain object from a unit test all satisfy it.
 */
export interface MenuPropsEvent {
  readonly defaultPrevented?: boolean
  preventDefault?: () => void
  stopPropagation?: () => void
}

/**
 * An event that carries its targets.
 *
 * Both are `unknown` so a real DOM event — whose `currentTarget` is
 * `EventTarget | null` — stays assignable; the handlers narrow them at
 * runtime.
 */
export interface MenuTargetedEvent extends MenuPropsEvent {
  readonly target?: unknown
  readonly currentTarget?: unknown
}

/** A `keydown` event. */
export interface MenuKeyboardEvent extends MenuTargetedEvent {
  readonly key: string
}

/** A `focus` or `blur` event. */
export interface MenuFocusEvent extends MenuTargetedEvent {}

/** A `click`, `mousemove`, or `mouseleave` event. */
export interface MenuMouseEvent
  extends MenuTargetedEvent, PointerMovementEvent {
  /** The click count, `0` for the click Enter or Space generates on a button. */
  readonly detail?: number
  readonly metaKey?: boolean
  readonly ctrlKey?: boolean
  readonly altKey?: boolean
  /** Where the pointer went, for the hover-out policy of an item. */
  readonly relatedTarget?: unknown
}

/** Props to spread on the button that opens the menu. */
export interface MenuButtonProps {
  /** The button id, which the menu's `aria-labelledby` points at. */
  id: string
  /**
   * `'menuitem'` while the button lives inside a parent menu or a menubar,
   * `undefined` for a lone dropdown button — Ariakit's `getPopupItemRole`
   * fallback, which is always `menuitem` here because a menu popup is a `menu`
   * and a menubar is a `menubar`.
   */
  role: 'menuitem' | undefined
  /** The role of the popup this button controls. */
  'aria-haspopup': 'menu'
  'aria-expanded': boolean
  /** Points at the menu element, which renders the same id. */
  'aria-controls': string
  /**
   * Keeps a `<button>` inside a `<form>` from submitting it. Ariakit renders a
   * submenu button as a `div` instead — VoiceOver + Space fires `click` twice
   * on a native button with `role="menuitem"`
   * ([webkit#228318](https://bugs.webkit.org/show_bug.cgi?id=228318)) — in
   * which case the attribute is inert.
   */
  type: 'button'
  /** Assigns the model's `disclosureElement` **and** `anchorElement`. */
  ref: (element: HTMLElement | null) => void
  /** Opens, or toggles, the menu. */
  onClick: (event?: MenuMouseEvent) => void
  /**
   * Disarms the menu's focus, clears its active item, and — in a menubar whose
   * other menu is open — swaps the open menu for this one.
   */
  onFocus: (event?: MenuFocusEvent) => void
  /** Clears {@link MenuModel.disclosureFocused}. */
  onBlur: (event?: MenuFocusEvent) => void
  /** Opens the menu at its first or last item, per the arrow key. */
  onKeyDown: (event: MenuKeyboardEvent) => void
  /** Opens the menu on hover, where the context asks for it. */
  onMouseMove: (event?: MenuMouseEvent) => void
  /** Cancels a pending hover-open. */
  onMouseLeave: (event?: MenuMouseEvent) => void
}

/**
 * Props to spread on a submenu button: a menu button that is also an item of
 * the menu or menubar it hangs off.
 */
export interface MenuItemButtonProps
  extends
    Omit<CompositeItemProps, 'onKeyDown' | 'onFocus' | 'ref'>,
    MenuButtonProps {}

/**
 * Props to spread on the menu element — Ariakit's `MenuList`, the menu without
 * a popover around it.
 */
export interface MenuListProps extends CompositeBaseProps {
  /** The [`menu`](https://w3c.github.io/aria/#menu) role. */
  role: 'menu'
  /**
   * The axis the items are laid out on, or `undefined` when the composite
   * navigates on both axes and no single orientation can be announced.
   */
  'aria-orientation': 'horizontal' | 'vertical' | undefined
  /**
   * The menu button, unless the menu has a label or a heading of its own —
   * Ariakit's `useAriaLabelledBy` (`menu-list.tsx`).
   */
  'aria-labelledby': string | undefined
  hidden: boolean
  /** `{ display: 'none' }` while hidden, so a `display` rule cannot win. */
  style: { display: 'none' } | undefined
  /** Assigns the model's `contentElement` **and** the composite's `baseElement`. */
  ref: (element: HTMLElement | null) => void
  /** Leaves the menu — closes a submenu, or moves along a menubar. */
  onKeyDown: (event: MenuKeyboardEvent) => void
}

/**
 * Props to spread on a menu that _is_ a popover — Ariakit's `Menu`, which is
 * `MenuList` rendered by a `Hovercard`.
 *
 * Render it inside {@link MenuPropRecords.wrapper}, and do not render
 * {@link MenuPropRecords.list} as well.
 */
export interface MenuPopoverProps
  extends
    Omit<PopoverContentProps, 'role' | 'ref' | 'onKeyDown'>,
    Pick<
      MenuListProps,
      | 'role'
      | 'aria-orientation'
      | 'aria-activedescendant'
      | 'ref'
      | 'onKeyDown'
    > {
  /**
   * Focusing the menu element itself clears the active item, and arms the focus
   * restore — the composite and hovercard halves of the same event.
   */
  onFocus: (event?: MenuFocusEvent) => void
}

/** Props to spread on a menu item element. */
export interface MenuItemProps extends CompositeItemProps {
  /** The [`menuitem`](https://w3c.github.io/aria/#menuitem) role. */
  role: 'menuitem'
  /**
   * Runs the command: closes the whole menu tree, unless the policy says not
   * to.
   */
  onClick: (event?: MenuMouseEvent) => void
  /** Activates the item under the pointer, and moves focus to it. */
  onMouseMove: (event?: MenuMouseEvent) => void
  /** Hands focus back to the menu element when the pointer leaves the item. */
  onMouseLeave: (event?: MenuMouseEvent) => void
}

/** Props to spread on a checkbox menu item. */
export interface MenuItemCheckboxProps extends Omit<MenuItemProps, 'role'> {
  /**
   * The [`menuitemcheckbox`](https://w3c.github.io/aria/#menuitemcheckbox)
   * role.
   */
  role: 'menuitemcheckbox'
  'aria-checked': boolean
  /** The field of the menu's `values` this item projects. */
  name: string
  /** The item's own value, for a field that holds a group. */
  value: MenuItemValue | undefined
}

/** Props to spread on a radio menu item. */
export interface MenuItemRadioProps extends Omit<MenuItemProps, 'role'> {
  /** The [`menuitemradio`](https://w3c.github.io/aria/#menuitemradio) role. */
  role: 'menuitemradio'
  'aria-checked': boolean
  /** The field of the menu's `values` this item projects. */
  name: string
  value: MenuItemValue
}

/** Props to spread on a divider between menu items. */
export interface MenuSeparatorProps {
  role: 'separator'
  /** Perpendicular to the menu, see {@link menuSeparatorOrientation}. */
  'aria-orientation': 'horizontal' | 'vertical'
}

/** Options of the {@link MenuPropRecords.item} record and its two variants. */
export interface MenuItemPropsOptions extends CompositeItemPropsOptions {
  /**
   * Whether clicking the item closes the whole menu tree. Defaults to the
   * model-wide {@link MenuPropsOptions.hideOnClick}, which is `true` — except
   * for a checkbox or radio item, where Ariakit defaults it to `false` so the
   * menu stays open while several boxes are ticked.
   */
  hideOnClick?: boolean
  /** Whether hovering the item activates it. Defaults to the model-wide option. */
  focusOnHover?: boolean
  /** Whether leaving the item deactivates it. Defaults to `focusOnHover`. */
  blurOnHoverEnd?: boolean
}

/** Options of the {@link MenuPropRecords.itemCheckbox} record. */
export interface MenuItemCheckboxPropsOptions extends MenuItemPropsOptions {
  /**
   * The field of the menu's `values` the item projects — Ariakit's `name` prop,
   * renamed because `name` is the unit name by repo convention.
   */
  field: string
  /**
   * The item's own value. Omit it for a boolean field, which the item then owns
   * on its own; pass it for a field that holds a group of values.
   */
  value?: MenuItemValue
}

/** Options of the {@link MenuPropRecords.itemRadio} record. */
export interface MenuItemRadioPropsOptions extends MenuItemPropsOptions {
  /** The field of the menu's `values` — the radio group. */
  field: string
  /** The item's own value, which the group holds while the item is checked. */
  value: MenuItemValue
}

/** Options of {@link menuProps} and {@link withMenuProps}. */
export interface MenuPropsOptions extends HovercardPropsOptions {
  /**
   * The `id` of the menu button. Defaults to a DOM-safe derivation of the model
   * name, and is what the menu's `aria-labelledby` points at.
   *
   * A submenu button rendered with {@link MenuPropRecords.itemButton} carries
   * the item's id instead — one element has one id, and the composite item owns
   * it — so the menu is labelled by whichever of the two was rendered.
   */
  buttonId?: string
  /**
   * Whether hovering the menu button opens the menu, pinning the contextual
   * policy of {@link resolveMenuShowOnHover}.
   *
   * @remarks
   *   Ariakit resolves the same question per event, from a callback that falls
   *   back to "a submenu always, a menubar menu while the bar is active, a lone
   *   dropdown never". The option is what pins it, because the model's
   *   `showOnHover` atom can only turn hover-open _on_: the "another menu of
   *   this bar is open" half is an `aria-expanded` read on the bar's items,
   *   which no derivation can subscribe to.
   */
  showOnHover?: boolean
  /**
   * Whether hovering a menu item activates it — Ariakit's `focusOnHover`, whose
   * default for a menu item is `true`.
   *
   * @default true
   */
  focusOnHover?: boolean
  /**
   * Whether the pointer leaving an item deactivates it, handing focus back to
   * the menu element. Ariakit's `blurOnHoverEnd` default for an item _inside a
   * menu_ (as opposed to a menubar) is exactly this.
   *
   * @default the resolved `focusOnHover`
   */
  blurOnHoverEnd?: boolean
  /**
   * Whether clicking a menu item closes the whole menu tree.
   *
   * @default true
   */
  hideOnClick?: boolean
  /**
   * The composite records the menu ARIA is layered onto. Defaults to
   * `model.composite.props`, which {@link reatomComposite} fills in.
   *
   * Pass it explicitly only when the composite records live somewhere else than
   * on the sub-model — a wrapper widget that renames them, or a test that
   * layers the menu ARIA onto records it built itself.
   */
  composite?: CompositePropRecords
}

/** Reactive prop records of a menu model. */
export interface MenuPropRecords extends Omit<
  HovercardPropRecords,
  'anchor' | 'disclosure' | 'content'
> {
  /**
   * Props for the button that opens the menu. It is the popover's disclosure
   * _and_ its anchor, and the hovercard's anchor: a menu button is all three,
   * which is why the hovercard's own `anchor` and hidden keyboard `disclosure`
   * records are not part of this set.
   */
  button: Computed<MenuButtonProps>
  /**
   * Props for a submenu button — the same button, plus the composite item it
   * occupies in the parent menu or menubar. Render this instead of pairing
   * {@link MenuPropRecords.button} with the parent's own item record, which
   * would drop one of the two sets of handlers.
   *
   * The record is memoized per item; passing options returns a fresh, uncached
   * one.
   */
  itemButton: (
    item: CompositeItemNode,
    options?: MenuItemPropsOptions,
  ) => Computed<MenuItemButtonProps>
  /**
   * Props for the menu element on its own — Ariakit's `MenuList`. Use it for a
   * menu that is not a popover (an always-open list, a sliding panel); a
   * dropdown renders {@link MenuPropRecords.popover} instead.
   */
  list: Computed<MenuListProps>
  /** Props for the menu element as the popover content — Ariakit's `Menu`. */
  popover: Computed<MenuPopoverProps>
  /**
   * Props for one item element. The record is memoized per item, so repeated
   * calls keep the same identity; passing options returns a fresh, uncached
   * record.
   */
  item: (
    item: CompositeItemNode,
    options?: MenuItemPropsOptions,
  ) => Computed<MenuItemProps>
  /**
   * Props for a checkbox item, which projects one field of the menu's `values`.
   * Memoized per item, field, and value.
   */
  itemCheckbox: (
    item: CompositeItemNode,
    options: MenuItemCheckboxPropsOptions,
  ) => Computed<MenuItemCheckboxProps>
  /**
   * Props for a radio item of the group one field of `values` holds. Memoized
   * per item, field, and value.
   */
  itemRadio: (
    item: CompositeItemNode,
    options: MenuItemRadioPropsOptions,
  ) => Computed<MenuItemRadioProps>
  /**
   * Props for a divider between items. A separator is not an item: it is not
   * registered, not navigable, and not focusable.
   */
  separator: Computed<MenuSeparatorProps>
}

/** The element fields the item click policy reads. */
const describeItemElement = (target: unknown): MenuItemLinkDescriptor => {
  const element = target as
    | { tagName?: unknown; type?: unknown }
    | null
    | undefined
  const tagName =
    typeof element?.tagName === 'string' ? element.tagName.toLowerCase() : ''
  return {
    tagName,
    type: typeof element?.type === 'string' ? element.type : undefined,
  }
}

/**
 * Whether the element is a disclosure of something — a submenu button, a dialog
 * trigger — which is what keeps a click on it from closing the tree.
 *
 * Ariakit reads the same attribute off `event.currentTarget`, because a menu
 * item cannot know what a consumer rendered inside it.
 */
const hasPopupAttribute = (target: unknown): boolean => {
  const element = target as Element | null | undefined
  if (typeof element?.getAttribute !== 'function') return false
  const popup = element.getAttribute('aria-haspopup')
  return !!popup && popup !== 'false'
}

/**
 * Builds the reactive prop records of a menu model.
 *
 * @remarks
 *   Each record is a `computed` returning a plain object, so it is memoized,
 *   lazy, traceable by name, and neutral about the view library: React spreads
 *   it, `@reatom/jsx` `$spread`s it, Vue `v-bind`s it. Handlers are created
 *   once and `wrap`ped, which re-enters the Reatom frame so the logger
 *   attributes the state change to the DOM event, and they `notify()` so a host
 *   framework sees the update in the same tick — the `bindField` precedent.
 *
 *   The hovercard records are composed, not reimplemented: `wrapper`, `arrow`,
 *   `backdrop`, `dismiss`, `heading`, `description`, and `focusTrap` are the
 *   hovercard's own, and the popover record is its `content` with the composite
 *   container merged into it. The two records the hovercard uses to open itself
 *   are gone, because a menu opens from a real button: the anchor record (a
 *   hovered, non-focusable element) and the visually hidden keyboard disclosure
 *   are both {@link MenuPropRecords.button} here.
 *
 *   Four Ariakit mechanics change shape:
 *
 *   - Hover activation of an item is `composite.move`, not `setActiveId` plus a
 *       manual `baseElement.focus()`. Ariakit keeps DOM focus on the container
 *       and marks the item, then re-fires keyboard events on the marked item;
 *       here the move _is_ the focus event ({@link withCompositeFocus}), so the
 *       keyboard keeps working from wherever the pointer left off, and a
 *       submenu button under the pointer gets the real focus Ariakit gives it
 *       by hand.
 *   - `movingToAnotherItem` — Ariakit marks every item element with a private
 *       `Symbol` so an item can tell whether the pointer left for a sibling —
 *       is a walk of the item collection instead, which already knows every
 *       item element.
 *   - `useBooleanEvent`, i.e. every policy prop being either a boolean or a
 *       predicate over the event, becomes a plain optional boolean. A consumer
 *       that needs the predicate reads the event in its own handler.
 *   - The `id` a menu is labelled by is the button's own `id` prop rather than a
 *       DOM read of `disclosureElement.id`, so `aria-labelledby` is right on
 *       the first render instead of after an effect.
 *
 * @example
 *   const edit = reatomMenu({ name: 'edit' })
 *   const undo = edit.composite.items.renderItem({ id: 'undo' })
 *
 *   edit.props.button().onClick({ detail: 0 }) // a keyboard click
 *   edit() // true
 *   edit.initialFocusPolicy() // 'first'
 *   edit.props.item(undo)().onClick() // runs the command, closes the tree
 */
export const menuProps = (
  model: MenuModel,
  options: MenuPropsOptions = {},
): MenuPropRecords => {
  const {
    alwaysVisible,
    hidden,
    fixed,
    arrowSize,
    buttonId: initButtonId,
    showOnHover,
    focusOnHover: initFocusOnHover = true,
    blurOnHoverEnd: initBlurOnHoverEnd = initFocusOnHover,
    hideOnClick: initHideOnClick = true,
    name = model.name,
  } = options

  const hovercard = hovercardProps(model, {
    alwaysVisible,
    hidden,
    fixed,
    arrowSize,
    name,
  })
  const composite = model.composite
  const { base: compositeBase } = options.composite ?? composite.props

  const { parent, menubar, parentIsMenubar } = model
  const hasParentMenu = !!parent
  const buttonId = initButtonId ?? menuButtonId(name)

  /** The composite the button is an item of, or `null` for a lone dropdown. */
  const parentComposite: CompositeModel | null = parentIsMenubar
    ? menubar
    : (parent?.composite ?? null)

  /** The menubar's item elements, for the `aria-expanded` reads. */
  const menubarElements = (): Array<HTMLElement | null> =>
    menubar ? menubar.items.renderedItems().map((item) => item.element()) : []

  // --- the button ------------------------------------------------------------

  /**
   * Ariakit's `showMenu`: the button is the disclosure _and_ the anchor, and
   * both handles are assigned before showing so the positioner and the focus
   * restore have something to work with.
   */
  const showFromButton = (target: unknown): void => {
    const element = target as HTMLElement | null | undefined
    if (element) {
      model.disclosureElement.set(element)
      model.anchorElement.set(element)
    }
    model.show()
  }

  const buttonRef = wrap((element: HTMLElement | null) => {
    model.disclosureElement.set(element)
    model.anchorElement.set(element)
  })

  const onButtonClick = wrap((event?: MenuMouseEvent) => {
    if (event?.defaultPrevented) return

    const element = event?.currentTarget as HTMLElement | null | undefined
    if (element) {
      model.disclosureElement.set(element)
      model.anchorElement.set(element)
    }

    const intent = mapMenuButtonClickIntent({
      detail: event?.detail,
      open: model(),
      hasParentMenu,
    })

    // The flags are written before the transition, not after it as Ariakit
    // does: a React effect runs after the render either way, while here the
    // focus layer reacts to the `open` change in the very same notification.
    if (intent.autoFocusOnShow !== undefined) {
      model.autoFocusOnShow.set(intent.autoFocusOnShow)
    }
    if (intent.initialFocus !== undefined) {
      model.initialFocusPolicy.set(intent.initialFocus)
    }

    if (intent.toggle) model.toggle()
    if (intent.show) model.show()
    notify()
  })

  const onButtonFocus = wrap((event?: MenuFocusEvent) => {
    if (event?.defaultPrevented) return

    model.disclosureFocused.set(true)
    // "Reset the autoFocusOnShow state so we can focus the menu button while
    // the menu is open and press arrow keys to move focus to the menu items."
    model.autoFocusOnShow.set(false)
    // "We need to unset the active menu item so no menu item appears active
    // while the menu button is focused."
    composite.set(null)

    // A menubar is a widget the keyboard walks: once one of its menus is open,
    // reaching another button swaps them.
    if (
      parentIsMenubar &&
      hasExpandedMenuItem(menubarElements(), event?.currentTarget as Element)
    ) {
      showFromButton(event?.currentTarget)
    }
    notify()
  })

  const onButtonBlur = wrap(() => {
    model.disclosureFocused.set(false)
    notify()
  })

  const onButtonKeyDown = wrap((event: MenuKeyboardEvent) => {
    // Ariakit reads `state.placement` here, not `currentPlacement`: the key has
    // to agree with the side the menu was _asked_ to open on, which is stable
    // while the menu is closed and has no resolved placement yet.
    const focus = mapMenuButtonKeyIntent(
      event,
      getPopoverSide(model.placement()),
    )
    if (!focus) return

    event.preventDefault?.()

    if (model()) {
      // An open menu does not reopen: the key moves inside it, which is what
      // makes ArrowDown on the button of an open menu walk the items.
      composite.navigate({ move: focus })
      notify()
      return
    }

    model.autoFocusOnShow.set(true)
    model.initialFocusPolicy.set(focus)
    showFromButton(event.currentTarget)
    notify()
  })

  /** Ariakit's `showOnHover` callback of `MenuButton`. */
  const canShowOnHover = (): boolean => {
    if (showOnHover !== undefined) return showOnHover
    // The atom is the reactive half, and it is already `true` for a submenu;
    // the expanded-sibling half needs the DOM, so it is read per event.
    if (model.showOnHover()) return true
    return resolveMenuShowOnHover({
      hasParentMenu,
      parentIsMenubar,
      // No exclusion, as in Ariakit: a hover over the button of the menu that
      // is already open changes nothing anyway.
      menubarExpanded: hasExpandedMenuItem(menubarElements()),
    })
  }

  const onButtonMouseMove = wrap((event?: MenuMouseEvent) => {
    // Feed the shared flag from the event itself, so the record works without
    // the document listeners of `withHovercardDom`.
    model.moving.move(event)

    const intent = mapHovercardShowIntent({
      defaultPrevented: !!event?.defaultPrevented,
      showPending: model.showPending(),
      moving: model.moving(),
      showOnHover: canShowOnHover(),
    })
    if (intent === 'ignore') {
      notify()
      return
    }

    const element = event?.currentTarget as HTMLElement | null | undefined
    if (element) {
      model.anchorElement.set(element)
      model.disclosureElement.set(element)
    }

    // "When hovering over a menu button shows a menu and the menu button is
    // part of another menu or menubar, it's not guaranteed that the button will
    // get focused. That's why we make sure the active item is updated on the
    // parent menu store."
    const itemId = element?.id
    if (parentComposite && itemId) parentComposite.set(itemId)

    scheduleHovercardDelay(model.showDelayed)
    notify()
  })

  const onButtonMouseLeave = wrap(() => {
    model.showDelayed.abort('mouseleave')
    notify()
  })

  const buttonProps = (id: string): MenuButtonProps => ({
    id,
    role: hasParentMenu || parentIsMenubar ? 'menuitem' : undefined,
    'aria-haspopup': 'menu',
    'aria-expanded': model(),
    'aria-controls': model.contentId(),
    type: 'button',
    ref: buttonRef,
    onClick: onButtonClick,
    onFocus: onButtonFocus,
    onBlur: onButtonBlur,
    onKeyDown: onButtonKeyDown,
    onMouseMove: onButtonMouseMove,
    onMouseLeave: onButtonMouseLeave,
  })

  // --- the menu element ------------------------------------------------------

  const listRef = wrap((element: HTMLElement | null) => {
    model.contentElement.set(element)
    composite.baseElement.set(element)
  })

  /**
   * The id the menu is labelled by: the button, unless the menu has a label or
   * a heading of its own — those come from the dialog record and take
   * precedence (`menu.tsx` spreads them last).
   */
  const labelledBy = (): string | undefined => {
    const label = model.label()
    const heading = model.headingId()
    if (label != null) return undefined
    return heading ?? renderedButtonId
  }

  /**
   * The id the button record last rendered. A submenu button is a composite
   * item, so its id belongs to the item rather than to the menu — and the menu
   * is labelled by whichever button was actually rendered.
   */
  let renderedButtonId = buttonId

  const onListKeyDown = wrap((event: MenuKeyboardEvent) => {
    const intent = mapMenuListKeyIntent(event, {
      side: getPopoverSide(model.placement()),
      orientation: composite.orientation(),
      hasParentMenu,
      menubarOrientation: menubar ? menubar.orientation() : undefined,
    })
    if (!intent) return

    if (intent.type === 'hide') {
      // Ariakit stops the propagation as well: the same arrow key would
      // otherwise reach the parent menu and move inside it.
      event.stopPropagation?.()
      event.preventDefault?.()
      // `hide`, not `hideAll`: closing a submenu hands focus back to its button
      // and leaves the parent open.
      model.hide()
      notify()
      return
    }

    if (!menubar) return
    const id = intent.move === 'next' ? menubar.next() : menubar.previous()
    if (id === undefined) return

    event.stopPropagation?.()
    event.preventDefault?.()
    // The move focuses the next button, which opens its menu — see
    // `onButtonFocus`.
    menubar.move(id)
    notify()
  })

  /** Both halves of a `keydown` on the menu element, in Ariakit's order. */
  const onMenuKeyDown = wrap((event: MenuKeyboardEvent) => {
    onListKeyDown(event)
    // The composite navigates only what the menu did not consume; its own
    // handler bails on a prevented event.
    compositeBase().onKeyDown(event as unknown as KeyboardEvent)
  })

  /**
   * The same, plus the dialog's own Escape — a menu popover _is_ a dialog, and
   * Ariakit's `Menu` renders `MenuList` on top of `Hovercard`, so both handlers
   * end up on the element. `props.list` keeps only the menu half, because a
   * `MenuList` on its own is not a dialog.
   */
  const onPopoverKeyDown = wrap((event: MenuKeyboardEvent) => {
    onMenuKeyDown(event)
    hovercard.content().onKeyDown(event)
  })

  const onPopoverFocus = wrap((event?: MenuFocusEvent) => {
    if (event?.defaultPrevented) return
    // The latch the focus restore reads, see `MenuUnits.contentFocused`. A view
    // binds this handler to `focusin`, as React does, so a focused _item_ arms
    // it too — which is the case that matters, since that is where a keyboard
    // opened menu puts focus.
    model.contentFocused.set(true)
    hovercard.content().onFocus(event)
    compositeBase().onFocus(event as unknown as FocusEvent)
  })

  // --- the items -------------------------------------------------------------

  /** Whether the pointer left the item for one of its siblings, or for itself. */
  const leavingForItems = (
    target: CompositeModel,
    event?: MenuMouseEvent,
  ): boolean => {
    const related = event?.relatedTarget as Node | null | undefined
    if (!related) return false
    if (contains(event?.currentTarget as Element | null, related)) return true
    return target.items
      .renderedItems()
      .some((node) => contains(node.element(), related))
  }

  /**
   * The hover half of a menu item, shared by all four item records.
   *
   * The composite is a parameter because a submenu button is an item of the
   * menu, or menubar, it hangs off — not of the menu it opens.
   */
  const itemHoverHandlers = (
    target: CompositeModel | null,
    item: CompositeItemNode,
    focusOnHover: boolean,
    blurOnHoverEnd: boolean,
  ) => ({
    onMouseMove: wrap((event?: MenuMouseEvent) => {
      if (event?.defaultPrevented) return
      model.moving.move(event)
      if (!target || !focusOnHover) return
      if (!model.moving()) return
      // A `move` and not a plain write: focus follows the pointer in a menu,
      // which is also what keeps the arrow keys working afterwards.
      target.move(item.id)
      notify()
    }),

    onMouseLeave: wrap((event?: MenuMouseEvent) => {
      if (event?.defaultPrevented) return
      model.moving.move(event)
      if (!target || !focusOnHover || !blurOnHoverEnd) return
      if (!model.moving()) return
      if (leavingForItems(target, event)) return
      // Ariakit's `setActiveId(null)` plus `baseElement.focus()`: a move to
      // `null` is both, because the composite element _is_ the active one then.
      target.move(null)
      notify()
    }),
  })

  /** The click half of a menu item: the command, and the tree it closes. */
  const itemClickHandler = (hideOnClick: boolean) =>
    wrap((event?: MenuMouseEvent) => {
      if (event?.defaultPrevented) return

      const element = event?.currentTarget
      const hide = shouldHideMenuOnItemClick({
        hideOnClick,
        hasPopup: hasPopupAttribute(element),
        navigating: event
          ? isMenuItemNavigating(event, describeItemElement(element))
          : false,
      })
      if (hide) model.hideAll()
      notify()
    })

  const itemRecord = (
    item: CompositeItemNode,
    itemOptions: MenuItemPropsOptions = {},
  ): Computed<MenuItemProps> => {
    const {
      hideOnClick = initHideOnClick,
      focusOnHover = initFocusOnHover,
      blurOnHoverEnd = initBlurOnHoverEnd,
      name: recordName = `${item.name}.props.menuitem`,
      ...compositeOptions
    } = itemOptions

    const base = compositeItemProps(composite, item, {
      ...compositeOptions,
      name: `${recordName}.composite`,
    })
    const onClick = itemClickHandler(hideOnClick)
    const hover = itemHoverHandlers(
      composite,
      item,
      focusOnHover,
      blurOnHoverEnd,
    )

    return computed(
      (): MenuItemProps => ({
        ...base(),
        role: 'menuitem',
        onClick,
        ...hover,
      }),
      recordName,
    )
  }

  const itemButtonRecord = (
    item: CompositeItemNode,
    itemOptions: MenuItemPropsOptions = {},
  ): Computed<MenuItemButtonProps> => {
    const {
      focusOnHover = initFocusOnHover,
      blurOnHoverEnd = initBlurOnHoverEnd,
      name: recordName = `${item.name}.props.menuitem`,
      ...compositeOptions
    } = itemOptions

    // The button's id is the item's, so the parent's `aria-activedescendant`
    // and this menu's `aria-labelledby` point at the same element.
    renderedButtonId = item.id

    const parentItem = parentComposite
      ? compositeItemProps(parentComposite, item, {
          ...compositeOptions,
          name: `${recordName}.composite`,
        })
      : null
    // The parent's composite, because that is the one the button is an item of.
    const hover = itemHoverHandlers(
      parentComposite,
      item,
      focusOnHover,
      blurOnHoverEnd,
    )

    const ref = wrap((element: HTMLElement | null) => {
      parentItem?.().ref(element)
      buttonRef(element)
    })

    const onKeyDown = wrap((event: MenuKeyboardEvent) => {
      // The parent navigates first, exactly as Ariakit's stacking order does:
      // an arrow key that walks the parent menu never reaches the button.
      parentItem?.().onKeyDown(event as unknown as KeyboardEvent)
      onButtonKeyDown(event)
    })

    const onFocus = wrap((event?: MenuFocusEvent) => {
      parentItem?.().onFocus(event as unknown as FocusEvent)
      onButtonFocus(event)
    })

    const onMouseMove = wrap((event?: MenuMouseEvent) => {
      hover.onMouseMove(event)
      onButtonMouseMove(event)
    })

    const onMouseLeave = wrap((event?: MenuMouseEvent) => {
      hover.onMouseLeave(event)
      onButtonMouseLeave()
    })

    return computed((): MenuItemButtonProps => {
      const item = parentItem?.()

      return {
        'data-active-item': item?.['data-active-item'],
        tabIndex: item?.tabIndex,
        ...buttonProps(renderedButtonId),
        ref,
        onKeyDown,
        onFocus,
        onMouseMove,
        onMouseLeave,
      }
    }, recordName)
  }

  const checkedItemRecord = <
    Props extends MenuItemCheckboxProps | MenuItemRadioProps,
  >(
    item: CompositeItemNode,
    itemOptions: MenuItemCheckboxPropsOptions | MenuItemRadioPropsOptions,
    role: Props['role'],
  ): Computed<Props> => {
    const {
      field,
      value,
      // "Determines if the menu should hide when this item is clicked.
      // @default false" — a menu of checkboxes stays open while they are
      // ticked (`menu-item-checkbox.tsx`, `menu-item-radio.tsx`).
      hideOnClick = false,
      focusOnHover = initFocusOnHover,
      blurOnHoverEnd = initBlurOnHoverEnd,
      name: recordName = `${item.name}.props.${role}`,
      ...compositeOptions
    } = itemOptions

    const radio = role === 'menuitemradio'
    const base = compositeItemProps(composite, item, {
      ...compositeOptions,
      name: `${recordName}.composite`,
    })
    const hover = itemHoverHandlers(
      composite,
      item,
      focusOnHover,
      blurOnHoverEnd,
    )
    const hide = itemClickHandler(hideOnClick)

    const checked = (): boolean =>
      radio
        ? model.isRadioChecked(field, value!)
        : model.isItemChecked(field, value)

    const onClick = wrap((event?: MenuMouseEvent) => {
      if (event?.defaultPrevented) return

      // The element reports the state it is _moving to_, which is what the
      // checkbox and radio transitions of `menuValues.ts` take.
      const next = !checked()
      model.setValue(field, (state) =>
        radio
          ? nextMenuRadioValue(state, value!, next)
          : nextMenuCheckboxValue(state, value, next),
      )
      hide(event)
      notify()
    })

    return computed(
      () =>
        ({
          ...base(),
          role,
          'aria-checked': checked(),
          name: field,
          value,
          onClick,
          ...hover,
        }) as Props,
      recordName,
    )
  }

  // --- caches ----------------------------------------------------------------

  const items = new WeakMap<CompositeItemNode, Computed<MenuItemProps>>()
  const itemButtons = new WeakMap<
    CompositeItemNode,
    Computed<MenuItemButtonProps>
  >()
  const checkedItems = new WeakMap<
    CompositeItemNode,
    Map<string, Computed<MenuItemCheckboxProps | MenuItemRadioProps>>
  >()

  /** The cache key of a checkbox or radio item: its field and its own value. */
  const checkedKey = (
    role: string,
    itemOptions: MenuItemCheckboxPropsOptions | MenuItemRadioPropsOptions,
  ): string | null => {
    const { field, value, ...rest } = itemOptions
    // A record with its own policy is not cached, like `item`'s.
    if (Object.keys(rest).length) return null
    return `${role}\u0000${field}\u0000${String(value)}`
  }

  const cachedCheckedItem = <
    Props extends MenuItemCheckboxProps | MenuItemRadioProps,
  >(
    item: CompositeItemNode,
    itemOptions: MenuItemCheckboxPropsOptions | MenuItemRadioPropsOptions,
    role: Props['role'],
  ): Computed<Props> => {
    const key = checkedKey(role, itemOptions)
    if (key === null) return checkedItemRecord<Props>(item, itemOptions, role)

    let records = checkedItems.get(item)
    if (!records) checkedItems.set(item, (records = new Map()))

    let record = records.get(key)
    if (!record) {
      records.set(
        key,
        (record = checkedItemRecord<Props>(item, itemOptions, role)),
      )
    }
    return record as Computed<Props>
  }

  return {
    wrapper: hovercard.wrapper,
    arrow: hovercard.arrow,
    backdrop: hovercard.backdrop,
    dismiss: hovercard.dismiss,
    heading: hovercard.heading,
    description: hovercard.description,
    focusTrap: hovercard.focusTrap,

    button: computed(
      (): MenuButtonProps => buttonProps(buttonId),
      `${name}.props.button`,
    ),

    itemButton: (item, itemOptions) => {
      if (itemOptions) return itemButtonRecord(item, itemOptions)

      let record = itemButtons.get(item)
      if (!record) itemButtons.set(item, (record = itemButtonRecord(item)))
      return record
    },

    list: computed((): MenuListProps => {
      // Only the visibility half of the content record is taken: a plain list is
      // not a dialog, so it carries neither `role="dialog"` nor `tabIndex={-1}`,
      // and it keeps the composite's own id and tab stop.
      const { hidden, style } = hovercard.content()

      return {
        ...compositeBase(),
        role: 'menu',
        'aria-orientation': menuAriaOrientation(composite.orientation()),
        'aria-labelledby': labelledBy(),
        hidden,
        style: style.display ? { display: 'none' } : undefined,
        ref: listRef,
        onKeyDown: onMenuKeyDown,
      }
    }, `${name}.props.list`),

    popover: computed((): MenuPopoverProps => {
      const base = compositeBase()

      return {
        ...hovercard.content(),
        role: 'menu',
        'aria-orientation': menuAriaOrientation(composite.orientation()),
        'aria-labelledby':
          hovercard.content()['aria-labelledby'] ?? labelledBy(),
        'aria-activedescendant': base['aria-activedescendant'],
        ref: listRef,
        onKeyDown: onPopoverKeyDown,
        onFocus: onPopoverFocus,
      }
    }, `${name}.props.popover`),

    item: (item, itemOptions) => {
      if (itemOptions) return itemRecord(item, itemOptions)

      let record = items.get(item)
      if (!record) items.set(item, (record = itemRecord(item)))
      return record
    },

    itemCheckbox: (item, itemOptions) =>
      cachedCheckedItem<MenuItemCheckboxProps>(
        item,
        itemOptions,
        'menuitemcheckbox',
      ),

    itemRadio: (item, itemOptions) =>
      cachedCheckedItem<MenuItemRadioProps>(item, itemOptions, 'menuitemradio'),

    separator: computed(
      (): MenuSeparatorProps => ({
        role: 'separator',
        'aria-orientation': menuSeparatorOrientation(composite.orientation()),
      }),
      `${name}.props.separator`,
    ),
  }
}

/**
 * Attaches {@link menuProps} to a menu model as `model.props`.
 *
 * {@link reatomMenu} applies it already; use it explicitly for a model built
 * from an adopted atom with {@link withMenu}.
 *
 * @example
 *   const open = atom(false, 'app.edit.open')
 *   const edit = open.extend(
 *     withMenu(),
 *     withMenuProps({ hideOnClick: false }),
 *   )
 */
export const withMenuProps = (
  options: MenuPropsOptions = {},
): AssignerExt<{ props: MenuPropRecords }, MenuModel> => {
  return (target) => ({ props: menuProps(target, options) })
}
