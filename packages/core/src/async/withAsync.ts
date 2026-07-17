import type { Action, Atom, AtomLike, Computed } from '../core'
import {
  _createGlobal,
  _read,
  action,
  atom,
  bind,
  computed,
  context,
  createAtom,
  ReatomError,
  top,
  withMiddleware,
} from '../core'
import { cacheVar } from '../extensions/withCache'
import { abortVar, getCalls, ifChanged, reset, retryComputed } from '../methods'
import type { Fn } from '../utils'
import { isAbort } from '../utils'
import { type AsyncStatusAtom, withAsyncStatus } from './withAsyncStatus'

let defaultStatus = _createGlobal(
  'withAsync_defaultStatus',
  () =>
    computed(() => {
      throw new ReatomError(
        'status is turned off by default, you need to activate it explicitly in options',
      )
    }, 'defaultStatus').extend((target) => ({
      reset: action(() => target(), `${target.name}.reset`),
    })) as AsyncStatusAtom,
)

/**
 * Extension interface added by {@link withAsync} to atoms or actions that return
 * promises. Provides utilities for tracking async state, handling errors, and
 * responding to async events.
 *
 * @template Params - The parameter types of the original atom or action
 * @template Payload - The resolved value type of the promise
 * @template Error - The type of errors that can be caught
 */
export interface AsyncExt<
  Params extends any[] = any[],
  Payload = any,
  Error = any,
> {
  /**
   * Computed atom that indicates when no async operations are pending
   *
   * @returns Boolean indicating if all operations have completed (true) or some
   *   are still pending (false)
   */
  ready: Computed<boolean>

  /**
   * Action that is called when the promise resolves successfully
   *
   * @param payload - The resolved value from the promise
   * @param params - The original parameters passed to the atom/action
   * @returns An object containing the payload and parameters
   */
  onFulfill: Action<
    [payload: Payload, params: Params],
    { payload: Payload; params: Params }
  >

  /**
   * Action that is called when the promise rejects with an error
   *
   * @param error - The error thrown by the promise
   * @param params - The original parameters passed to the atom/action
   * @returns An object containing the error and parameters
   */
  onReject: Action<
    [error: Error, params: Params],
    { error: Error; params: Params }
  >

  /**
   * Action called after either successful resolution or rejection
   *
   * @param result - Either a payload+params object or an error+params object
   * @returns The same result object that was passed in
   */
  onSettle: Action<
    [{ payload: Payload; params: Params } | { error: Error; params: Params }],
    { payload: Payload; params: Params } | { error: Error; params: Params }
  >

  /**
   * Computed atom tracking how many async operations are currently pending
   *
   * @returns Number of pending operations (0 when none are pending)
   */
  pending: Computed<number>

  /** Atom containing the most recent error or undefined if no error has occurred */
  error: Atom<undefined | Error>

  /**
   * Atom that tracks the current status of async operations including lifecycle
   * state, timing information, and retry functionality. Must be explicitly
   * enabled via the `status` option in {@link withAsync} configuration.
   *
   * @throws {ReatomError} When accessed without being enabled in options
   */
  status: AsyncStatusAtom<any, any, Error>

  /**
   * Atom that caches the last called parameters for retry functionality. Must
   * be explicitly enabled via the `cacheParams` option in {@link withAsync}
   * configuration.
   *
   * @returns The cached parameters from the last async operation
   * @throws {ReatomError} When accessed without being enabled in options
   */
  params: Atom<null | Params>

  /**
   * Action that retries the last async operation.
   *
   * - If the target is an atom: re-evaluates the computed atom
   * - If the target is an action: calls it with the cached params
   *
   * @returns The promise from the retried async operation
   * @throws {ReatomError} When called on an action without enabling
   *   `cacheParams`
   */
  retry: Action<[], Promise<Payload>>
}

/**
 * Configuration options for the {@link withAsync} extension
 *
 * @template Err - The type of errors after parsing
 * @template EmptyErr - The type of the empty error state (default: undefined)
 */
export type AsyncOptions<Err = Error, EmptyErr = undefined> = {
  /**
   * Function to transform raw errors into a specific error type
   *
   * @param error - The caught error of unknown type
   * @returns A properly typed error object
   */
  parseError?: (error: unknown) => Err

  /** Initial/reset value for the error atom */
  emptyError?: EmptyErr

  /**
   * When to reset the error state
   *
   * - 'onCall': Reset error when the async operation starts (default)
   * - 'onFulfill': Reset error only when the operation succeeds
   * - Null: Never automatically reset errors
   *
   * @default 'onCall'
   */
  resetError?: null | 'onCall' | 'onFulfill'

  /**
   * Whether to enable the `status` atom for detailed async operation tracking.
   * When enabled, provides access to lifecycle state, timing information, and
   * retry functionality through the `status` property.
   *
   * @default false
   */
  status?: boolean

  /**
   * Whether to enable caching of the last called parameters for the retry
   * functionality. When enabled, the `params` atom and `retry` action will be
   * available for actions. For atoms (computeds), retry works without this
   * option as they can be re-evaluated directly.
   *
   * @default false
   */
  cacheParams?: boolean
}

/**
 * Extension that adds async state tracking to atoms or actions that return
 * promises. Manages pending state, errors, and provides lifecycle actions for
 * async operations.
 *
 * This extension preserves Reatom context across async operations, ensuring
 * that the async operation's results properly update Reatom state.
 *
 * @example
 *   // Basic usage with an action:
 *   const fetchUser = action(async (userId: string) => {
 *     const response = await wrap(fetch(`/api/users/${userId}`))
 *     return await wrap(response.json())
 *   }, 'fetchUser').extend(withAsync())
 *
 *   // Can then access:
 *   fetchUser.error() // → latest error if any
 *   fetchUser.ready() // → are all operations complete?
 *
 * @template Err - The type of errors after parsing
 * @template EmptyErr - The type of the empty error state
 * @param options - Configuration options for error handling
 * @returns An extension function that can be applied to atoms or actions
 */
export let withAsync: {
  <Err = Error, EmptyErr = undefined>(
    options?: null | AsyncOptions<Err, EmptyErr>,
  ): <T extends AtomLike>(
    target: T,
  ) => T extends AtomLike<any, infer Params, Promise<infer Payload>>
    ? T & AsyncExt<Params, Payload, Err | EmptyErr>
    : never
} =
  <Err = Error, EmptyErr = undefined>(
    options?: null | AsyncOptions<Err, EmptyErr>,
  ) =>
  (target: AtomLike): any => {
    if ('cacheAtom' in target) {
      throw new ReatomError(
        'can not attach withAsync after withCache, you need to reorder them',
      )
    }

    let {
      parseError = (e: any) => (e instanceof Error ? e : new Error(String(e))),
      emptyError,
      resetError = 'onCall',
      status = false,
      cacheParams = false,
    } = options ?? {}

    let onFulfill: AsyncExt['onFulfill'] = action((payload, params) => {
      if (resetError === 'onFulfill') error.set(emptyError)
      return onSettle({ payload, params }) as any // TODO
    }, `${target.name}.onFulfill`)
    let onReject: AsyncExt['onReject'] = action((err, params) => {
      if (!isAbort(err)) {
        error.set((err = parseError(err)))
      }
      return onSettle({ error: err, params }) as any // TODO
    }, `${target.name}.onReject`)
    let onSettle: AsyncExt['onSettle'] = action((call) => {
      pending.set((state) => state - 1)
      return call
    }, `${target.name}._onSettle`)

    let pending = createAtom(
      {
        // computed needed to ensure that `pending` (and `ready`) connection will connect the target
        // which is especially important for an atom target
        computed(state = 0) {
          if (target.__reatom.reactive) {
            ifChanged(target, () => {
              const targetFrame = _read(target)
              const cacheState = targetFrame && cacheVar.first(targetFrame)
              if (!cacheState) state++
            })
          } else {
            const calls = getCalls(target as Action)
            const targetFrame = _read(target)
            const cacheState = targetFrame && cacheVar.first(targetFrame)
            if (calls.length !== 0 && !cacheState) {
              state += calls.length
            }
          }
          return state
        },
      },
      `${target.name}._pending`,
    )

    let error = createAtom(
      {
        initState: emptyError as any,
        computed: target.__reatom.reactive
          ? (state) => {
              target()
              return state
            }
          : undefined,
      },
      `${target.name}._error`,
    )

    let ready = computed(() => pending() === 0, `${target.name}.ready`)

    let paramsAtom = atom<null | any[]>(() => {
      if (!cacheParams) {
        throw new ReatomError(
          'You should enable params caching in the options to use retry.',
        )
      }
      return null
    }, `${target.name}._params`)

    // Retry action
    let retry: AsyncExt['retry'] = action(() => {
      if (target.__reatom.reactive) {
        // For atoms (computeds), just re-evaluate by resetting dependencies
        reset(target)
        return target() as Promise<any>
      } else {
        const lastParams = paramsAtom()
        if (!lastParams) {
          throw new ReatomError('Nothing to retry, params is empty')
        }
        return target(...lastParams)
      }
    }, `${target.name}.retry`)

    let touched = new WeakSet<Promise<any>>()

    let asyncMiddleware = (next: Fn, ...params: any[]) => {
      // Cache params if enabled
      if (cacheParams) {
        paramsAtom.set(params)
      }

      // TODO should throw abort if the cause it rollback?
      let state = next(...params)
      let promise = state

      let frame = top()

      if (target.__reatom.reactive) {
        for (let pub of frame.pubs) {
          if (pub !== null && pub.atom !== context) params.push(pub.state)
        }
      } else {
        promise = state.at(-1)?.payload
      }

      if (!(promise instanceof Promise)) {
        throw new ReatomError('promise expected')
      }

      const cacheState = cacheVar.first()
      const isCacheHit = cacheState !== undefined
      const promiseToTrack = cacheState?.isSWR
        ? cacheState.promise
        : isCacheHit
          ? undefined
          : promise
      const isPromiseFresh =
        promiseToTrack !== undefined && !touched.has(promiseToTrack)

      if (isCacheHit) touched.add(promise)

      if (cacheState?.payload) {
        pending.set((state) => state + 1)
        onFulfill(cacheState.payload.value, params)
      }

      if (isPromiseFresh) {
        touched.add(promiseToTrack)
        promiseToTrack.then(
          bind((payload) => {
            if (cacheState) pending.set((state) => state + 1)
            abortVar.spawn(onFulfill, payload, params)
          }, frame),
          bind((error) => {
            if (cacheState) pending.set((state) => state + 1)
            if (isAbort(error)) {
              abortVar.spawn(onSettle, { error, params })
            } else {
              abortVar.spawn(onReject, error, params)
            }
          }, frame),
        )
      }

      if (!isCacheHit && isPromiseFresh && !pending.__reatom.processing) {
        retryComputed(pending)
      }

      if (!target.__reatom.reactive) {
        state.at(-1)!.payload = promise
      }

      if (!isCacheHit && isPromiseFresh && resetError === 'onCall') {
        error.set(emptyError)
      }

      return state
    }

    return target.extend(
      withMiddleware(() => asyncMiddleware),
      () => ({
        ready,
        onFulfill,
        onReject,
        onSettle,
        pending,
        error,
        params: paramsAtom,
        retry,
      }),
      status ? withAsyncStatus() : () => ({ status: defaultStatus }),
    ) satisfies AtomLike & AsyncExt
  }
