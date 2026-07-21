import {
  _createGlobal,
  type Action,
  type AtomLike,
  type AtomParams,
  type AtomState,
  bind,
  context,
  type Ext,
  type Frame,
  isAction,
  ReatomError,
  top,
  withActionMiddleware,
  withActions,
  withMiddleware,
} from '../core'
import { abortVar, ReatomAbortController } from '../methods/abortVar'
import { peek } from '../methods/peek'
import { retryComputed } from '../methods/retry'
import { variable } from '../methods/variable'
import type { WithPersistOptions } from '../persist'
import { type MapAtom, reatomMap } from '../primitives/reatomMap'
import { isDeepEqual, MAX_SAFE_TIMEOUT, noop, setTimeout } from '../utils'

export type AsyncAtom = AtomLike<any, any[], Promise<any>>

export interface CacheRecord<Target extends AtomLike = AtomLike> {
  clearTimeoutId: ReturnType<typeof setTimeout>
  isAsync?: boolean
  /**
   * It is more like **"lastRequest"**, which is expected for failed fetching,
   * we don't want to remove the cache, if we couldn't fetch new one.
   */
  lastUpdate: number
  params: AtomParams<Target>
  promise: undefined | ReturnType<Target>
  controller: AbortController
  value: undefined | Awaited<ReturnType<Target>>
  version: number
}

export interface CacheAtom<Target extends AtomLike = AtomLike> extends MapAtom<
  unknown,
  CacheRecord<Target>
> {
  /** Clear all records and call the effect with the last params. */
  invalidate: Action<[], null | ReturnType<Target>>
  setWithParams: Action<
    [params: AtomParams<Target>, value: Awaited<ReturnType<Target>>]
  >
  deleteWithParams: Action<[params: AtomParams<Target>]>
  options: WithCacheOptions
}

export type CacheMapRecord<Target extends AtomLike = AtomLike> =
  | undefined
  | CacheRecord<Target>

export type WithCacheOptions<Target extends AtomLike = AtomLike> = {
  /**
   * Define if the effect should be prevented from abort. The outer abort
   * strategy is not affected, which means that all hooks and returned promise
   * will behave the same. But the effect execution could be continued even if
   * abort appears, to save the result in the cache.
   *
   * @default true for empty params, false otherwise
   */
  ignoreAbort?: boolean

  /**
   * Define the behavior of `data()` atom from `withAsyncData`
   *
   * @default true for empty params, false otherwise
   */
  initData?: boolean

  /**
   * Maximum amount of cache records.
   *
   * @default 5
   */
  length?: number

  /**
   * The number of excepted parameters, which will used as a cache key.
   *
   * @default undefined (all)
   */
  paramsLength?: number

  /**
   * The amount of milliseconds after which a cache record cleanups.
   *
   * @default 5 * 60 * 1000 ms (5 minutes)
   */
  staleTime?: number

  /**
   * (stale while revalidate) Define if fetching should be triggered even if the
   * cache is exists. A boolean value applies to all options
   *
   * @default false
   */
  swr?:
    | boolean
    | {
        /**
         * Success revalidation should trigger `onFulfill` to notify about the
         * fresh data
         *
         * @default true
         */
        shouldFulfill?: boolean

        /**
         * Error revalidation trigger `onReject` to notify about the error
         *
         * @default false
         */
        shouldReject?: boolean
      }

  /** Persist adapter, which will used with predefined optimal parameters */
  withPersist?: (
    options: WithPersistOptions<Map<unknown, CacheRecord<Target>>>,
  ) => Ext<CacheAtom<Target>>
} & (
  | {
      /**
       * Convert params to stable string and use as a map key. Alternative to
       * `isEqual`. Disabled by default.
       */
      paramsToKey?: (params: AtomParams<Target>) => string
    }
  | {
      /**
       * Check the equality of a cache record and passed params to find the
       * cache. Alternative to `paramsToKey`.
       *
       * @default `isDeepEqual` from @reatom/utils
       */
      isEqual?: (prev: AtomParams<Target>, next: AtomParams<Target>) => boolean
    }
)

type Find<Target extends AtomLike> = (
  params: AtomParams<Target>,
  state?: AtomState<CacheAtom<Target>>,
) => { cached?: CacheMapRecord<Target>; key: unknown }

const NOOP_TIMEOUT_ID = -1 as unknown as ReturnType<typeof setTimeout>

const isPromise = <Value>(value: unknown): value is Promise<Value> =>
  value instanceof Promise

export interface CacheVarState {
  isCached: boolean
  isSWR: boolean
  payload?: { value: unknown }
  promise?: Promise<unknown>
}

type CacheVarRecord = Pick<CacheRecord, 'value' | 'version'> | undefined

export const cacheVar = _createGlobal('cacheVar', () =>
  variable(
    (
      cached?: CacheVarRecord,
      isSWR = false,
      promise?: Promise<unknown>,
    ): CacheVarState => ({
      isCached: true,
      isSWR,
      payload:
        cached && cached.version > 0 ? { value: cached.value } : undefined,
      promise,
    }),
    'cache',
  ),
)

export let withCache =
  <
    Target extends AtomLike & {
      // TODO
      // dataAtom?: AsyncDataAtom
      cacheAtom?: CacheAtom<Target>
    },
  >({
    ignoreAbort: ignoreAbortOption,
    initData: _initData = true,
    length = 5,
    paramsLength,
    staleTime = 5 * 60 * 1000,
    swr: swrOptions,
    withPersist,
    // @ts-expect-error
    paramsToKey,
    // @ts-expect-error
    isEqual = isDeepEqual,
  }: WithCacheOptions<Target> = {}): Ext<
    Target,
    {
      cacheAtom: CacheAtom<Target>
    }
  > =>
  (target) => {
    if ('cacheAtom' in target) {
      throw new ReatomError('cacheAtom already attached to the target')
    }

    type ThisParams = AtomParams<Target>
    type ThisCacheAtom = CacheAtom<Target>
    type ThisCacheRecord = CacheRecord<Target>
    type Value = Awaited<ReturnType<Target>>

    const getShouldSWR = (params: ThisParams) =>
      swrOptions === undefined ? params.length === 0 : !!swrOptions

    const getShouldIgnoreAbort = (params: ThisParams) =>
      ignoreAbortOption ?? (params.length === 0 || getShouldSWR(params))

    if (staleTime !== Infinity) {
      staleTime = Math.min(MAX_SAFE_TIMEOUT, staleTime)
    }

    const find: Find<Target> = paramsToKey
      ? (params, cache = peek(cacheAtom)) => {
          const key = paramsToKey(params)
          return { cached: cache.get(key), key }
        }
      : (params, cache = peek(cacheAtom)) => {
          for (const [key, cached] of cache) {
            if (isEqual(key, params)) return { cached, key }
          }
          return { cached: undefined, key: params }
        }

    const findLatestWithValue = (cache = peek(cacheAtom)) => {
      for (const cached of cache.values()) {
        if (
          cached.version > 0 &&
          (!latestCached || cached.lastUpdate > latestCached.lastUpdate)
        ) {
          var latestCached: undefined | ThisCacheRecord = cached
        }
      }
      return latestCached
    }

    const deleteOldest = (cache: Map<unknown, ThisCacheRecord>) => {
      for (const [key, cached] of cache) {
        if (!oldestCached || oldestCached.lastUpdate > cached.lastUpdate) {
          var oldestKey = key
          var oldestCached: undefined | ThisCacheRecord = cached
        }
      }
      // it is ok to mutate the cache,
      // as it was just created from the set method
      // and wasn't touched by anything.
      if (oldestCached) cache.delete(oldestKey)
    }

    const planCleanup = (key: unknown, time = staleTime) => {
      const clearTimeoutId =
        staleTime === Infinity
          ? NOOP_TIMEOUT_ID
          : setTimeout(
              bind(() => {
                // FIXME for NOOP_TIMEOUT_ID there could be collision,
                // need to compare cache records references
                if (cacheAtom().get(key)?.clearTimeoutId === clearTimeoutId) {
                  cacheAtom.delete(key)
                }
              }),
              time,
            )

      // @ts-expect-error browser / node compatibility
      clearTimeoutId.unref?.()

      return clearTimeoutId
    }

    const toCacheParams = (params: ReadonlyArray<unknown>): ThisParams =>
      (paramsLength === undefined
        ? params
        : params.slice(0, paramsLength)) as ThisParams

    const getReactiveParams = (frame: Frame): ThisParams => {
      const params: Array<unknown> = []

      for (const pub of frame.pubs) {
        if (pub !== null && pub.atom !== context) params.push(pub.state)
      }

      return toCacheParams(params)
    }

    const getCachedResult = (
      cached: undefined | ThisCacheRecord,
    ): undefined | { result: ReturnType<Target> } => {
      if (!cached) return undefined
      if (cached.promise) {
        if (
          !getShouldIgnoreAbort(cached.params) &&
          (cached.controller.signal.aborted ||
            cached.controller !== abortVar.get())
        ) {
          return undefined
        }
        return { result: cached.promise }
      }
      if (cached.version > 0) {
        return {
          result: ((cached.isAsync ?? hasOnFulfill(target))
            ? Promise.resolve(cached.value)
            : cached.value) as ReturnType<Target>,
        }
      }
      return undefined
    }

    const getCacheController = () =>
      abortVar.get() ??
      abortVar.set(new ReatomAbortController(`${target.name}.withCache`))

    const hasOnFulfill = (
      target: Target,
    ): target is Target & {
      onFulfill: Action<[payload: Value, params: ThisParams], unknown>
    } => 'onFulfill' in target && typeof target.onFulfill === 'function'

    const watchCachePromise = (key: unknown, record: ThisCacheRecord) => {
      const promise = record.promise
      if (!isPromise<Value>(promise)) return

      promise.then(
        bind((value) => {
          if (cacheAtom().get(key) !== record) return

          if (
            !getShouldIgnoreAbort(record.params) &&
            record.controller.signal.aborted
          ) {
            if (record.version > 0) {
              cacheAtom.set(key, { ...record, promise: undefined })
            } else {
              cacheAtom.delete(key)
            }
            return
          }

          cacheAtom.set(key, {
            ...record,
            promise: undefined,
            value,
            version: record.version + 1,
          })
        }),
        bind(() => {
          if (cacheAtom().get(key) !== record) return

          if (record.version > 0) {
            cacheAtom.set(key, {
              ...record,
              promise: undefined,
            })
          } else {
            cacheAtom.delete(key)
          }
        }),
      )
    }

    const setPending = (
      key: unknown,
      cached: undefined | ThisCacheRecord,
      params: ThisParams,
      payload: ReturnType<Target>,
      controller: AbortController,
    ) => {
      if (cached) clearTimeout(cached.clearTimeoutId)

      const isAsync = isPromise<Value>(payload)
      const record: ThisCacheRecord = {
        clearTimeoutId: planCleanup(key),
        isAsync,
        promise: isAsync ? payload : undefined,
        value: isAsync ? cached?.value : (payload as Value),
        version: isAsync ? (cached?.version ?? 0) : (cached?.version ?? 0) + 1,
        controller,
        lastUpdate: Date.now(),
        params,
      }

      const cache = cacheAtom.set(key, record)
      if (cache.size > length) deleteOldest(cache)

      if (isAsync) watchCachePromise(key, record)

      return record
    }

    const setSWRPending = (
      key: unknown,
      cached: undefined | ThisCacheRecord,
      params: ThisParams,
      payload: ReturnType<Target>,
      controller: AbortController,
    ) => abortVar.spawn(setPending, key, cached, params, payload, controller)

    const cacheAtom = (target.cacheAtom = reatomMap(
      [],
      `${target.name}._cacheAtom`,
    )
      .extend(
        withActions(() => ({
          setWithParams: (params: ThisParams, value: Value) => {
            params = toCacheParams(params)
            const { cached, key } = find(params)

            if (cached) clearTimeout(cached.clearTimeoutId)

            cacheAtom.set(key, {
              clearTimeoutId: planCleanup(key),
              isAsync: cached?.isAsync ?? hasOnFulfill(target),
              promise: undefined,
              value,
              version: cached ? cached.version + 1 : 1,
              controller: new AbortController(),
              lastUpdate: Date.now(),
              params,
            })

            // TODO ?
            // cached?.controller.abort()
          },

          deleteWithParams: (params: ThisParams) => {
            const { cached, key } = find(toCacheParams(params))
            if (cached) cacheAtom.delete(key)
          },

          invalidate: (): null | ReturnType<Target> => {
            if (target.__reatom.reactive) {
              cacheAtom.clear()
              return retryComputed(target) as ReturnType<Target>
            }

            const latest = findLatestWithValue()
            cacheAtom.clear()

            return latest
              ? (target(...latest.params) as ReturnType<Target>)
              : null
          },
        })),
      )
      .extend(() => ({
        // TODO is it really needed?
        options: {
          ignoreAbort: ignoreAbortOption,
          length,
          paramsLength,
          staleTime,
          swr: swrOptions ?? false,
          withPersist,
        },
      })) as ThisCacheAtom)

    if (withPersist) {
      // TODO the key could be provided by a decorator function
      // like `withPersist: options => withLocalStorage({ ...options, key: 'key' })`
      // how to check it??
      // throwReatomError(
      //   anAsync.__reatom.name!.includes('#'),
      //   'the async name is not unique',
      // )

      cacheAtom.extend(
        withPersist({
          key: cacheAtom.name,
          fromSnapshot: (
            snapshot: Array<[unknown, ThisCacheRecord]>,
            state = new Map(),
          ) => {
            if (
              snapshot.length <= state?.size &&
              snapshot.every(([, { params, value }]) => {
                const { cached } = find(params, state)
                return !!cached && isDeepEqual(cached.value, value)
              })
            ) {
              return state
            }

            const newState = new Map(snapshot)

            for (const [key, rec] of newState) {
              const restStaleTime = staleTime - (Date.now() - rec.lastUpdate)
              if (restStaleTime <= 0) {
                newState.delete(key)
              } else {
                clearTimeout(rec.clearTimeoutId)
                rec.clearTimeoutId = planCleanup(
                  key,
                  staleTime - (Date.now() - rec.lastUpdate),
                )
              }
            }

            for (const [key, rec] of state) {
              if (rec.promise) {
                const { cached } = find(rec.params, newState)
                if (cached) {
                  cached.promise = rec.promise
                } else {
                  // TODO need a control from the user side,
                  // add an option for this?
                  newState.set(key, rec)
                }
              }
            }

            return newState
          },
          // TODO support Infinity as `null`?
          time: Math.min(staleTime, MAX_SAFE_TIMEOUT),
          toSnapshot: (cache) => [...cache].filter(([, rec]) => !rec.promise),
        }),
      )
    }

    if (isAction(target)) {
      target.extend(
        withActionMiddleware(
          () =>
            function withCacheAction(next, ...params) {
              const cacheParams = toCacheParams(params)
              const shouldSWR = getShouldSWR(cacheParams)
              const { cached, key } = find(cacheParams)

              const cachedResult = getCachedResult(cached)
              if (cached?.promise && cachedResult) {
                cacheVar.set()
                return cachedResult.result
              }

              if (cachedResult && !shouldSWR) {
                cacheVar.set(cached)
                return cachedResult.result
              }

              const promise = next(...params)
              const controller = abortVar.get() ?? getCacheController()
              setPending(key, cached, cacheParams, promise, controller)

              if (cachedResult) {
                cacheVar.set(
                  cached,
                  true,
                  isPromise(promise) ? promise : undefined,
                )
              }

              return promise
            },
        ),
      )
      return { cacheAtom }
    }

    target.extend(
      withMiddleware(
        () => (next) => {
          const frame = top()
          const initialController = getCacheController()
          const payload = next() as ReturnType<Target>
          const controller = abortVar.get() ?? initialController
          const params = getReactiveParams(frame)
          const shouldSWR = getShouldSWR(params)
          const { cached, key } = find(params)
          const cachedResult = getCachedResult(cached)

          if (cachedResult) {
            if (shouldSWR && !cached?.promise) {
              setSWRPending(key, cached, params, payload, controller)
            } else {
              if (isPromise(payload)) payload.catch(noop)
              controller.abort('cache')
              abortVar.set()
            }

            cacheVar.set(
              cached,
              shouldSWR && !cached?.promise,
              shouldSWR && !cached?.promise && isPromise(payload)
                ? payload
                : undefined,
            )
            return cachedResult.result
          }

          setPending(key, cached, params, payload, controller)
          return payload
        },
        'computed',
      ),
    )
    return { cacheAtom }
  }
