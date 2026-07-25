/**
 * Layer 2 for `toolbar`: the reactive prop records.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/toolbar/toolbar.tsx`,
 * `toolbar-item.tsx`, `toolbar-separator.tsx`, and the orientation derivation
 * of
 * `packages/ariakit-react-components/src/composite/composite-separator.tsx`.
 */

import type { Computed, Ext } from '@reatom/core'
import { computed } from '@reatom/core'

import type { CompositeOrientation } from '../composite/getNextId'
import type {
  CompositeBaseProps,
  CompositePropRecords,
  CompositePropsOptions,
} from '../composite/props'
import { compositeProps } from '../composite/props'
import type { Composite, CompositeModel } from '../composite/reatomComposite'
import type { Toolbar } from './reatomToolbar'

/** The orientation an ARIA attribute can carry; `both` is not one of them. */
export type ToolbarAriaOrientation = 'horizontal' | 'vertical'

/**
 * The `aria-orientation` of a toolbar element.
 *
 * `both` has no ARIA counterpart — a widget navigable on both axes is a grid,
 * not an oriented one — so the attribute is dropped, exactly as Ariakit's
 * `state.orientation === 'both' ? undefined : state.orientation`.
 *
 * @example
 *   toolbarAriaOrientation('vertical') // 'vertical'
 *   toolbarAriaOrientation('both') // undefined
 */
export const toolbarAriaOrientation = (
  orientation: CompositeOrientation,
): ToolbarAriaOrientation | undefined =>
  orientation === 'both' ? undefined : orientation

/**
 * The orientation of a separator inside a composite widget: perpendicular to
 * the axis the widget is navigated on, so a horizontal toolbar is divided by
 * vertical rules.
 *
 * `both` falls back to `horizontal`, which is Ariakit's own default for a
 * widget with no single axis.
 *
 * @example
 *   toolbarSeparatorOrientation('horizontal') // 'vertical'
 *   toolbarSeparatorOrientation('both') // 'horizontal'
 */
export const toolbarSeparatorOrientation = (
  orientation: CompositeOrientation,
): ToolbarAriaOrientation =>
  orientation === 'horizontal' ? 'vertical' : 'horizontal'

/** Props to spread on the toolbar element. */
export interface ToolbarBaseProps extends CompositeBaseProps {
  /**
   * Announces a group of controls the user can move between with the arrow
   * keys, instead of tabbing through each of them.
   */
  role: 'toolbar'
  /**
   * Which axis the arrow keys navigate. `undefined` — no attribute — while the
   * `orientation` is `both`, see {@link toolbarAriaOrientation}.
   */
  'aria-orientation': ToolbarAriaOrientation | undefined
}

/** Props to spread on a divider between toolbar items. */
export interface ToolbarSeparatorProps {
  role: 'separator'
  /** Perpendicular to the toolbar, see {@link toolbarSeparatorOrientation}. */
  'aria-orientation': ToolbarAriaOrientation
}

/** Options of {@link toolbarProps} and {@link withToolbarProps}. */
export interface ToolbarPropsOptions extends CompositePropsOptions {
  /**
   * The composite records the toolbar ones build on. Defaults to a fresh
   * {@link compositeProps}; pass the records a model already carries to reuse
   * their handlers instead of allocating a second set.
   */
  composite?: CompositePropRecords
}

/** Reactive prop records of a toolbar model. */
export interface ToolbarPropRecords extends CompositePropRecords {
  /** Props for the toolbar element. */
  base: Computed<ToolbarBaseProps>
  /**
   * Props for a divider between items. A separator is not an item: it is not
   * registered, not navigable, and not focusable.
   */
  separator: Computed<ToolbarSeparatorProps>
}

/**
 * Builds the reactive prop records of a toolbar: the composite records, with
 * `role="toolbar"` and `aria-orientation` on the base element, plus a record
 * for the dividers between items.
 *
 * @remarks
 *   The item record is the composite one unchanged — Ariakit's `ToolbarItem` is
 *   `CompositeItem` with a store default — so the roving tabindex, the focus
 *   activation, and the arrow-key navigation all come from there.
 *
 *   Two Ariakit toolbar components have no record of their own. `ToolbarInput` is
 *   deprecated in favor of `<ToolbarItem render={<input />}>`, which is
 *   `props.item` on an input element. `ToolbarContainer` is
 *   `CompositeContainer` — an item that _contains_ interactive widgets — whose
 *   whole behavior is DOM focus juggling, so it belongs to a future `composite`
 *   Layer 2 module rather than here.
 * @example
 *   const props = toolbarProps(composite)
 *   props.base() // { role: 'toolbar', 'aria-orientation': 'horizontal', ... }
 */
export const toolbarProps = (
  model: CompositeModel,
  options: ToolbarPropsOptions = {},
): ToolbarPropRecords => {
  const { name = model.name, composite = compositeProps(model, { name }) } =
    options
  // Captured as a unit, not looked up through the record object: `base` is the
  // key `withToolbarProps` replaces, and reading it back through the object
  // would make the wrapper wrap itself.
  const compositeBase = composite.base

  return {
    ...composite,

    base: computed(
      (): ToolbarBaseProps => ({
        ...compositeBase(),
        role: 'toolbar',
        'aria-orientation': toolbarAriaOrientation(model.orientation()),
      }),
      `${name}.props.base`,
    ),

    separator: computed(
      (): ToolbarSeparatorProps => ({
        role: 'separator',
        'aria-orientation': toolbarSeparatorOrientation(model.orientation()),
      }),
      `${name}.props.separator`,
    ),
  }
}

/**
 * Turns a composite model into a toolbar one by upgrading its prop records.
 *
 * {@link reatomToolbar} applies it already; use it explicitly on a hand-composed
 * composite, or to make an existing composite widget announce itself as a
 * toolbar.
 *
 * @remarks
 *   The composite records are upgraded **in place**, which is why this is an
 *   `Ext` and not an assigner: `extend` refuses to replace an existing member,
 *   and the toolbar's `base` record wraps the composite's rather than
 *   substituting for it. Mutating the one record object also keeps the identity
 *   of the memoized item records, so an adapter that already attached their
 *   handlers is unaffected.
 * @example
 *   const toolbar = reatomComposite({
 *     focusLoop: true,
 *     name: 'toolbar',
 *   }).extend(withToolbarProps())
 */
export const withToolbarProps = (
  options: ToolbarPropsOptions = {},
): Ext<Composite, Toolbar> => {
  return (target) => {
    Object.assign(
      target.props,
      toolbarProps(target, { composite: target.props, ...options }),
    )
    return target as Toolbar
  }
}
