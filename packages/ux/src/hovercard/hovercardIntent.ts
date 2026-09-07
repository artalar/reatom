/**
 * Layer 1 for `hovercard`: the pointer policy, as pure functions.
 *
 * Ariakit spends two `useEffect`s and ~70 lines of `onMouseMove` on deciding
 * what a pointer position means for an open hovercard. The decision itself is a
 * total function of seven booleans, so it lives here and the DOM layer only
 * gathers the facts and carries out the intent.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/hovercard/hovercard.tsx`
 * (`isMovingOnHovercard`, the `mousemove` effect, and the pointer-event
 * suppression effect), `hovercard-anchor.tsx` (the `mousemove` handler), and
 * `packages/ariakit-react-utils/src/hooks.ts` (`hasMouseMovement`).
 */

import type { Point } from './safePolygon'

/** What a pointer position means for an open hovercard. */
export type HovercardMoveIntent =
  /** Nothing to do: the position carries no information. */
  | 'ignore'
  /** The pointer is on the card, its anchor, or a nested card — keep it open. */
  | 'keep'
  /**
   * The pointer is travelling toward the card — keep it open and suppress the
   * events that would otherwise move focus away.
   */
  | 'approach'
  /** The pointer left for good — close the card after `hideDelay`. */
  | 'hide'

/** What {@link mapHovercardMoveIntent} needs to know about a pointer position. */
export interface HovercardMoveContext {
  /**
   * Whether the pointer really moved.
   *
   * A `mousemove` also fires when the page scrolls under a still pointer, and
   * on a touch tap; both must be ignored. See {@link getPointerMovement}.
   */
  moving: boolean
  /**
   * Whether focus is inside the card, which pins it open regardless of the
   * pointer.
   */
  focusWithin: boolean
  /** Whether the position is over the card or over a nested card. */
  onCard: boolean
  /** Whether the position is over the anchor element. */
  onAnchor: boolean
  /**
   * Whether a delayed hide is already running, so this position changes
   * nothing.
   */
  hidePending: boolean
  /** Whether the position is inside the safe polygon toward the card. */
  inPolygon: boolean
  /** The model's `hideOnHoverOutside`. */
  hideOnHoverOutside: boolean
}

/**
 * Decides what a pointer position means for an open hovercard.
 *
 * @remarks
 *   The order of the checks is the behavior, and it is Ariakit's:
 *
 *   1. A position that is not a real move says nothing.
 *   2. Focus inside the card, or a pointer on the card / anchor / nested card, keeps
 *        it open — and cancels a hide that was already scheduled.
 *   3. A hide that is already scheduled is not rescheduled, so the delay is measured
 *        from the moment the pointer left rather than from the last move.
 *   4. A position inside the safe polygon is hover intent, even though it is over
 *        neither element.
 *   5. Anything else closes the card, unless the consumer turned that off.
 *
 * @example
 *   mapHovercardMoveIntent({
 *     moving: true,
 *     focusWithin: false,
 *     onCard: false,
 *     onAnchor: false,
 *     hidePending: false,
 *     inPolygon: true,
 *     hideOnHoverOutside: true,
 *   }) // 'approach'
 */
export const mapHovercardMoveIntent = ({
  moving,
  focusWithin,
  onCard,
  onAnchor,
  hidePending,
  inPolygon,
  hideOnHoverOutside,
}: HovercardMoveContext): HovercardMoveIntent => {
  if (!moving) return 'ignore'
  // Ariakit's `isMovingOnHovercard`: the card has focus, or the pointer is
  // inside the card, the anchor, or one of the nested cards.
  if (focusWithin || onCard || onAnchor) return 'keep'
  if (hidePending) return 'ignore'
  if (inPolygon) return 'approach'
  if (!hideOnHoverOutside) return 'ignore'
  return 'hide'
}

/**
 * Where the enter point goes after a {@link HovercardMoveIntent} of `'keep'`.
 *
 * While the pointer is over the anchor the last position is remembered, because
 * that is the point the safe polygon will fan out from once the pointer leaves.
 * A pointer on the card itself clears it: there is nothing left to travel to.
 */
export const nextHovercardEnterPoint = (
  onAnchor: boolean,
  point: Point,
): Point | null => (onAnchor ? point : null)

/** What {@link mapHovercardShowIntent} needs to know about an anchor `mousemove`. */
export interface HovercardShowContext {
  /** Whether another handler already handled the event. */
  defaultPrevented: boolean
  /**
   * Whether a delayed show is already running. Ariakit's `if
   * (showTimeoutRef.current) return`: the delay is measured from the first move
   * over the anchor, not restarted by every following one.
   */
  showPending: boolean
  /** Whether the pointer really moved. See {@link getPointerMovement}. */
  moving: boolean
  /**
   * The model's `showOnHover`.
   *
   * @remarks
   *   Ariakit checks the anchor's disabled state separately, through
   *   `Focusable`'s `disabledFromProps`. There is no such prop here, so a
   *   disabled anchor is expressed by deriving `showOnHover` from the state
   *   that disables it — `hovercard.showOnHover.extend(withComputed(() =>
   *   !anchor.disabled()))` — which keeps the policy reactive instead of frozen
   *   into a prop-record option.
   */
  showOnHover: boolean
}

/**
 * Whether an anchor `mousemove` should start the delayed show.
 *
 * @example
 *   mapHovercardShowIntent({
 *     defaultPrevented: false,
 *     showPending: false,
 *     moving: true,
 *     showOnHover: true,
 *   }) // 'show'
 */
export const mapHovercardShowIntent = ({
  defaultPrevented,
  showPending,
  moving,
  showOnHover,
}: HovercardShowContext): 'show' | 'ignore' => {
  if (defaultPrevented) return 'ignore'
  if (showPending) return 'ignore'
  if (!moving) return 'ignore'
  if (!showOnHover) return 'ignore'
  return 'show'
}

/**
 * The movement fields of a mouse event.
 *
 * Structural on purpose, and every field optional: a synthetic event dispatched
 * by a test has none of them, which is exactly the case Ariakit's
 * `hasMouseMovement` special-cases with a `NODE_ENV === 'test'` escape hatch.
 * Here a test states its intent instead, by passing `movementX` or by writing
 * the atom.
 */
export interface PointerMovementEvent {
  movementX?: number
  movementY?: number
  screenX?: number
  screenY?: number
}

/**
 * Whether a mouse event carries actual pointer movement, and the screen
 * position to diff the next one against.
 *
 * @remarks
 *   Port of Ariakit's `hasMouseMovement`. `movementX` / `movementY` are the
 *   authoritative answer, but they are `0` in browsers that do not implement
 *   them for `mousemove` and in synthetic events, so the screen coordinates are
 *   diffed as a fallback. This is what distinguishes a moving pointer from the
 *   `mousemove` a scroll fires under a still one, and from the compatibility
 *   `mousemove` of a touch tap.
 * @example
 *   getPointerMovement({ movementX: 0, movementY: 0 }, [0, 0])
 *   // { moving: false, point: [0, 0] }
 *   getPointerMovement({ screenX: 10, screenY: 0 }, [0, 0])
 *   // { moving: true, point: [10, 0] }
 *
 * @param event - The event to inspect.
 * @param previous - The screen position of the previous event.
 */
export const getPointerMovement = (
  event: PointerMovementEvent,
  previous: Point,
): { moving: boolean; point: Point } => {
  const screenX = event.screenX ?? 0
  const screenY = event.screenY ?? 0
  const movementX = event.movementX || screenX - previous[0]
  const movementY = event.movementY || screenY - previous[1]

  return {
    moving: movementX !== 0 || movementY !== 0,
    point: [screenX, screenY],
  }
}
