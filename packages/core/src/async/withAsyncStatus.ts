import {
  _enqueue,
  _read,
  type Action,
  action,
  atom,
  type AtomLike,
  bind,
  type Computed,
  isAction,
  top,
  withMiddleware,
} from '../core'
import { withComputed } from '../extensions'
import { cacheVar } from '../extensions/withCache'
import { withMemo } from '../extensions/withMemo'
import { getCalls, memoKey } from '../methods'
import { isAbort } from '../utils'
import type { AsyncDataExt } from './withAsyncData'
import type {
  AsyncStatus,
  AsyncStatusAbortedPending,
  AsyncStatusAbortedSettle,
  AsyncStatusFirstAborted,
  AsyncStatusNeverPending,
} from './withAsyncStatus.types'

export * from './withAsyncStatus.types'

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value))

/**
 * Atom that tracks the detailed status of async operations. Provides boolean
 * flags for current state and historical state tracking.
 */
export interface AsyncStatusAtom<
  State = never,
  InitState = State,
  Err = Error,
> extends Computed<AsyncStatus<State, InitState, Err>> {
  /**
   * Resets the status atom to initial state, clearing all history flags. Useful
   * when you want to treat the next async call as a "first" call again.
   */
  reset: Action<[], AsyncStatusNeverPending<State, InitState, Err>>
}

/**
 * Initial state for async status tracking. Represents a state where no async
 * operation has ever been initiated.
 */
export const asyncStatusInitState: AsyncStatus<any, any, any> = {
  isPending: false,
  isFulfilled: false,
  isRejected: false,
  isSettled: false,

  isFirstPending: false,
  isEverPending: false,
  isEverSettled: false,

  isSWR: false,

  data: undefined as never,
  error: undefined,
}

/**
 * Extension that adds detailed status tracking to async atoms or actions.
 * Provides fine-grained state information about async operations including
 * current state, first-time flags, and historical tracking.
 *
 * This extension is typically used internally by {@link withAsync} when the
 * `status` option is enabled, but can also be applied directly to any atom that
 * has a `pending` computed.
 *
 * **Status Properties:**
 *
 * Current state flags (mutually exclusive when settled):
 *
 * - `isPending` - An async operation is currently in progress
 * - `isFulfilled` - The last completed operation succeeded
 * - `isRejected` - The last completed operation failed (non-abort errors only)
 * - `isSettled` - The operation has completed (either fulfilled or rejected)
 * - `error` - The last rejection error, or `undefined` when there is none
 *
 * Historical tracking flags:
 *
 * - `isFirstPending` - This is the first-ever pending state (useful for initial
 *   loading UI)
 * - `isEverPending` - At least one async operation has been started
 * - `isEverSettled` - At least one async operation has completed
 *
 * **Abort Handling:**
 *
 * Aborted operations are treated specially - they don't set `isRejected` to
 * true. After an abort, the status returns to the last settled state
 * (fulfilled/rejected) if one exists, otherwise it goes to a "first aborted"
 * state.
 *
 * **Named Status Types:**
 *
 * Each possible status state has a corresponding TypeScript type for precise
 * type narrowing:
 *
 * - {@link AsyncStatusNeverPending} - Initial state, no operation started yet
 * - {@link AsyncStatusFirstPending} - First async operation in progress
 * - {@link AsyncStatusAnotherPending} - Subsequent operation in progress (after
 *   settlement)
 * - {@link AsyncStatusFulfilled} - Last operation completed successfully
 * - {@link AsyncStatusRejected} - Last operation failed with an error
 * - {@link AsyncStatusFirstAborted} - First operation was aborted before settling
 * - {@link AsyncStatusAbortedPending} - Pending after a previous abort
 * - {@link AsyncStatusAbortedFulfill} - Fulfilled state restored after abort
 * - {@link AsyncStatusAbortedReject} - Rejected state restored after abort
 *
 * Union types:
 *
 * - {@link AsyncStatusPending} - Any pending state (First | Another | Aborted)
 * - {@link AsyncStatusAbortedSettle} - Any post-abort settled state (Fulfill |
 *   Reject)
 * - {@link AsyncStatus} - Union of all possible status states
 *
 * @example
 *   // Enable status tracking via withAsync options:
 *   const fetchUser = action(async (id: string) => {
 *     const res = await wrap(fetch(`/api/users/${id}`))
 *     return await wrap(res.json())
 *   }, 'fetchUser').extend(withAsync({ status: true }))
 *
 *   // Track status changes:
 *   fetchUser.status() // { isPending: false, isFirstPending: false, ... }
 *
 *   fetchUser('123')
 *   fetchUser.status() // { isPending: true, isFirstPending: true, ... }
 *
 *   await wrap(promise)
 *   fetchUser.status() // { isPending: false, isFulfilled: true, isSettled: true, ... }
 *
 * @example
 *   // Use for conditional UI rendering:
 *   const status = fetchUser.status()
 *
 *   if (status.isFirstPending) {
 *   return <Skeleton /> // Show skeleton only on first load
 *   }
 *   if (status.isPending) {
 *   return <Spinner /> // Show spinner on subsequent loads
 *   }
 *   if (status.isRejected) {
 *   return <ErrorMessage />
 *   }
 *
 * @example
 *   // Reset status to treat next call as first:
 *   fetchUser.status.reset()
 *   fetchUser.status().isEverPending // false
 *
 * @returns An object containing the `status` computed atom with a `reset`
 *   action
 */
export const withAsyncStatus =
  <
    State = never,
    InitState = State,
    Err = Error,
    Target extends AtomLike = AtomLike,
  >() =>
  (target: Target): { status: AsyncStatusAtom<State, InitState, Err> } => {
    // TODO support not AsyncExt targets
    const asyncTarget = target as Target & Partial<AsyncDataExt>

    const getDataValue = () => asyncTarget.data?.()

    const getErrorValue = () => asyncTarget.error?.()

    const getStatusError = (rejection?: unknown) =>
      getErrorValue() ??
      (rejection != null &&
      !isAbort(rejection) &&
      !(rejection instanceof Promise)
        ? toError(rejection)
        : undefined)

    const getMeta = () =>
      memoKey('meta', () => ({
        lastSettledStatus: null as null | 'fulfilled' | 'rejected',
        uniqueKey: {},
      }))

    const status = atom<AsyncStatus<State, InitState, Err>>(
      () =>
        (target as any).data
          ? {
              ...asyncStatusInitState,
              data: getDataValue(),
            }
          : asyncStatusInitState,
      `${target.name}.status`,
    ).extend(
      (target) => ({
        reset: action(
          () =>
            target.set(() => {
              let meta = getMeta()
              meta.lastSettledStatus = null
              meta.uniqueKey = {}

              return {
                ...asyncStatusInitState,
                data: getDataValue(),
              }
            }) as AsyncStatusNeverPending<State, InitState, Err>,
          `${target.name}.reset`,
        ),
      }),

      withComputed((state) => {
        let meta = getMeta()
        let { uniqueKey } = meta

        let promises = (
          isAction(target)
            ? getCalls(target).map((call) => call.payload)
            : [(target as Computed)()]
        ).filter((promise) => promise instanceof Promise)

        const targetFrame = _read(target)
        const cacheState = targetFrame && cacheVar.first(targetFrame)
        const isSWR = !!cacheState?.isSWR
        const promisesToTrack =
          cacheState?.isSWR && cacheState.promise
            ? [cacheState.promise]
            : cacheState
              ? []
              : promises

        promisesToTrack.forEach((promise) => {
          if (!isSWR) {
            state = {
              isPending: true,
              isFulfilled: false,
              isRejected: false,
              isSettled: false,

              isFirstPending: !state.isEverPending,
              isEverPending: true,
              isEverSettled: state.isEverSettled,

              isSWR: false,

              data: getDataValue(),
              error: getErrorValue(),
            } as AsyncStatus<State, InitState, Err>
          }

          promise.then(
            bind(() => {
              const wasReset = uniqueKey !== getMeta().uniqueKey
              if (wasReset) return

              meta.lastSettledStatus = 'fulfilled'

              status.set(() => {
                const pending = asyncTarget.pending?.() ?? 0
                const isPending = pending > 0
                return {
                  isPending,
                  isFulfilled: !isPending,
                  isRejected: false,
                  isSettled: !isPending,

                  isFirstPending: false,
                  isEverPending: true,
                  isEverSettled: true,

                  isSWR: false,

                  data: getDataValue(),
                  error: undefined,
                } as AsyncStatus<State, InitState, Err>
              })
            }),
            bind((error) => {
              const wasReset = uniqueKey !== getMeta().uniqueKey
              if (wasReset) return

              const pending = asyncTarget.pending?.() ?? 0
              const isPending = pending > 0
              const aborted = isAbort(error)

              const { lastSettledStatus } = meta

              if (!aborted) {
                meta.lastSettledStatus = 'rejected'
              }

              status.set((state) => {
                const currentData = getDataValue()

                if (!aborted) {
                  return {
                    isPending,
                    isFulfilled: false,
                    isRejected: !isPending,
                    isSettled: !isPending,

                    isFirstPending: false,
                    isEverPending: true,
                    isEverSettled: true,

                    isSWR: false,

                    data: currentData,
                    error: getStatusError(error),
                  } as AsyncStatus<State, InitState, Err>
                }

                if (state.isEverSettled && !isPending) {
                  return {
                    isPending,
                    isFulfilled: lastSettledStatus === 'fulfilled',
                    isRejected: lastSettledStatus === 'rejected',
                    isSettled: true,

                    isFirstPending: false,
                    isEverPending: true,
                    isEverSettled: true,

                    isSWR: false,

                    data: currentData,
                    error: getErrorValue(),
                  } as AsyncStatusAbortedSettle<State, InitState, Err>
                }

                return {
                  isPending,
                  isFulfilled: false,
                  isRejected: false,
                  isSettled: false,

                  isFirstPending: false,
                  isEverPending: true,
                  isEverSettled: state.isEverSettled,

                  isSWR: false,

                  data: currentData,
                  error: getErrorValue(),
                } as
                  | AsyncStatusAbortedPending<State, InitState, Err>
                  | AsyncStatusFirstAborted<State, InitState, Err>
                  | AsyncStatusAbortedPending<State, InitState, Err>
              })
            }),
          )
        })

        return isSWR
          ? {
              ...state,
              isSWR: true,
              data: getDataValue(),
              error: getErrorValue(),
            }
          : {
              ...state,
              isSWR: false,
              data: getDataValue(),
              error: getErrorValue(),
            }
      }),

      withMemo(),
    )

    target.extend(
      withMiddleware(
        () =>
          function withAsyncStatus(next, ...params) {
            let { state } = top()
            let newState = next(...params)

            if (!Object.is(state, newState)) {
              _enqueue(status, 'compute')
            }

            return newState
          },
      ),
    )

    return { status }
  }
