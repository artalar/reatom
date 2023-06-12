import {
  Action,
  action,
  ActionParams,
  ActionPayload,
  AtomMut,
  AtomState,
  Ctx,
  Fn,
  throwReatomError,
} from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { MapAtom, reatomMap } from '@reatom/primitives'
import { isDeepEqual, merge } from '@reatom/utils'
import { type WithPersistOptions } from '@reatom/persist'

import {
  __handleEffect,
  AsyncAction,
  AsyncCtx,
  AsyncResp,
  ControlledPromise,
} from '.'
import { createAbortController } from './createAbortController'

export interface CacheRecord<T = any, Params extends any[] = unknown[]> {
  clearTimeoutId: ReturnType<typeof setTimeout>
  lastUpdate: number
  params: Params
  promise?: ControlledPromise<T>
  value?: T
}

export interface CacheAtom<T = any, Params extends any[] = unknown[]>
  extends MapAtom<unknown, CacheRecord<T, Params>> {
  /** Clear all records and call the effect with the last params. */
  invalidate: Action<[] /* Promise<AsyncResp<T>> */>
}

type CacheMapRecord<T extends AsyncAction> =
  | undefined
  | CacheRecord<AsyncResp<T>, ActionParams<T>>

export type WithCacheOptions<T extends AsyncAction> = {
  /** Maximum amount of cache records.
   * @default 5
   */
  length?: number

  /** The amount of milliseconds after which a cache record cleanups.
   * @default 5 * 60 * 1000 ms (5 minutes)
   */
  staleTime?: number

  /** The number of excepted parameters, which will used as a cache key.
   * @default undefined (all)
   */
  paramsLength?: number

  /** Define if the effect should be prevented from abort.
   * The outer abort strategy is not affected, which means that all hooks and returned promise will behave the same.
   * But the effect execution could be continued even if abort appears, to save the result in the cache.
   * @default true
   */
  ignoreAbort?: boolean

  /** (stale while revalidate) Define if fetching should be triggered even if the cache is exists.
   * A boolean value applies to all options
   * @default true
   */
  swr?:
    | boolean
    | {
        /** success revalidation should trigger `onFulfill` to notify about the fresh data
         * @default true
         */
        shouldFulfill?: boolean
        /** error revalidation trigger `onReject` to notify about the error
         * @default true
         */
        shouldReject?: boolean
      }

  // TODO
  // staleByDataAtom?: boolean = false

  /** Persist adapter, which will used with predefined optimal parameters */
  withPersist?: (
    options: WithPersistOptions<
      AtomState<CacheAtom<AsyncResp<T>, ActionParams<T>>>
    >,
  ) => (
    anAsync: CacheAtom<AsyncResp<T>, ActionParams<T>>,
  ) => CacheAtom<AsyncResp<T>, ActionParams<T>>
} & (
  | {
      /** Convert params to stable string and use as a map key.
       * Alternative to `isEqual`.
       * Disabled by default.
       */
      paramsToKey?: (ctx: Ctx, params: ActionParams<T>) => string
    }
  | {
      /** Check the equality of a cache record and passed params to find the cache.
       * Alternative to `paramsToKey`.
       * @default `isDeepEqual` from @reatom/utils
       */
      isEqual?: (
        ctx: Ctx,
        prev: ActionParams<T>,
        next: ActionParams<T>,
      ) => boolean
    }
)

type Find<T extends AsyncAction> = Fn<
  [
    ctx: Ctx,
    params: ActionParams<T>,
    state?: AtomState<CacheAtom<AsyncResp<T>, ActionParams<T>>>,
  ],
  { cached?: CacheMapRecord<T>; key: unknown }
>

export const withCache =
  <
    T extends AsyncAction & {
      dataAtom?: AtomMut
      cacheAtom?: CacheAtom<AsyncResp<T>, ActionParams<T>>
    },
  >({
    staleTime = 5 * 60 * 1000,
    length = 5,
    paramsLength,
    ignoreAbort = true,
    swr: swrOptions = true,
    withPersist,
    // @ts-expect-error
    paramsToKey,
    // @ts-expect-error
    isEqual = (ctx: Ctx, a: any, b: any) => isDeepEqual(a, b),
  }: WithCacheOptions<T> = {}): Fn<
    [T],
    T & {
      cacheAtom: CacheAtom<AsyncResp<T>, ActionParams<T>>
    }
  > =>
  // @ts-ignore
  (anAsync) => {
    if (!anAsync.cacheAtom) {
      type ThisParams = ActionParams<T>
      type ThisCacheAtom = CacheAtom<AsyncResp<T>, ThisParams>
      type ThisCacheRecord = CacheRecord<AsyncResp<T>, ThisParams>

      const swr = !!swrOptions
      const shouldFulfill = (swrOptions as any).shouldFulfill ?? swr
      const shouldReject = (swrOptions as any).shouldReject ?? swr

      const find: Find<T> = paramsToKey
        ? (ctx, params, state = ctx.get(cacheAtom)) => {
            const key = paramsToKey(ctx, params)
            return { cached: state.get(key), key }
          }
        : (ctx, params, state = ctx.get(cacheAtom)) => {
            for (const [key, cached] of state) {
              if (isEqual(ctx, key, params)) return { cached, key }
            }
            return { cached: undefined, key: params }
          }

      // TODO unify `findLatest` and `findOldest`
      const findLatest = (ctx: Ctx, state = ctx.get(cacheAtom)) => {
        for (const cached of state.values()) {
          if (
            !cached.promise &&
            (!latestCached || cached.lastUpdate > latestCached.lastUpdate)
          ) {
            var latestCached: undefined | ThisCacheRecord = cached
          }
        }
        return latestCached
      }
      const findOldest = (ctx: Ctx, state = ctx.get(cacheAtom)) => {
        for (const cached of state.values()) {
          if (
            !cached.promise &&
            (!oldestCached || cached.lastUpdate < oldestCached.lastUpdate)
          ) {
            var oldestCached: undefined | ThisCacheRecord = cached
          }
        }
        return oldestCached
      }

      const planCleanup = (ctx: Ctx, params: ThisParams, time = staleTime) => {
        const clearTimeoutId = setTimeout(() => {
          const { cached, key } = find(ctx, params)

          if (cached?.clearTimeoutId === clearTimeoutId) {
            cacheAtom.delete(ctx, key)
          }
        }, time)

        clearTimeoutId.unref?.()
        ctx.schedule(() => clearTimeout(clearTimeoutId), -1)

        return clearTimeoutId
      }

      const cacheAtom = (anAsync.cacheAtom = reatomMap(
        new Map(),
        `${anAsync.__reatom.name}._cacheAtom`,
      ) as ThisCacheAtom)

      cacheAtom.invalidate = action((ctx) => {
        const latest = findLatest(ctx)

        cacheAtom.clear(ctx)

        if (latest) anAsync(ctx, ...latest.params)
      }, `${cacheAtom.__reatom.name}.invalidate`)

      if (withPersist) {
        throwReatomError(
          anAsync.__reatom.name!.startsWith('async#'),
          'the async name is not unique',
        )

        cacheAtom.pipe(
          withPersist({
            key: cacheAtom.__reatom.name!,
            // @ts-expect-error snapshot unknown type
            fromSnapshot: (
              ctx,
              snapshot: Array<[unknown, ThisCacheRecord]>,
              state = new Map(),
            ) => {
              if (
                snapshot.length === state?.size &&
                snapshot.every(([, { params, value }]) => {
                  const { cached } = find(ctx, params, state)
                  return !!cached && isDeepEqual(cached.value, value)
                })
              ) {
                return state
              }

              const newState = new Map(snapshot)

              for (const rec of newState.values()) {
                rec.clearTimeoutId = planCleanup(
                  ctx,
                  rec.params,
                  staleTime - (Date.now() - rec.lastUpdate),
                )
              }

              return newState
            },
            time: staleTime,
            toSnapshot: (ctx, cache) =>
              [...cache].filter(([, rec]) => !rec.promise),
          }),
        )
      }

      // TODO the cache will not saved if the previous cache was cleared by a timeout
      const handlePromise = (ctx: Ctx, key: any, cached: ThisCacheRecord) => {
        const promise = cached.promise!

        cacheAtom.set(ctx, key, cached)

        __thenReatomed(
          ctx,
          promise,
          (value) => {
            if (!cacheAtom.has(ctx, key)) return

            const clearTimeoutId = planCleanup(ctx, key)

            const cache = cacheAtom.set(ctx, key, {
              clearTimeoutId,
              lastUpdate: Date.now(),
              params: cached.params,
              promise: undefined,
              value,
            })

            if (cache.size > length) {
              const oldest = findOldest(ctx)
              if (oldest) {
                cacheAtom.delete(ctx, find(ctx, oldest.params).key)
              }
            }
          },
          (error) => {
            const rec = cacheAtom.get(ctx, key)
            if (rec) {
              if (rec.lastUpdate === 0) {
                cacheAtom.set(ctx, key, merge(rec, { promise: undefined }))
              } else {
                cacheAtom.delete(ctx, key)
              }
            }
          },
        )
      }

      const handleCache = action(
        (ctx, params: [AsyncCtx, ...ThisParams]): ControlledPromise => {
          const targetEffect: Fn<[AsyncCtx, ...ThisParams], ActionPayload<T>> =
            // @ts-expect-error could be reassigned by the testing package
            anAsync.__reatom.unstable_fn

          const [asyncCtx] = params

          const paramsKey = params.slice(
            1,
            paramsLength ?? params.length,
          ) as ThisParams

          const { cached, key } = find(ctx, paramsKey)

          if (!cached) {
            const promise = __handleEffect(asyncCtx, anAsync, () =>
              targetEffect(...params),
            )

            handlePromise(ctx, key, {
              clearTimeoutId: 0 as any,
              lastUpdate: 0,
              params: paramsKey,
              // @ts-ignore
              promise,
              value: undefined,
            })

            return promise
          }

          if (cached.lastUpdate > 0) anAsync.onFulfill(ctx, cached.value)

          if (!swr) {
            return (
              cached.promise ??
              Object.assign(
                __thenReatomed(ctx, Promise.resolve(cached.value)),
                {
                  controller: asyncCtx.controller,
                },
              )
            )
          }

          const swrPromise = Object.assign(
            __thenReatomed(
              ctx,
              ctx.schedule(() => targetEffect(...params)),
              (value) => {
                if (shouldFulfill) anAsync.onFulfill(ctx, value)
              },
              (error) => {
                if (shouldReject) anAsync.onReject(ctx, error)
              },
            ),
            {
              controller: asyncCtx.controller,
            },
          )
          handlePromise(ctx, key, merge(cached, { promise: swrPromise }))

          // TODO: `if (cached.lastUpdate === 0)`

          return swrPromise
        },
        `${anAsync.__reatom.name}._handleCache`,
      )

      anAsync.__cacheDecorator = (...params) => {
        if (ignoreAbort) {
          const controller = createAbortController()
          params[0] = merge(params[0], {
            controller,
            cause: merge(params[0].cause, { controller }),
          })
        }

        return handleCache(params[0], params as [AsyncCtx, ...ThisParams])
      }

      if ('dataAtom' in anAsync) {
        const { initState } = anAsync.dataAtom!.__reatom
        anAsync.dataAtom!.__reatom.initState = (ctx) =>
          findLatest(ctx)?.value ?? initState(ctx)
      }
    }

    return anAsync
  }
