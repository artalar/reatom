import type { Action, AssignerExt, Frame } from '../core'
import { _enqueue, _read, action, top, withMiddleware } from '../core'
import { memoKey, ReatomAbortController } from '../methods'
import { abortVar } from '../methods'
import { _getPrevFrame } from '../methods/context'
import { throwAbort, throwIfAborted } from '../utils'
import { type Fn } from '../utils'
import { isAbort, noop, removeItem } from '../utils'

export interface AbortExt {
  abort: Action<[reason?: any]>
}

let abortControllers = (
  activeControllers: Array<AbortController>,
  reason: string,
) =>
  activeControllers.splice(0).forEach((controller) => controller.abort(reason))

/**
 * Extension to add abort handling to actions and computed atoms.
 *
 * @example
 *   // last-in-win: only the last request matters
 *   const fetchUser = action(async (id: number) => {
 *     const response = await wrap(fetch(`/api/user/${id}`))
 *     return response.json()
 *   }).extend(withAbort())
 *
 *   fetchUser(1) // will be aborted
 *   fetchUser(2) // will be aborted
 *   fetchUser(3) // this one wins
 *
 * @example
 *   // first-in-win: ignore subsequent calls until the first completes
 *   const fetchOnce = action(async () => {
 *     await wrap(fetch('/api/data'))
 *   }).extend(withAbort('first-in-win'))
 *
 *   fetchOnce() // runs
 *   fetchOnce() // ignored, returns previous promise
 *   fetchOnce() // ignored, returns previous promise
 *
 * @example
 *   // manual with manual abort (useful for polling/long-running tasks)
 *   const poll = action(async () => {
 *     while (true) {
 *       await wrap(sleep(1000))
 *       doSome()
 *     }
 *   }).extend(withAbort('manual'))
 *
 *   // start
 *   poll()
 *
 *   // stop
 *   poll.abort()
 *
 * @param strategy - The abort strategy to use:
 *
 *   - `'last-in-win'` (default): Aborts previous concurrent calls when a new one
 *       starts
 *   - `'first-in-win'`: Ignores new calls while a previous one is still running
 *   - `'manual'`: No automatic abort, just adds the `abort` action for manual
 *       control
 */
export let withAbort =
  (
    strategy:
      | 'last-in-win'
      | 'first-in-win'
      | 'finally'
      | 'manual' = 'last-in-win',
  ): AssignerExt<AbortExt> =>
  (target) => {
    let recomputed = new WeakSet<Frame>()

    let getAbortState = () =>
      memoKey('withAbort', () => ({
        activeControllers: new Array<AbortController>(),
        lastFirstInWin: null as null | ReatomAbortController,
      }))

    let withAbort = (next: Fn, ...params: any[]) => {
      let frame = top()
      let prevFrame = _getPrevFrame(frame)
      let prevController = prevFrame && abortVar.first(prevFrame)
      let prevState = frame.state
      let state = prevState

      let abortState = getAbortState()
      let activeControllers = abortState.activeControllers

      if (strategy === 'first-in-win' && activeControllers.length > 0) {
        throwAbort('first-in-win processing')
      }

      let thisController = abortVar.set(
        new ReatomAbortController(`${target.name}.withAbort`),
      )
      let subscriptions = 0

      // TODO: remove monkey patching
      {
        let addEventListener = thisController.signal.addEventListener
        // @ts-ignore
        thisController.signal.addEventListener = (type, listener, options) => {
          addEventListener.call(thisController.signal, type, listener, options)
          // abortVar.subscribe
          if (options instanceof AbortController) {
            subscriptions++
            options.signal.addEventListener('abort', () => {
              if (--subscriptions === 0) {
                removeItem(activeControllers, thisController)
              }
            })
          }
        }
      }

      let computationError: unknown
      let hasError = false

      if (target.__reatom.reactive) recomputed.delete(frame)

      if (
        prevController &&
        strategy === 'last-in-win' &&
        !target.__reatom.reactive
      ) {
        abortControllers(activeControllers, 'concurrent')
      }

      try {
        state = next(...params)
      } catch (error) {
        computationError = error
        hasError = true
      }

      if (
        prevController &&
        strategy === 'last-in-win' &&
        target.__reatom.reactive &&
        !recomputed.has(frame)
      ) {
        // may be just reading, no computed recall
        // TODO try
        // if (state !== prevState) throw 42
        abortVar.set(prevController)
        if (hasError) throw computationError
        return state
      }

      if (hasError) throw computationError

      if (thisController.signal.aborted && thisController.keepState) {
        return state
      }

      activeControllers.push(thisController)

      if (strategy === 'first-in-win') {
        abortState.lastFirstInWin = thisController
      }

      let maybePromise = target.__reatom.reactive
        ? state
        : state.at(-1)?.payload

      if (maybePromise instanceof Promise) {
        let aborted = false
        let wrappedPromise: Promise<any>
        wrappedPromise = new Promise(async (res, rej) => {
          let abortSubscription
          try {
            abortSubscription = abortVar.subscribe((error) => {
              maybePromise.catch(noop)
              rej(error)
            })
            let value = await maybePromise

            if (subscriptions === 0)
              removeItem(activeControllers, thisController)

            throwIfAborted(abortSubscription.controller)
            abortSubscription.unsubscribe()
            res(value)
          } catch (error) {
            if (subscriptions === 0)
              removeItem(activeControllers, thisController)

            if (isAbort(error)) {
              aborted = true
              wrappedPromise?.catch(noop)
            }
            abortSubscription?.unsubscribe()
            rej(error)
          }

          if (strategy === 'finally') {
            queueMicrotask(() => thisController.abort('finally'))
          }
        })
        if (aborted) wrappedPromise.catch(noop)

        if (target.__reatom.reactive) {
          state = wrappedPromise
        } else {
          state.at(-1)!.payload = wrappedPromise
        }
      } else {
        if (subscriptions === 0) {
          _enqueue(() => {
            if (subscriptions === 0)
              removeItem(activeControllers, thisController)
          }, 'effect')
        }
      }

      return state
    }

    if (target.__reatom.reactive) {
      withMiddleware(
        () =>
          (next: Fn, ...args: any[]) => {
            let frame = top()
            let prevFrame = _getPrevFrame(frame)
            let prevController = prevFrame && abortVar.first(prevFrame)

            if (strategy === 'last-in-win' && prevController) {
              abortControllers(getAbortState().activeControllers, 'concurrent')
            }

            recomputed.add(frame)
            return next(...args)
          },
        'computed',
      )(target)
    }

    withMiddleware(() => withAbort)(target)

    return {
      abort: action((reason?: any) => {
        let targetFrame = _read(target)
        let abortState = targetFrame?.run(getAbortState)
        let activeControllers = abortState?.activeControllers

        if (!activeControllers || activeControllers.length === 0) {
          if (strategy === 'first-in-win') {
            if (abortState?.lastFirstInWin)
              activeControllers = [abortState.lastFirstInWin]
          } else if (targetFrame?.['var#abort']) {
            activeControllers = [targetFrame['var#abort']]
          }
        }

        if (activeControllers) {
          abortControllers(activeControllers, reason || 'abort')
        }
      }, `${target.name}._abort`),
    }
  }
