/**
 * Layer 1 for `menu`: the model — a hovercard whose content is a composite,
 * which is the whole idea of a dropdown menu.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/menu/menu-store.ts`, plus the policy Ariakit
 * keeps in `packages/ariakit-react-components/src/menu/*.tsx`.
 */

import type { Action, AssignerExt, Atom } from '@reatom/core'
import {
  action,
  atom,
  ifChanged,
  named,
  peek,
  ReatomError,
  withComputed,
  withMiddleware,
} from '@reatom/core'

import type {
  Composite,
  CompositeItemNode,
  CompositeOptions,
} from '../composite/reatomComposite'
import {
  compositeElementId,
  reatomComposite,
} from '../composite/reatomComposite'
import type { DialogDismissIntent } from '../dialog/dialogIntent'
import type {
  HovercardExtOptions,
  HovercardUnits,
} from '../hovercard/reatomHovercard'
import { withHovercard } from '../hovercard/reatomHovercard'
import type { MenubarModel } from '../menubar/reatomMenubar'
import type { MenuInitialFocus } from './menuIntent'
import {
  menuSubmenuPlacement,
  resolveMenuHideOnHoverOutside,
} from './menuIntent'
import type {
  MenuItemValue,
  MenuValue,
  MenuValues,
  MenuValueUpdate,
} from './menuValues'
import {
  isMenuItemChecked,
  isMenuRadioChecked,
  nextMenuValues,
} from './menuValues'
import type { MenuPropRecords, MenuPropsOptions } from './props'
import { withMenuProps } from './props'

/**
 * The delay before a hovered menu button opens its menu, in milliseconds.
 *
 * Ariakit's `createMenuStore` default. It is much shorter than the hovercard's
 * own 500ms, because a menu is a control the pointer aims at rather than an
 * aside it happens to rest on — and it is `0` for a menu in a menubar, where
 * the bar is already open and the menus swap.
 */
export const MENU_TIMEOUT = 150

/** Options accepted by both {@link reatomMenu} and {@link withMenu}. */
export interface MenuExtOptions
  extends Omit<HovercardExtOptions, 'parent'>, Omit<CompositeOptions, 'name'> {
  /**
   * The menu this one is a submenu of.
   *
   * @remarks
   *   One reference is the whole submenu tree: it makes this menu a nested dialog
   *   (so Escape closes the innermost one and the pointer may cross it without
   *   the parent closing), derives the placement from the parent's orientation,
   *   shares the parent's {@link MenuUnits.values}, and turns on the hover
   *   behavior a submenu needs.
   */
  parent?: MenuModel
  /**
   * The menubar this menu belongs to. A menu has either a `parent` or a
   * `menubar`; passing both makes the `parent` win, as in Ariakit
   * (`parentIsMenubar = !!menubar && !parent`).
   */
  menubar?: MenubarModel
  /**
   * Which arrow keys navigate the menu items. A menu is a column, so the
   * composite default (`'both'`) is overridden here.
   *
   * @default 'vertical'
   */
  orientation?: CompositeOptions['orientation']
  /**
   * The DOM `id` of the menu element — the element that holds the items, which
   * is also the popover content element and therefore what the button's
   * `aria-controls` points at.
   *
   * Defaults to a DOM-safe derivation of the model name. `contentId` is an
   * alias of it: a menu has one popup element, not two.
   */
  id?: string
  /**
   * Where focus lands when the menu opens.
   *
   * @remarks
   *   Renamed from Ariakit's `initialFocus` state, because the dialog layer
   *   already owns an `initialFocus` atom that holds the _element_ to focus.
   *   The policy resolves into that atom, see
   *   {@link MenuUnits.initialFocusPolicy}.
   * @default 'container'
   */
  initialFocusPolicy?: MenuInitialFocus
  /**
   * The initial `values` record read by checkbox and radio menu items —
   * Ariakit's `defaultValues`.
   *
   * @default {}
   */
  values?: MenuValues
  /**
   * Adopt a caller-owned atom for the `values` record: a form field, a route
   * search param, or another menu's values. This is what "controlled" means in
   * Reatom.
   *
   * A submenu shares its parent's atom by default, which is Ariakit's
   * `pick(parent, ['values'])`.
   */
  valuesAtom?: Atom<MenuValues>
}

/** Options of the {@link reatomMenu} factory. */
export interface MenuOptions extends MenuExtOptions, MenuPropsOptions {
  /**
   * Initial `open` state. To adopt a caller-owned atom instead — a route search
   * param, a form field — extend it with {@link withMenu}.
   *
   * @default false
   */
  open?: boolean
}

/**
 * Units attached by {@link withMenu}, on top of the hovercard ones.
 *
 * `parent` is narrowed from the dialog's `DialogModel | null`: a menu's parent
 * is a menu, which is what makes {@link MenuUnits.hideAll} recursive.
 */
export interface MenuUnits extends Omit<HovercardUnits, 'parent'> {
  /**
   * The composite sub-model of the items: its own state is the active item id,
   * and it carries the item collection, the navigation flags, and the
   * navigation queries.
   *
   * @remarks
   *   A sub-model instead of the flat state Ariakit merges, for the same reason
   *   `reatomCombobox` splits them: a menu has two "active" notions — which
   *   item the arrow keys are on, and whether the menu itself is open — and one
   *   flat surface is what makes them easy to confuse. `menu()` is the open
   *   state; `menu.composite()` is the active item.
   *
   *   The menu element is the composite's `baseElement`, so the container and the
   *   popup are the same element (`id`).
   * @example
   *   menu.composite.items.renderItem({ id: 'undo' })
   *   menu.composite.navigate({ move: 'first' })
   *   menu.composite() // 'undo'
   */
  composite: Composite
  /** The menu this one is a submenu of, or `null` for a root menu. */
  parent: MenuModel | null
  /** The menubar this menu belongs to, or `null`. */
  menubar: MenubarModel | null
  /**
   * Whether the menu hangs off a menubar rather than off another menu —
   * Ariakit's `parentIsMenubar`. It decides the hover policy of the button, the
   * arrow keys of the menu element, and the show delay.
   */
  parentIsMenubar: boolean
  /**
   * Where focus lands when the menu opens: the menu element itself
   * (`'container'`), its first, or its last enabled item.
   *
   * @remarks
   *   The policy, not the element. It resolves into the dialog's `initialFocus`
   *   atom — a derivation of this atom, the rendered items, and the menu
   *   element — which is what `withDialogFocus` reads. Ariakit resolves the
   *   same three inputs in an effect that writes an `initialFocusRef`
   *   (`menu.tsx`).
   *
   *   `props.button` writes it: an arrow-key or keyboard press opens the menu at
   *   `'first'` or `'last'`, a pointer click at `'container'`.
   */
  initialFocusPolicy: Atom<MenuInitialFocus>
  /**
   * The record checkbox and radio menu items read and write. A submenu shares
   * its parent's, so one dropdown tree has one form state.
   *
   * Write it directly for a bulk change (Ariakit's `setValues`); use
   * {@link MenuUnits.setValue} for one field, because it also guards the name
   * and keeps the record identity.
   */
  values: Atom<MenuValues>
  /**
   * Whether focus is inside the menu button.
   *
   * @remarks
   *   Ariakit asks the DOM (`hasFocusWithin(disclosureElement)`) at the moment it
   *   has to decide whether hovering away closes a menubar menu. A menu that is
   *   being keyboard-driven must not close because the pointer happens to be
   *   elsewhere, so the answer has to be known — but a pure model cannot read
   *   focus, so the flag is state here, written by `props.button`'s `onFocus` /
   *   `onBlur` and read by {@link MenuUnits.hideOnHoverOutside}.
   */
  disclosureFocused: Atom<boolean>
  /**
   * Whether focus reached this menu while it was on screen, which is what makes
   * closing it hand focus back to the button — the APG behavior of a menu
   * button.
   *
   * @remarks
   *   Ariakit's `useAutoFocusOnHide` keeps the same flag and clears it in an
   *   effect that runs _after_ the commit the card unmounted in, so the
   *   dialog's own focus-restore effect of that commit still sees it.
   *   {@link withHovercard} expresses the reset as a synchronous gate on
   *   `mounted`, which is one frame too early for a menu: `withDialogFocus`
   *   reads `autoFocusOnHide` in the effect phase of the notification that
   *   unmounted the menu and would find it already cleared, leaving focus on
   *   the body. So the fact is latched here instead — written by
   *   `props.popover`'s `onFocus`, cleared when the menu is shown again — and
   *   {@link HovercardUnits.autoFocusOnHide} is derived from it.
   */
  contentFocused: Atom<boolean>
  /**
   * Writes one field of {@link MenuUnits.values} — Ariakit's `setValue`.
   *
   * Prefer it over writing the record: it refuses the prototype-polluting names
   * and keeps the record identity when the field does not change.
   *
   * @example
   *   menu.setValue('watching', ['issues'])
   *   menu.setValue('watching', (value) => [...value, 'releases'])
   */
  setValue: Action<[name: string, value: MenuValueUpdate], MenuValues>
  /** Whether a checkbox menu item is checked — see `isMenuItemChecked`. */
  isItemChecked: (name: string, itemValue?: MenuItemValue) => boolean
  /** Whether a radio menu item is checked — see `isMenuRadioChecked`. */
  isRadioChecked: (name: string, itemValue: MenuItemValue) => boolean
  /**
   * Closes this menu and every menu it hangs off.
   *
   * @remarks
   *   The transition a menu item makes: picking a command in a submenu three
   *   levels deep dismisses the whole tree, not just the level it was in.
   *   Escape does the same — see {@link withMenu}.
   * @example
   *   submenu.hideAll()
   *   menu() // false
   */
  hideAll: Action<[], void>
}

/** A boolean atom extended with the menu behavior. */
export interface MenuModel extends Atom<boolean>, MenuUnits {}

/** The model returned by {@link reatomMenu}: {@link MenuModel} plus prop records. */
export interface Menu extends MenuModel {
  /** Reactive prop records for the menu's elements. */
  props: MenuPropRecords
}

/**
 * Adds the menu behavior to an existing boolean atom.
 *
 * @remarks
 *   The extension applies {@link withHovercard} itself — Ariakit's
 *   `createMenuStore` merges a hovercard store into its own state — and creates
 *   the composite sub-model of the items. Do not extend the same atom with
 *   `withHovercard`, `withPopover`, `withDialog`, or `withDisclosure` first;
 *   `extend` refuses to overwrite existing members.
 *
 *   Six Ariakit mechanics change shape here:
 *
 *   - `mergeStore(props.store, pick(parent, ['values']))` becomes a _shared atom_:
 *       a submenu's `values` **is** its parent's atom, so neither side has to
 *       mirror the other.
 *   - The `sync(menu, ['mounted'])` listener that clears the active item becomes a
 *       `withComputed` derivation, so it is correct before anything
 *       subscribes.
 *   - The `sync(parent, ['orientation'])` listener that writes `placement` becomes
 *       a writable derivation of the parent's orientation — and only when no
 *       `placement` was passed, because a caller who asked for one should not
 *       have it overwritten a tick later.
 *   - `initialFocus`, a policy string in Ariakit, is
 *       {@link MenuUnits.initialFocusPolicy}; the dialog's `initialFocus`
 *       element atom derives from it, replacing the `initialFocusRef` effect of
 *       `menu.tsx`.
 *   - `hideOnHoverOutside`, a per-render callback in Ariakit, becomes a writable
 *       derivation of the menu's context — see
 *       {@link MenuUnits.disclosureFocused}.
 *   - Escape closes the whole tree, which Ariakit does by passing a `hideOnEscape`
 *       callback that calls `store.hideAll()`. Here it is a middleware on
 *       `dismiss`, so it also covers the document-level Escape of
 *       `withDialogDismiss`.
 *
 *   Nothing here listens to anything: add `withHovercardDom()` for the pointer
 *   tracking and `withDialogDom()` for focus, Escape, and outside clicks.
 * @example
 *   // a route search param that drives a menu
 *   const open = atom(false, 'app.menu.open')
 *   const menu = open.extend(withMenu(), withMenuProps())
 *
 * @see {@link reatomMenu} for the batteries-included factory.
 */
export const withMenu = (
  options: MenuExtOptions = {},
): AssignerExt<MenuUnits, Atom<boolean>> => {
  const {
    parent = null,
    menubar = null,
    initialFocusPolicy: initInitialFocusPolicy = 'container',
    values: initValues,
    valuesAtom,

    // The composite half of the options.
    activeId,
    items,
    orientation = 'vertical',
    rtl,
    virtualFocus,
    focusLoop,
    focusWrap,
    focusShift,
    includesBaseElement,
    id,

    // The hovercard half, of which four defaults differ from a plain card's.
    placement,
    timeout,
    hideTimeout,
    showOnHover,
    hideOnHoverOutside,
    disablePointerEventsOnApproach,
    modal,
    backdrop,
    contentId,
    ...hovercardOptions
  } = options

  if (valuesAtom && initValues !== undefined) {
    throw new ReatomError(`menu: pass either "values" or "valuesAtom"`)
  }

  return (target) => {
    const { name } = target
    // Ariakit: a menu that has a parent menu is a submenu even when a menubar is
    // also given, and only a menubar-parented menu gets the menubar defaults.
    const parentIsMenubar = !!menubar && !parent
    // One element, one id: the menu element holds the items (the composite base
    // element) and is the popup the button controls (the dialog content
    // element).
    const elementId = id ?? contentId ?? compositeElementId(name)

    const composite = reatomComposite({
      activeId,
      items,
      orientation,
      rtl,
      virtualFocus,
      focusLoop,
      focusWrap,
      focusShift,
      includesBaseElement,
      id: elementId,
      name: `${name}.composite`,
    })

    const parentOrientation = parent?.composite.orientation ?? null
    const hovercard = withHovercard({
      ...hovercardOptions,
      contentId: elementId,
      // `parent` is a `MenuModel`, which is structurally a `DialogModel`: the
      // nested-dialog stack, `topmost`, and the safe-polygon list of nested
      // cards all follow from this one reference.
      parent: parent ?? undefined,
      placement:
        placement ??
        (parentOrientation
          ? menuSubmenuPlacement(peek(parentOrientation))
          : 'bottom-start'),
      // A menubar is already open, so its menus swap without a delay.
      timeout: timeout ?? (parentIsMenubar ? 0 : MENU_TIMEOUT),
      // Ariakit's menu store default, which differs from the hovercard's: a menu
      // closes as soon as it is asked to, and the pointer intent (the safe
      // polygon) is what keeps it open while the pointer travels.
      hideTimeout: hideTimeout ?? 0,
      // A submenu opens on hover; a lone dropdown is a click-driven widget.
      showOnHover: showOnHover ?? !!parent,
      hideOnHoverOutside,
      // Ariakit's `disablePointerEventsOnApproach = !!hideOnHoverOutside`, where
      // a menu's `hideOnHoverOutside` is always a _callback_ — so a menu
      // suppresses the outside pointer events unless the policy is turned off
      // outright. Passing it also keeps `withHovercard` from reading
      // `hideOnHoverOutside` for its own default, which is what lets the
      // derivation below take effect at all.
      disablePointerEventsOnApproach:
        disablePointerEventsOnApproach ?? hideOnHoverOutside ?? true,
      // "If it's a submenu, it shouldn't behave like a modal dialog" — and a
      // submenu renders no backdrop of its own either (`menu.tsx`).
      modal: parent ? false : modal,
      backdrop: parent ? false : backdrop,
    })(target)

    // Ariakit's `sync(menu, ['mounted'])`: a menu that left the screen has no
    // active item, so reopening it starts at the container again instead of
    // highlighting whatever was hovered last time.
    composite.extend(
      withComputed((state) => {
        let next = state
        ifChanged(hovercard.mounted, (isMounted, _prev, isFirst) => {
          if (!isFirst && !isMounted) next = null
        })
        return next
      }),
    )
    // Anchor the first frame: an atom pulled for the first time has no previous
    // `mounted` to diff against.
    peek(composite)

    // Ariakit's `sync(parent, ['orientation'])`, as a writable derivation: the
    // submenu follows the axis of the menu it hangs off, and a `placement`
    // written afterwards (by a positioner, or by a consumer) stays until that
    // axis changes.
    if (parentOrientation && placement === undefined) {
      hovercard.placement.extend(
        withComputed((state) => {
          let requested = state
          ifChanged(parentOrientation, (value) => {
            requested = menuSubmenuPlacement(value)
          })
          return requested
        }),
      )
      // `withPopover` has already read `placement` — its `currentPlacement`
      // derivation diffs it — and a middleware added to an atom that already
      // holds a computed frame cannot invalidate that frame. Only a write can,
      // and the derivation resolves the placement on its own first frame (where
      // `ifChanged` always fires), so the value written here is thrown away
      // again. It only has to differ from the cached one, which the bare
      // `'bottom'` — never a submenu placement — always does.
      hovercard.placement.set('bottom')
    }

    const initialFocusPolicy = atom(
      initInitialFocusPolicy,
      `${name}.initialFocusPolicy`,
    )

    /** The first, or last, enabled rendered item that has an element. */
    const edgeItemElement = (last: boolean): HTMLElement | null => {
      const rendered = composite.items.renderedItems()
      const order = last ? [...rendered].reverse() : rendered
      for (const item of order) {
        if (item.disabled()) continue
        const element = item.element()
        if (element) return element
      }
      return null
    }

    // Ariakit resolves the same three inputs in an effect and stores the result
    // in an `initialFocusRef` it hands to the dialog (`menu.tsx`). Here the
    // dialog's own `initialFocus` atom is that ref, and the effect is its
    // derivation — so `withDialogFocus` needs to know nothing about menus.
    hovercard.initialFocus.extend(
      withComputed(() => {
        const policy = initialFocusPolicy()
        // Read unconditionally, so neither dependency is dropped by a policy
        // that does not currently look at the items.
        const first = edgeItemElement(false)
        const last = edgeItemElement(true)
        const container = composite.baseElement()

        if (policy === 'first') return first
        if (policy === 'last') return last
        return container
      }),
    )

    const disclosureFocused = atom(false, `${name}.disclosureFocused`)

    // The `useAutoFocusOnHide` latch, see `MenuUnits.contentFocused`: armed by
    // the prop record, and disarmed by the next open rather than by the close it
    // has to outlive.
    const contentFocused = atom(false, `${name}.contentFocused`).extend(
      withComputed((state) => {
        let armed = state
        ifChanged(hovercard.mounted, (isMounted, _prev, isFirst) => {
          if (!isFirst && isMounted) armed = false
        })
        return armed
      }),
    )
    // Anchor the first frame: there is no previous `mounted` to diff against
    // until the atom has been computed once.
    peek(contentFocused)

    hovercard.autoFocusOnHide.extend(
      withComputed((state) => state || contentFocused()),
    )

    // Ariakit resolves `hideOnHoverOutside` per event, from the same four facts.
    // A derivation instead, because the hovercard's pointer layer reads the atom
    // rather than a callback. Passing the option is what pins it: the derivation
    // is only installed when none was given, since it ignores the written state.
    if (hideOnHoverOutside === undefined) {
      hovercard.hideOnHoverOutside.extend(
        withComputed(() =>
          resolveMenuHideOnHoverOutside({
            hasParentMenu: !!parent,
            parentIsMenubar,
            hasDisclosure: !!hovercard.disclosureElement(),
            disclosureFocused: disclosureFocused(),
          }),
        ),
      )
    }

    const values =
      valuesAtom ??
      // Ariakit's `pick(parent, ['values'])`: the submenu's field record _is_ the
      // parent's, so a checkbox item in a submenu writes the tree's state.
      parent?.values ??
      atom<MenuValues>(initValues ?? {}, `${name}.values`)

    const setValue = action(
      (valueName: string, update: MenuValueUpdate): MenuValues =>
        values.set((state) => nextMenuValues(state, valueName, update)),
      `${name}.setValue`,
    )

    const hideAll = action((): void => {
      hovercard.hide()
      parent?.hideAll()
    }, `${name}.hideAll`)

    // Ariakit passes a `hideOnEscape` callback that calls `store.hideAll()`
    // before returning `true` (`menu.tsx`). A middleware on `dismiss` covers
    // every route to that intent: the prop record's own handler, and the
    // document listener of `withDialogDismiss`.
    if (parent) {
      hovercard.dismiss.extend(
        withMiddleware(() => (next, ...params) => {
          const dismissed = next(...(params as [DialogDismissIntent?]))
          if ((params[0] ?? 'programmatic') === 'escape') parent.hideAll()
          return dismissed
        }),
      )
    }

    return {
      ...hovercard,
      composite,
      parent,
      menubar,
      parentIsMenubar,
      initialFocusPolicy,
      values,
      disclosureFocused,
      contentFocused,
      setValue,
      isItemChecked: (valueName: string, itemValue?: MenuItemValue) =>
        isMenuItemChecked(values(), valueName, itemValue),
      isRadioChecked: (valueName: string, itemValue: MenuItemValue) =>
        isMenuRadioChecked(values(), valueName, itemValue),
      hideAll,
    }
  }
}

/**
 * Creates a menu model: a hovercard whose content is a composite of menu items,
 * plus the `values` record its checkbox and radio items project.
 *
 * @remarks
 *   Ported from Ariakit's framework-agnostic `createMenuStore`, which is a
 *   composite store and a hovercard store merged into one flat surface with
 *   four keys of its own (`orientation`, `placement`, `initialFocus`,
 *   `values`). Here the two halves stay two models — `menu()` is the open
 *   state, `menu.composite()` is the active item — and the policy Ariakit keeps
 *   in `MenuButton`, `MenuList`, `MenuItem`, and `Menu` moves into the model
 *   and its prop records, so a whole dropdown tree is testable without a
 *   browser.
 *
 *   What is deliberately **not** ported: the `combobox` option. Ariakit merges a
 *   combobox store into the menu store, which makes the two share one `open`
 *   state, one item collection, and one active item; two Reatom models cannot
 *   share a primary atom after the fact, so a menu with a search input needs
 *   the combobox to own the popover and is a change on that side. Ariakit's
 *   `menu-bar` store — a deprecated alias of `createMenubarStore` — is not
 *   ported either; use {@link reatomMenubar} and pass it as `menubar`.
 * @example
 *   const menu = reatomMenu({ name: 'edit' })
 *
 *   const undo = menu.composite.items.renderItem({ id: 'undo' })
 *   menu.composite.items.renderItem({ id: 'redo' })
 *
 *   menu.props.button().onClick({ detail: 0 }) // a keyboard click
 *   menu() // true
 *   menu.initialFocusPolicy() // 'first'
 *   menu.props.item(undo)().onClick() // runs the command and closes the menu
 *
 * @example
 *   // a submenu: one reference wires the dialog stack, the placement, and the
 *   // shared `values`
 *   const edit = reatomMenu({ name: 'edit' })
 *   const find = reatomMenu({ parent: edit, name: 'edit.find' })
 *
 *   find.placement() // 'right-start' — derived from the parent's orientation
 *   find.hideAll() // closes both
 *
 * @example
 *   // checkbox and radio items project one `values` record
 *   const view = reatomMenu({
 *     values: { watching: ['issues'] },
 *     name: 'view',
 *   })
 *   const issues = view.composite.items.renderItem({ id: 'issues' })
 *
 *   view.props
 *     .itemCheckbox(issues, { name: 'watching', value: 'issues' })()
 *     .onClick()
 *   view.values() // { watching: [] }
 *
 * @example
 *   // @reatom/jsx
 *   ;<>
 *   <button $spread={menu.props.button}>Edit</button>
 *   <div $spread={menu.props.wrapper}>
 *   <div $spread={menu.props.popover}>
 *   <div $spread={menu.props.item(undo)}>Undo</div>
 *   </div>
 *   </div>
 *   </>
 *
 * @see https://ariakit.com/components/menu
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
 */
export const reatomMenu = (options: MenuOptions = {}): Menu => {
  const {
    open: initOpen = false,
    name = named('menu'),
    // The prop-record options, forwarded to the records the factory builds.
    alwaysVisible,
    hidden,
    fixed,
    arrowSize,
    buttonId,
    showOnHover,
    focusOnHover,
    blurOnHoverEnd,
    hideOnClick,
    composite,
    ...ext
  } = options

  return atom(initOpen, name).extend(
    // `showOnHover` reaches both layers: the model turns hover-open on, and the
    // records pin the contextual policy it cannot derive.
    withMenu({ showOnHover, ...ext }),
    withMenuProps({
      alwaysVisible,
      hidden,
      fixed,
      arrowSize,
      buttonId,
      showOnHover,
      focusOnHover,
      blurOnHoverEnd,
      hideOnClick,
      composite,
      name,
    }),
  ) as Menu
}

/**
 * A menu item node, re-exported for consumers that type their own item helpers:
 * `props.item`, `props.itemCheckbox`, and `props.itemRadio` all take one.
 */
export type MenuItemNode = CompositeItemNode

export type {
  MenuInitialFocus,
  MenuItemValue,
  MenuValue,
  MenuValues,
  MenuValueUpdate,
}
