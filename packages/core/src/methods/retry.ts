import type { Action, AtomLike } from '../core'
import { _mark, _read, ReatomError } from '../core'
import { _copy } from '../core'

/**
 * Removes all computed atom dependencies. Useful for resources / effects
 * invalidation.
 *
 * Note that this method not recall and recompute the atom, it only throws it's
 * deps. Use `retryComputed` to reevaluate the computed.
 *
 * @param target - The reactive atom whose dependencies should be reset.
 * @throws {ReatomError} If the target is an action.
 */
export const reset = <T extends AtomLike>(target: T) => {
  if (!target.__reatom.reactive) {
    throw new ReatomError('Only reactive atoms can be reset')
  }

  let targetFrame = _read(target)
  if (targetFrame) {
    // FIXME: `splice` only new frame, do not brake immutability!
    _copy(targetFrame).pubs.splice(1)
    if (targetFrame.subs.length > 0 || targetFrame.listeners.length > 0) {
      _mark(targetFrame)
    }
  }
}

/**
 * Retries computed atom by resetting its dependencies and re-evaluating the
 * computed function .
 *
 * @template T - The return type of the atom.
 * @param target - The atom to retry.
 * @returns The result of the atom after retrying.
 * @throws {ReatomError} If the target is not an action.
 */
// @ts-expect-error
export const retryComputed: {
  (target: Action): never

  <T>(target: AtomLike<any, any, T>): T
} = (target: AtomLike) => {
  reset(target)

  return target()
}
