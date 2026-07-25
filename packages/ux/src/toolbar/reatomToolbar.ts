/**
 * Layer 1 for `toolbar`: the model.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/toolbar/toolbar-store.ts`.
 */

import { named } from '@reatom/core'

import type {
  CompositeFocusPolicy,
  CompositeOrientation,
} from '../composite/getNextId'
import type {
  CompositeModel,
  CompositeOptions,
} from '../composite/reatomComposite'
import { reatomComposite } from '../composite/reatomComposite'
import type { ToolbarPropRecords } from './props'
import { withToolbarProps } from './props'

/** Options of {@link reatomToolbar}. */
export interface ToolbarOptions extends CompositeOptions {
  /**
   * Which arrow keys navigate the toolbar. A toolbar is a row of controls by
   * default, unlike a bare composite, which is navigable on both axes.
   *
   * @default 'horizontal'
   */
  orientation?: CompositeOrientation
  /**
   * Loops from the last item back to the first one. On by default: a toolbar is
   * a single tab stop, so the arrow keys are the only way through it and
   * stopping at the ends would strand the user.
   *
   * @default true
   */
  focusLoop?: CompositeFocusPolicy
}

/**
 * A toolbar model.
 *
 * Structurally a {@link CompositeModel}: Ariakit's `createToolbarStore` returns
 * a composite store with two different defaults and adds no state of its own,
 * so a toolbar _is_ a composite and every composite unit — `items`, `move`,
 * `navigate`, the navigation queries, the flags — is the toolbar's.
 */
export interface ToolbarModel extends CompositeModel {}

/**
 * The model returned by {@link reatomToolbar}: a {@link ToolbarModel} plus the
 * prop records.
 */
export interface Toolbar extends ToolbarModel {
  /** Reactive prop records for the toolbar, its items, and its separators. */
  props: ToolbarPropRecords
}

/**
 * Creates a toolbar model: a composite whose defaults describe a row of
 * controls reached by a single tab stop and walked with the arrow keys.
 *
 * @remarks
 *   Ariakit's toolbar store is 47 lines that call `createCompositeStore` with
 *   `orientation: 'horizontal'` and `focusLoop: true`, and this port is the
 *   same shape: no atom, action, or derivation is added, only two defaults
 *   changed and the a11y contract of the toolbar element filled in
 *   ([`props.ts`](./props.ts)).
 *
 *   The `defaultValue(props.orientation, syncState?.orientation, 'horizontal')`
 *   cascade collapses to a plain option default, because the `syncState` rung
 *   only exists to merge a store passed from a parent component. Sharing state
 *   in Reatom is passing the atoms, so there is nothing to merge.
 *
 *   A toolbar item is a composite item, so a toolbar needs no DOM module of its
 *   own: `withCompositeFocus()` on the model is what moves real focus with the
 *   roving tabindex, and `withDomOrder()` on `toolbar.items` is what keeps the
 *   navigation order equal to the DOM order.
 * @example
 *   const toolbar = reatomToolbar({ name: 'editor.toolbar' })
 *
 *   toolbar.items.renderItem({ id: 'bold' })
 *   toolbar.items.renderItem({ id: 'italic' })
 *
 *   toolbar() // 'bold' — the first enabled item is auto-seeded
 *   toolbar.move(toolbar.next()) // 'italic'
 *   toolbar.next() // 'bold' — focusLoop is on by default
 *
 * @example
 *   // @reatom/jsx
 *   ;<div $spread={toolbar.props.base}>
 *   <button $spread={toolbar.props.item(bold)}>Bold</button>
 *   <hr $spread={toolbar.props.separator} />
 *   <button $spread={toolbar.props.item(italic)}>Italic</button>
 *   </div>
 *
 * @example
 *   // a vertical toolbar that also moves DOM focus
 *   const sidebar = reatomToolbar({
 *     orientation: 'vertical',
 *     name: 'sidebar',
 *   }).extend(withCompositeFocus())
 *
 *   sidebar.props.base()['aria-orientation'] // 'vertical'
 *   sidebar.props.separator()['aria-orientation'] // 'horizontal'
 *
 * @see https://ariakit.com/components/toolbar
 */
export const reatomToolbar = (options: ToolbarOptions = {}): Toolbar => {
  const {
    orientation = 'horizontal',
    focusLoop = true,
    name = named('toolbar'),
    ...compositeOptions
  } = options

  return reatomComposite({
    ...compositeOptions,
    orientation,
    focusLoop,
    name,
  }).extend(withToolbarProps())
}
