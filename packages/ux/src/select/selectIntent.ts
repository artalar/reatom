/**
 * Layer 1 interaction policy for `select`: what a key press on the select
 * button or on the list means, as pure functions of the event and the widget
 * shape.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): the `moveKeyMap` / `canShowKeyMap` pair of the
 * `onKeyDown` handler in
 * `packages/ariakit-react-components/src/select/select.tsx` and the `onKeyDown`
 * handler of `packages/ariakit-react-components/src/select/select-list.tsx`.
 *
 * Ariakit inlines both in component bodies, where the orientation, grid, and
 * placement policy can only be tested by rendering a widget and pressing keys.
 */

import type { CompositeNavigationIntent } from '../composite/navigationIntent'
import { mapNavigationIntent } from '../composite/navigationIntent'
import type { PopoverBasePlacement } from '../popover/popoverPlacement'

/**
 * The minimal shape of a key event the mappers read.
 *
 * Structural on purpose: a DOM `KeyboardEvent`, a React synthetic event, and a
 * plain object from a unit test all satisfy it.
 */
export interface SelectKeyEvent {
  key: string
}

/** The widget shape {@link mapSelectMoveIntent} needs. */
export interface SelectMoveContext {
  /**
   * Which arrow keys navigate a one-dimensional select. Ignored on a grid,
   * where all four always do.
   *
   * @default 'vertical'
   */
  orientation?: 'horizontal' | 'vertical' | 'both'
  /**
   * Whether the list is two-dimensional, i.e. its items carry a `rowId`.
   *
   * @default false
   */
  grid?: boolean
}

/**
 * Maps a key press on the select _button_ to a navigation intent, or `null`
 * when the key means nothing to the widget.
 *
 * @remarks
 *   Port of Ariakit's `moveKeyMap`, which moves the active item even while the
 *   list is hidden — that is how a closed select changes its value with the
 *   arrow keys. Only the four arrows do: Home, End, and the page keys belong to
 *   the page while the popover is closed, so Ariakit leaves them out of this
 *   map (its list has them through `useComposite` instead).
 *
 *   Modifiers are deliberately not checked, matching Ariakit: the select button
 *   is not a text field, so no arrow-key combination on it belongs to a caret.
 * @example
 *   mapSelectMoveIntent({ key: 'ArrowDown' }) // { move: 'down' }
 *   mapSelectMoveIntent({ key: 'ArrowRight' }) // null — a vertical select
 *   mapSelectMoveIntent({ key: 'ArrowRight' }, { grid: true }) // { move: 'next' }
 *   mapSelectMoveIntent({ key: 'Home' }) // null
 */
export const mapSelectMoveIntent = (
  event: SelectKeyEvent,
  context: SelectMoveContext = {},
): CompositeNavigationIntent | null => {
  if (
    event.key !== 'ArrowUp' &&
    event.key !== 'ArrowDown' &&
    event.key !== 'ArrowLeft' &&
    event.key !== 'ArrowRight'
  ) {
    return null
  }
  const { orientation = 'vertical', grid = false } = context
  return mapNavigationIntent(event, { orientation, grid })
}

/**
 * Whether the key press asks for the list to be shown.
 *
 * @remarks
 *   Port of Ariakit's `canShowKeyMap`: the key that opens the popover is the one
 *   that points at it, so a popover placed above or below opens on the vertical
 *   arrows and a side-placed one on the arrow pointing its way. The
 *   [ARIA-recommended](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) keys
 *   for a listbox popup are the vertical pair, which is what the default
 *   `bottom-start` placement gives.
 * @example
 *   isSelectShowKey({ key: 'ArrowDown' }, 'bottom') // true
 *   isSelectShowKey({ key: 'ArrowUp' }, 'top') // true
 *   isSelectShowKey({ key: 'ArrowLeft' }, 'left') // true
 *   isSelectShowKey({ key: 'ArrowLeft' }, 'bottom') // false
 *   isSelectShowKey({ key: 'Enter' }, 'bottom') // false — the click does that
 */
export const isSelectShowKey = (
  event: SelectKeyEvent,
  side: PopoverBasePlacement,
): boolean => {
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      return side === 'top' || side === 'bottom'
    case 'ArrowLeft':
      return side === 'left'
    case 'ArrowRight':
      return side === 'right'
    default:
      return false
  }
}

/**
 * Whether the key press asks to close the list and keep what is selected.
 *
 * @remarks
 *   Port of Ariakit's `hideOnEnter`. It applies to a press on the _list itself_,
 *   i.e. when no item handled the key: the list is a listbox, so `Enter` and
 *   `Space` confirm rather than activate anything.
 * @example
 *   isSelectHideKey({ key: 'Enter' }) // true
 *   isSelectHideKey({ key: ' ' }) // true
 *   isSelectHideKey({ key: 'Escape' }) // false — that resets, see below
 */
export const isSelectHideKey = (event: SelectKeyEvent): boolean =>
  event.key === 'Enter' || event.key === ' '

/**
 * Whether the key press asks to abandon what the keyboard picked.
 *
 * @remarks
 *   Port of Ariakit's `resetOnEscape`. It only matters while the value follows
 *   the active item (`setValueOnMove`, and a select whose popover is closed):
 *   moving through the list has already written the value, so `Escape` has to
 *   put back the one the list opened with. Closing the popover itself is the
 *   dialog's own `hideOnEscape`.
 * @example
 *   isSelectResetKey({ key: 'Escape' }) // true
 *   isSelectResetKey({ key: 'Enter' }) // false
 */
export const isSelectResetKey = (event: SelectKeyEvent): boolean =>
  event.key === 'Escape'
