import type { Action, ActionState, AtomLike, AtomState, Frame } from '../core'
import { _read, _trackAction, ReatomError, top } from '../core'
import { assert } from '../utils'
import { _getPrevFrame } from './context'
import { peek } from './peek'

export let isChanged = (target: AtomLike): boolean => {
  let frame = top()
  let prevPubs = _getPrevFrame(frame)?.pubs ?? [null]
  let prevTargetFrame = prevPubs[frame.pubs.length]

  target()
  let targetFrame = _read(target)!

  return (
    targetFrame.atom !== prevTargetFrame?.atom ||
    !Object.is(targetFrame.state, prevTargetFrame.state)
  )
}

/**
 * Executes a callback when an atom's state changes
 *
 * This utility evaluates if an atom's state has changed during the current
 * frame execution and calls the provided callback with the new state (and
 * optionally the previous state if available).
 *
 * @example
 *   // Log when the user's name changes
 *   ifChanged(userName, (newName, oldName) => {
 *     console.log(`Name changed from ${oldName} to ${newName}`)
 *   })
 *
 * @template T - Type extending AtomLike
 * @param {T} target - The atom to monitor for changes
 * @param {(newState: AtomState<T>, oldState?: AtomState<T>) => void} cb -
 *   Callback to execute when the atom changes
 * @throws {ReatomError} If target is not a reactive atom
 */
export const ifChanged = <T extends AtomLike>(
  target: T,
  cb: (
    newState: AtomState<T>,
    oldState?: AtomState<T>,
    isFirst?: boolean,
  ) => void,
) => {
  if (!target.__reatom.reactive) {
    throw new ReatomError('atom expected')
  }

  let frame = top()
  assert(frame.atom.__reatom.linking, 'invalid context', ReatomError)
  let prevPubs = _getPrevFrame(frame)?.pubs ?? [null]
  let prevTargetFrame = prevPubs[frame.pubs.length]

  target()
  let targetFrame = _read(target)!

  if (targetFrame.atom !== prevTargetFrame?.atom) {
    peek(cb, targetFrame.state, undefined, true)
  } else if (!Object.is(targetFrame.state, prevTargetFrame.state)) {
    peek(cb, targetFrame.state, prevTargetFrame.state, false)
  }
}

/**
 * Retrieves new action calls that occurred in the current batch.
 *
 * This utility function tracks action invocations and returns an array of new
 * calls that have been made during the current batch. It's particularly useful
 * for monitoring action activity within computed atoms or effects without
 * triggering side effects during the action execution itself.
 *
 * In a computed atom, the function compares the current action state with the
 * previous frame's state to determine which calls are new. If this is the first
 * time the action is being tracked, all current calls are considered new.
 * Otherwise, only calls that weren't present in the previous frame are
 * returned. If the computed triggered by some other dependent atom change, the
 * function may return an empty array. The past calls are not stored!
 *
 * @example
 *   // Monitor API calls in an effect
 *   const apiCall = action((endpoint: string) => fetch(endpoint), 'apiCall')
 *
 *   effect(() => {
 *     const newCalls = getCalls(apiCall)
 *     newCalls.forEach(({ payload, params }) => {
 *       console.log(`API called: ${params[0]}, Response:`, payload)
 *     })
 *   }, 'apiMonitor')
 *
 * @template Params - Array type representing the action's parameter types
 * @template Payload - Type of the action's return value/payload
 * @param {Action<Params, Payload>} target - The action to monitor for new calls
 * @returns {{ payload: Payload; params: Params }[]} Array of new action calls,
 *   each containing the action's payload (return value) and the parameters it
 *   was called with
 * @throws {ReatomError} If target is a reactive atom instead of an action
 */
export const getCalls = <Params extends any[], Payload>(
  target: Action<Params, Payload>,
): Array<{ payload: Payload; params: Params }> => {
  if (target.__reatom.reactive) {
    throw new ReatomError('action expected')
  }

  type ActionFrame = Frame<ActionState<Params, Payload>, Params, Payload>

  let frame = top()
  let prevPubs = frame.atom.__reatom.linking
    ? (_getPrevFrame(frame)?.pubs ?? [null])
    : [null]
  let prevTargetFrame = prevPubs[frame.pubs.length] as undefined | ActionFrame

  let targetFrame = _trackAction(target, frame) as ActionFrame

  const calls =
    targetFrame.atom !== prevTargetFrame?.atom
      ? targetFrame.state
      : Object.is(targetFrame.state, prevTargetFrame.state)
        ? []
        : targetFrame.state.slice(prevTargetFrame.state.length)

  return calls
}
