/*
 * Layer 2 for `menubar`: the reactive prop records that turn a composite
 * element into a menubar and its items into menu items.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/menubar/menubar.tsx`, plus the
 * `getPopupItemRole(contentElement, 'menuitem')` fallback of
 * `packages/ariakit-react-components/src/menu/menu-item.tsx` — a menubar has no
 * popup element, so its items always take that fallback.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed } from '@reatom/core'

import type { CompositeOrientation } from '../composite/getNextId'
import type {
  CompositeBaseProps,
  CompositeItemProps,
  CompositeItemPropsOptions,
  CompositePropRecords,
} from '../composite/props'
import type { Composite, CompositeItemNode } from '../composite/reatomComposite'

/** Props to spread on the menubar element. */
export interface MenubarBaseProps extends CompositeBaseProps {
  /** The [`menubar`](https://w3c.github.io/aria/#menubar) role. */
  role: 'menubar'
  /**
   * The axis the menu items are laid out on, or `undefined` when the composite
   * navigates on both axes and no single orientation can be announced.
   */
  'aria-orientation': 'horizontal' | 'vertical' | undefined
}

/** Props to spread on a menubar item element. */
export interface MenubarItemProps extends CompositeItemProps {
  /** The [`menuitem`](https://w3c.github.io/aria/#menuitem) role. */
  role: 'menuitem'
}

/** Options of {@link menubarProps} and {@link withMenubarProps}. */
export interface MenubarPropsOptions {
  /**
   * The composite records the menubar ARIA is layered onto. Defaults to
   * `model.props`, which {@link reatomMenubar} fills in.
   *
   * @remarks
   *   Pass it explicitly only when the composite records live somewhere else than
   *   on the model — a wrapper widget that renames them, or a test that layers
   *   the menubar ARIA onto records it built itself.
   */
  composite?: CompositePropRecords
  /** Prefix of the prop record names. Defaults to the model name. */
  name?: string
}

/** Reactive prop records of a menubar model. */
export interface MenubarPropRecords extends CompositePropRecords {
  /** Props for the menubar element. */
  base: Computed<MenubarBaseProps>
  /**
   * Props for one menu item element. The record is memoized per item, so
   * repeated calls keep the same identity; passing options returns a fresh,
   * uncached record.
   */
  item: (
    item: CompositeItemNode,
    options?: CompositeItemPropsOptions,
  ) => Computed<MenubarItemProps>
}

/**
 * The `aria-orientation` a composite announces.
 *
 * `'both'` has no ARIA counterpart — a widget that navigates on both axes must
 * not claim an axis — so it maps to "no attribute", matching Ariakit's
 * `state.orientation === 'both' ? undefined : state.orientation`.
 *
 * @example
 *   menubarAriaOrientation('horizontal') // 'horizontal'
 *   menubarAriaOrientation('both') // undefined
 */
export const menubarAriaOrientation = (
  orientation: CompositeOrientation,
): 'horizontal' | 'vertical' | undefined =>
  orientation === 'both' ? undefined : orientation

/**
 * Builds the reactive prop records of a menubar model by layering the menubar
 * ARIA onto the composite ones.
 *
 * @remarks
 *   Everything interactive — the roving tabindex, `aria-activedescendant`, the
 *   element refs, and the arrow-key handlers — comes from the composite records
 *   unchanged, exactly like Ariakit's `useMenubar`, which adds the container
 *   role and orientation before delegating to `useComposite`. This layer also
 *   gives each item the `menuitem` role required by the [APG menubar
 *   pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/).
 *
 *   The composite records are destructured up front, so layering the result back
 *   onto the same `props` object (see {@link withMenubarProps}) can not make a
 *   record read itself.
 * @example
 *   const menubar = reatomMenubar({ name: 'menubar' })
 *   const file = menubar.items.renderItem({ id: 'file' })
 *
 *   menubar.props.base() // { role: 'menubar', 'aria-orientation': 'horizontal', ... }
 *   menubar.props.item(file)() // { role: 'menuitem', id: 'file', ... }
 */
export const menubarProps = (
  model: Composite,
  options: MenubarPropsOptions = {},
): MenubarPropRecords => {
  const { name = model.name } = options
  const { base: compositeBase, item: compositeItem } =
    options.composite ?? model.props

  const records = new WeakMap<
    Computed<CompositeItemProps>,
    Computed<MenubarItemProps>
  >()

  return {
    base: computed(
      (): MenubarBaseProps => ({
        ...compositeBase(),
        role: 'menubar',
        'aria-orientation': menubarAriaOrientation(model.orientation()),
      }),
      `${name}.props.menubar`,
    ),

    item: (item, itemOptions) => {
      // Keying by the composite record inherits its caching policy: a cached
      // composite record maps to one cached menubar record, and the fresh
      // record `itemOptions` produces maps to a fresh one.
      const base = compositeItem(item, itemOptions)

      let record = records.get(base)
      if (!record) {
        records.set(
          base,
          (record = computed(
            (): MenubarItemProps => ({ ...base(), role: 'menuitem' }),
            `${item.name}.props.menuitem`,
          )),
        )
      }
      return record
    },
  }
}

/**
 * Attaches {@link menubarProps} to a composite model as `model.props`.
 *
 * @remarks
 *   {@link reatomMenubar} applies it already; use it explicitly to turn a
 *   hand-built composite into a menubar.
 *
 *   The records are layered onto the composite's own `props` object in place,
 *   because `extend` refuses to replace an existing member and
 *   {@link reatomComposite} has already installed the composite records there.
 *   Reading `model.props.base` afterwards gives the menubar record; the
 *   composite one it wraps stays reachable only through it. Since `extend`
 *   _intersects_ member types rather than replacing them, cast the result to
 *   {@link Menubar} to see the narrowed records — that is all `reatomMenubar`
 *   does. Apply the extension once: a second pass would wrap the menubar
 *   records in another menubar layer.
 * @example
 *   const menubar = reatomComposite({
 *     orientation: 'horizontal',
 *     focusLoop: true,
 *     name: 'menubar',
 *   }).extend(withMenubarProps()) as Menubar
 */
export const withMenubarProps = (
  options: MenubarPropsOptions = {},
): AssignerExt<{ props: MenubarPropRecords }, Composite> => {
  return (target) => ({
    props: Object.assign(target.props, menubarProps(target, options)),
  })
}
