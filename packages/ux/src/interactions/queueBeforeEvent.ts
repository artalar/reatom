/**
 * Deferred scheduling helper shared by the `command` and `focusable` Layer 2
 * bindings.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): `packages/ariakit-utils/src/events.ts`.
 */

import { onEvent, wrap } from '@reatom/core'

/**
 * Runs `callback` on the next animation frame, or earlier if `type` fires on
 * `element` first.
 *
 * Two consumers need this exact "whichever comes first" scheduling:
 *
 * - `focusable` queues the focus-visible flag before `focusout`, so focus leaving
 *   the element cancels a ring that was never actually shown;
 * - `command` queues the synthetic click before `keyup` on Firefox, which blocks
 *   `target="_blank"` popups opened from a click dispatched synchronously or in
 *   a microtask.
 *
 * The listener is registered in the capture phase (as Ariakit does) so it runs
 * before the element's own handlers for the same event.
 *
 * @param element - Event target to race against the frame.
 * @param type - Event type that short-circuits the wait.
 * @param callback - Runs exactly once, either from the event or from the timer.
 * @param timeout - Use a `setTimeout` of this many milliseconds instead of an
 *   animation frame.
 * @returns A cancel function; calling it prevents `callback` from ever running.
 */
export const queueBeforeEvent = (
  element: EventTarget,
  type: string,
  callback: () => void,
  timeout?: number,
): (() => void) => {
  let settled = false
  let cancelTimer = () => {}
  let unsubscribe = () => {}

  const cancel = () => {
    settled = true
    cancelTimer()
    unsubscribe()
  }

  const run = () => {
    if (settled) return
    cancel()
    callback()
  }

  if (timeout === undefined) {
    const frameId = requestAnimationFrame(wrap(run))
    cancelTimer = () => cancelAnimationFrame(frameId)
  } else {
    const timerId = setTimeout(wrap(run), timeout)
    cancelTimer = () => clearTimeout(timerId)
  }

  unsubscribe = onEvent(element, type, run, { once: true, capture: true })

  return cancel
}
