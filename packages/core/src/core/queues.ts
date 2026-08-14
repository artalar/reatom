import type { Fn } from '../utils'
import { context } from './'
import { _createGlobal } from './globalStore'

export type QueueKind = 'hook' | 'compute' | 'cleanup' | 'effect'

/**
 * Schedules a function to be executed in a specific queue of the current
 * context.
 *
 * This is the core mechanism for scheduling reactive updates in Reatom. When an
 * atom's state changes, tasks are queued to be executed afterwards in the
 * appropriate order. If this is the first task being scheduled, a microtask is
 * created to process the queues asynchronously.
 *
 * @param fn - The function to schedule for execution
 * @param queue - The queue to add the function to ('hook', 'compute',
 *   'cleanup', or 'effect')
 */
export let _enqueue = (fn: Fn, queue: QueueKind): void => {
  let { state } = context()

  state.pushQueue(fn, queue)

  if (!state.scheduled) {
    state.scheduled = true
    queueMicrotask(state.notify)
  }
}

let batchNest = _createGlobal('batchNest', () => ({ depth: 0 }))

/**
 * Runs a callback as a nested batch and optionally flushes the queue after the
 * outermost batch completes.
 *
 * Use `shouldNotify: true` for user-facing write batches that must notify
 * synchronously after all nested writes finish. Leave it `false` when wrapping
 * reads such as computed values or effects.
 *
 * @example
 *   import { atom, batch } from '@reatom/core'
 *
 *   const count = atom(0, 'count')
 *
 *   batch(() => {
 *     count.set(1)
 *     count.set(2)
 *   }, true)
 *
 * @param cb - The callback to run inside the batch
 * @param shouldNotify - Whether to call `notify` after the outermost batch
 * @returns The callback result
 */
export let batch = <T>(cb: () => T, shouldNotify: boolean = false): T => {
  try {
    batchNest.depth++
    return cb()
  } finally {
    batchNest.depth--
    if (shouldNotify && batchNest.depth === 0) {
      notify()
    }
  }
}

/**
 * Processes all scheduled tasks in the current context's queues.
 *
 * This function is called automatically after tasks have been scheduled via
 * `enqueue`. It processes tasks in the following priority order:
 *
 * 1. Hook tasks
 * 2. Compute tasks
 * 3. Cleanup tasks
 * 4. Effect tasks
 *
 * The function resets priority after each task execution to ensure higher
 * priority tasks (which may have been added during execution) are processed
 * first.
 */
export let notify = () => {
  let { state } = context()

  let iHook = 0
  let iCompute = 0
  let iCleanup = 0
  let iEffect = 0

  // Drain queues in priority order, rechecking higher priority queues after
  // each task as user code may enqueue new tasks.
  while (true) {
    let next: undefined | Fn
    if (iHook < state.hook.length) next = state.hook[iHook++]
    else if (iCompute < state.compute.length) next = state.compute[iCompute++]
    else if (iCleanup < state.cleanup.length) next = state.cleanup[iCleanup++]
    else if (iEffect < state.effect.length) next = state.effect[iEffect++]
    else break

    try {
      next!()
    } catch (error) {
      console.error('Unhandled error in Reatom queue!')
      console.log(error)
    }
  }

  state.hook = []
  state.compute = []
  state.cleanup = []
  state.effect = []

  state.scheduled = false
}
