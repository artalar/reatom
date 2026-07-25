/**
 * Layer 1 for `menubar`: the model.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/menubar/menubar-store.ts`, plus the two
 * attributes `packages/ariakit-react-components/src/menubar/menubar.tsx` adds
 * on top of the composite ones.
 */

import { named } from '@reatom/core'

import type {
  CompositeModel,
  CompositeOptions,
} from '../composite/reatomComposite'
import { reatomComposite } from '../composite/reatomComposite'
import type { MenubarPropRecords } from './props'
import { withMenubarProps } from './props'

/**
 * Options of {@link reatomMenubar} — the composite ones, with two menubar
 * defaults.
 */
export interface MenubarOptions extends CompositeOptions {
  /**
   * Which arrow keys navigate the menubar. A menubar is a row of menu buttons
   * by default, matching the [APG menubar
   * pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/), so the
   * composite default (`'both'`) is overridden here.
   *
   * @default 'horizontal'
   */
  orientation?: CompositeOptions['orientation']
  /**
   * Loops from the last menu item back to the first one. Menubars loop by
   * default — the composite default (`false`) is overridden here.
   *
   * @default true
   */
  focusLoop?: CompositeOptions['focusLoop']
}

/**
 * A menubar model.
 *
 * @remarks
 *   Structurally a {@link CompositeModel}: Ariakit's `createMenubarStore` is
 *   `createCompositeStore` with two different defaults, and the menubar adds no
 *   state of its own. Reading the model reads `activeId`, i.e. which menu
 *   button is the current one.
 */
export interface MenubarModel extends CompositeModel {}

/**
 * The model returned by {@link reatomMenubar}: {@link MenubarModel} plus the prop
 * records.
 */
export interface Menubar extends MenubarModel {
  /** Reactive prop records for the menubar element and its menu items. */
  props: MenubarPropRecords
}

/**
 * Creates a menubar model: a horizontal, looping composite whose element is a
 * `menubar` and whose items are `menuitem`s.
 *
 * @remarks
 *   Ariakit's menubar store adds nothing to the composite one
 *   (`ariakit-components/src/menubar/menubar-store.ts` is 51 lines, of which
 *   the only logic is `orientation: 'horizontal'` and `focusLoop: true`), so
 *   this port is deliberately thin: the navigation, the roving tabindex, the
 *   item collection, and the `move` event all come from {@link reatomComposite},
 *   and the menubar contributes the two ARIA roles.
 *
 *   Submenus are not part of it. A menu button lives in the menubar as a plain
 *   item; the popup it controls is a `menu` model (Wave 5), which takes the
 *   menubar as its `menubar` option and adds `aria-haspopup` / `aria-expanded`
 *   to the item's props. `menu-bar` — Ariakit's deprecated `createMenuBarStore`
 *   alias — is not ported; use this factory.
 * @example
 *   const menubar = reatomMenubar({ name: 'menubar' })
 *
 *   const file = menubar.items.renderItem({ id: 'file' })
 *   menubar.items.renderItem({ id: 'edit' })
 *   menubar.items.renderItem({ id: 'view' })
 *
 *   menubar() // 'file' — auto-seeded by the composite
 *   menubar.move(menubar.next())
 *   menubar() // 'edit'
 *   menubar.move(menubar.last())
 *   menubar.next() // 'file' — a menubar loops by default
 *
 * @example
 *   // @reatom/jsx
 *   ;<div $spread={menubar.props.base}>
 *   <button $spread={menubar.props.item(file)}>File</button>
 *   </div>
 *
 * @see https://ariakit.com/components/menubar
 */
export const reatomMenubar = (options: MenubarOptions = {}): Menubar => {
  const {
    // Ariakit's `createMenubarStore` passes these two through its
    // `defaultValue` cascade before handing the props to the composite store;
    // with plain option defaults the cascade is the signature itself.
    orientation = 'horizontal',
    focusLoop = true,
    name = named('menubar'),
    ...compositeOptions
  } = options

  return reatomComposite({
    ...compositeOptions,
    orientation,
    focusLoop,
    name,
  }).extend(withMenubarProps()) as Menubar
}
