/**
 * Layer 1 for `tooltip`: the two questions a tooltip adds to the hovercard's
 * hover policy, as a pure function.
 *
 * Ariakit expresses both by passing a `showOnHover` _callback_ down to
 * `useHovercardAnchor`, which reads a mutable ref and a module-level global
 * store and — for one of the two answers — calls `store.show()` from inside the
 * predicate before returning `false`. Splitting the decision from the effect
 * turns that into a total function of six booleans, so the whole policy is
 * node-testable and the prop record only has to carry the intent out.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/tooltip/tooltip-anchor.tsx`.
 */

import type { HovercardShowContext } from '../hovercard/hovercardIntent'
import { mapHovercardShowIntent } from '../hovercard/hovercardIntent'

/** What an anchor `mousemove` means for a tooltip. */
export type TooltipShowIntent =
  /**
   * Nothing to do: the position carries no information, or the anchor is not
   * armed.
   */
  | 'ignore'
  /** Open the tooltip after `showDelay`, like a hovercard. */
  | 'show'
  /** Open the tooltip now: another tooltip is active, so the delay is skipped. */
  | 'showNow'

/** What {@link mapTooltipShowIntent} needs to know about an anchor `mousemove`. */
export interface TooltipShowContext extends HovercardShowContext {
  /**
   * Whether the pointer entered the anchor since the tooltip last closed.
   *
   * @remarks
   *   Ariakit: "Imagine the scenario: the user hovers over an anchor, which shows
   *   a tooltip, then presses escape to close the tooltip. We don't want to
   *   show the tooltip again while the anchor is still hovered. So we keep this
   *   flag that's set to true on mouse enter."
   */
  canShowOnHover: boolean
  /**
   * Whether another tooltip is active, in which case this one opens without
   * waiting — a row of icon buttons must not make the user pause again for
   * every neighbour.
   */
  skipDelay: boolean
}

/**
 * Whether an anchor `mousemove` should open the tooltip, and whether it should
 * wait for the show delay first.
 *
 * @remarks
 *   The hovercard's own facts are asked first — Ariakit's `showOnHover` callback
 *   is only consulted after `useHovercardAnchor` has checked
 *   `event.defaultPrevented`, its pending-show ref, and the pointer-movement
 *   flag — so an unarmed anchor is `'ignore'`, not `'showNow'`: skipping the
 *   delay is a shortcut for a tooltip that _may_ open, never a permission to
 *   open one that may not.
 * @example
 *   mapTooltipShowIntent({
 *     defaultPrevented: false,
 *     showPending: false,
 *     moving: true,
 *     showOnHover: true,
 *     canShowOnHover: true,
 *     skipDelay: false,
 *   }) // 'show'
 */
export const mapTooltipShowIntent = (
  context: TooltipShowContext,
): TooltipShowIntent => {
  if (mapHovercardShowIntent(context) === 'ignore') return 'ignore'
  if (!context.canShowOnHover) return 'ignore'
  // "Show the tooltip immediately if there's an active tooltip instead of
  // waiting for the showTimeout delay."
  return context.skipDelay ? 'showNow' : 'show'
}
