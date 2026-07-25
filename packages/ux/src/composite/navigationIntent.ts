/**
 * Layer 1 keyboard policy for `composite`: which navigation a key press asks
 * for, as a pure function of the key and the widget shape.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): the `keyMap` objects of
 * `packages/ariakit-react-components/src/composite/composite-item.tsx` (item
 * level) and `packages/ariakit-react-components/src/composite/composite.tsx`
 * (base element level).
 *
 * Ariakit inlines both maps in its components, so the orientation / grid / RTL
 * policy can only be tested by rendering a widget and pressing keys. Splitting
 * the mapping out keeps the DOM out of the decision: the prop records read the
 * event, these functions decide what it means, and {@link getNextId} resolves it
 * to an id.
 */

import type { CompositeDirection, CompositeOrientation } from './getNextId'

/**
 * A resolvable navigation step.
 *
 * The four {@link CompositeDirection} moves are relative to the active item;
 * `first`, `last`, and `firstInLastRow` are absolute and used to _enter_ a
 * widget that has no active item.
 */
export type CompositeNavigationMove =
  | CompositeDirection
  | 'first'
  | 'last'
  | 'firstInLastRow'

/** What a key press asks the composite to do. */
export interface CompositeNavigationIntent {
  /** The navigation step to resolve. */
  move: CompositeNavigationMove
  /**
   * Items to skip inside the row or column, for the Home / End / PageUp /
   * PageDown mode. A negative value means "as far as the row goes".
   */
  skip?: number
}

/**
 * The minimal shape of a key event the mappers read.
 *
 * Structural on purpose: a DOM `KeyboardEvent`, a React synthetic event, and a
 * plain object from a unit test all satisfy it.
 */
export interface CompositeNavigationKeyEvent {
  key: string
  /** `Ctrl+Home` / `Ctrl+End` leave the current row and jump to the whole grid. */
  ctrlKey?: boolean
}

/** The widget shape {@link mapNavigationIntent} needs. */
export interface CompositeNavigationContext {
  /**
   * Which arrow keys navigate a one-dimensional composite. Ignored on a grid,
   * where all four always do.
   *
   * @default 'both'
   */
  orientation?: CompositeOrientation
  /**
   * Whether the composite is two-dimensional, i.e. the active item has a
   * `rowId`.
   *
   * @default false
   */
  grid?: boolean
  /**
   * Whether the base element is a text field. Home and End then belong to the
   * text caret rather than to the widget, unless the widget is a grid or is
   * navigated horizontally.
   *
   * @default false
   */
  baseIsTextField?: boolean
  /**
   * How many items a page holds, for PageUp / PageDown. Ariakit measures the
   * scrolling element to find the item one page away (`findNextPageItemId`),
   * which needs layout — pass the measured size here, or leave it out to make
   * paging jump to the first / last item.
   */
  pageSize?: number
}

const HORIZONTAL_KEYS = ['ArrowLeft', 'ArrowRight', 'Home', 'End']

/**
 * Maps a key press on a composite _item_ to a navigation intent, or `null` when
 * the key means nothing to the widget and must keep its default behavior.
 *
 * @remarks
 *   Ported from the `keyMap` of Ariakit's `useCompositeItem`. Note what is
 *   deliberately absent: RTL does not flip the arrow keys here, because
 *   {@link getNextId} reverses the item list instead — that way the flip also
 *   applies to loops and wraps.
 *
 *   Two DOM-dependent guards Ariakit applies around this map stay in Layer 2: a
 *   textbox item only navigates when the caret sits at the edge of its value,
 *   and PageUp / PageDown measure the scrolling element (see
 *   {@link CompositeNavigationContext.pageSize}).
 * @example
 *   mapNavigationIntent({ key: 'ArrowDown' }, {}) // { move: 'down' }
 *   mapNavigationIntent({ key: 'ArrowDown' }, { orientation: 'horizontal' }) // null
 *   mapNavigationIntent({ key: 'End' }, { grid: true }) // { move: 'next', skip: -1 }
 *   mapNavigationIntent({ key: 'End' }, { grid: true, ctrlKey: true }) // { move: 'last' }
 */
export const mapNavigationIntent = (
  event: CompositeNavigationKeyEvent,
  context: CompositeNavigationContext = {},
): CompositeNavigationIntent | null => {
  const {
    orientation = 'both',
    grid = false,
    baseIsTextField,
    pageSize,
  } = context
  const isVertical = orientation !== 'horizontal'
  const isHorizontal = orientation !== 'vertical'
  // A vertical one-dimensional composite inside a text field leaves Home and
  // End to the caret.
  const canHomeEnd = grid || isHorizontal || !baseIsTextField

  switch (event.key) {
    case 'ArrowUp':
      return grid || isVertical ? { move: 'up' } : null
    case 'ArrowDown':
      return grid || isVertical ? { move: 'down' } : null
    case 'ArrowRight':
      return grid || isHorizontal ? { move: 'next' } : null
    case 'ArrowLeft':
      return grid || isHorizontal ? { move: 'previous' } : null
    case 'Home':
      if (!canHomeEnd) return null
      // On a grid, Home goes to the start of the row; Ctrl+Home to the very
      // first item. A negative skip is Ariakit's `previous(-1)`.
      return !grid || event.ctrlKey
        ? { move: 'first' }
        : { move: 'previous', skip: -1 }
    case 'End':
      if (!canHomeEnd) return null
      return !grid || event.ctrlKey
        ? { move: 'last' }
        : { move: 'next', skip: -1 }
    case 'PageUp':
      return pageSize == null
        ? { move: 'first' }
        : { move: 'up', skip: pageSize }
    case 'PageDown':
      return pageSize == null
        ? { move: 'last' }
        : { move: 'down', skip: pageSize }
    default:
      return null
  }
}

/**
 * Maps a key press on the composite _base element_ to the intent that enters
 * the widget, or `null` when the key must keep its default behavior.
 *
 * @remarks
 *   Ported from the `keyMap` of Ariakit's `useComposite`, which applies while no
 *   active item is connected to the DOM: every key that would move focus inside
 *   the widget instead picks an entry point.
 *
 *   `ArrowUp` on a grid enters at the beginning of the last row
 *   (`firstInLastRow`), not at its last item — that is Ariakit's
 *   `findFirstEnabledItemInTheLastRow`.
 * @example
 *   mapEntryIntent({ key: 'ArrowDown' }, {}) // { move: 'first' }
 *   mapEntryIntent({ key: 'ArrowUp' }, {}) // { move: 'last' }
 *   mapEntryIntent({ key: 'ArrowUp' }, { grid: true }) // { move: 'firstInLastRow' }
 *   mapEntryIntent({ key: 'Home' }, { baseIsTextField: true }) // null
 */
export const mapEntryIntent = (
  event: CompositeNavigationKeyEvent,
  context: CompositeNavigationContext = {},
): CompositeNavigationIntent | null => {
  const { orientation = 'both', grid = false, baseIsTextField } = context
  const isVertical = orientation !== 'horizontal'
  const isHorizontal = orientation !== 'vertical'

  // Horizontal keys belong to the caret of a text field base element (a
  // combobox input), never to the widget.
  if (baseIsTextField && HORIZONTAL_KEYS.includes(event.key)) return null

  const up: CompositeNavigationIntent = grid
    ? { move: 'firstInLastRow' }
    : { move: 'last' }

  switch (event.key) {
    case 'ArrowUp':
      return grid || isVertical ? up : null
    case 'ArrowDown':
      return grid || isVertical ? { move: 'first' } : null
    case 'ArrowRight':
      return grid || isHorizontal ? { move: 'first' } : null
    case 'ArrowLeft':
      return grid || isHorizontal ? { move: 'last' } : null
    case 'Home':
    case 'PageUp':
      return { move: 'first' }
    case 'End':
    case 'PageDown':
      return { move: 'last' }
    default:
      return null
  }
}
