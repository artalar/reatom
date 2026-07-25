/**
 * Layer 1: the global pointer-movement model.
 *
 * "Is the pointer moving right now?" is a property of the user, not of a
 * widget, so — exactly like `keyboardModality` — there is one process-wide
 * instance and a factory for the cases where one is not enough (an iframe, a
 * test).
 *
 * It exists because hover intent has to ignore three kinds of `mousemove` a
 * browser fires without the user moving anything: the one a scroll produces
 * under a still pointer, the compatibility one a touch tap produces, and the
 * one that follows a click on the anchor. Ariakit keeps the answer in
 * module-level `let`s and installs the listeners from the first component that
 * asks.
 *
 * This file holds the flag and the transitions only; `connectPointerMoving` in
 * [`reatomHovercardDom.ts`](./reatomHovercardDom.ts) wires it to a document.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): `packages/ariakit-react-utils/src/hooks.ts`
 * (`useIsMouseMoving`, `hasMouseMovement`, `setMouseMoving`,
 * `resetMouseMoving`).
 */

import type { Action, Atom } from '@reatom/core'
import { atom, named, withActions } from '@reatom/core'

import type { PointerMovementEvent } from './hovercardIntent'
import { getPointerMovement } from './hovercardIntent'
import type { Point } from './safePolygon'

/** Options of {@link reatomPointerMoving}. */
export interface PointerMovingOptions {
  /**
   * Initial state. `false` on purpose: before any pointer event arrives there
   * is no hover intent, so a hovercard must not open.
   *
   * @default false
   */
  moving?: boolean
  /** Name of the atom. */
  name?: string
}

/**
 * Model returned by {@link reatomPointerMoving}. Reading it tells whether the
 * pointer is currently being moved by the user.
 */
export interface PointerMovingModel extends Atom<boolean> {
  /**
   * The screen position of the last event, which the next one is diffed against
   * when the browser reports no `movementX` / `movementY`.
   */
  screenPoint: Atom<Point>
  /**
   * Feeds a `mousemove` in. Returns whether the event carried real movement,
   * which is also the new state when it did.
   */
  move: Action<[event?: PointerMovementEvent], boolean>
  /**
   * Declares the pointer still: a press, a key, or a scroll happened. See
   * [ariakit#1137](https://github.com/ariakit/ariakit/issues/1137) for why a
   * press has to count.
   */
  stop: Action<[], false>
}

/**
 * Creates a pointer-movement model.
 *
 * @remarks
 *   The state is sticky, like Ariakit's: once the pointer has moved it stays
 *   "moving" until something declares it still. That is what lets an anchor
 *   `mousemove` handler open the card on the _first_ move while still refusing
 *   the synthetic move that follows a tap.
 * @example
 *   const moving = reatomPointerMoving({ name: 'app.pointerMoving' })
 *
 *   moving.move({ movementX: 4 }) // true
 *   moving() // true
 *   moving.stop() // a click, a key press, a scroll
 *   moving() // false
 */
export const reatomPointerMoving = (
  options: PointerMovingOptions = {},
): PointerMovingModel => {
  const { moving: init = false, name = named('pointerMoving') } = options
  const screenPoint = atom<Point>([0, 0], `${name}.screenPoint`)

  return atom(init, name).extend(
    () => ({ screenPoint }),
    withActions((target) => ({
      move: (event: PointerMovementEvent = {}) => {
        const { moving, point } = getPointerMovement(event, screenPoint())
        screenPoint.set(point)
        if (moving) target.set(true)
        return moving
      },
      stop: () => target.set(false) as false,
    })),
  )
}

/**
 * The process-wide pointer-movement flag every hovercard uses by default.
 *
 * Pass a dedicated model through `reatomHovercard({ moving })` in tests, or to
 * scope movement to one document.
 */
export const pointerMoving: PointerMovingModel = reatomPointerMoving({
  name: 'pointerMoving',
})
