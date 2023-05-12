import {
  Action,
  action,
  ActionParams,
  ActionPayload,
  Atom,
  Ctx,
} from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { onConnect, onUpdate } from '@reatom/hooks'
import { MapAtom, reatomMap } from '@reatom/primitives'
import { assign, isDeepEqual } from '@reatom/utils'
import { type WithPersist } from '@reatom/persist'

import { CACHE } from './cache'
import { AsyncAction } from '.'

export interface CacheRecord<T = any> {
  clearTimeoutId: ReturnType<typeof setTimeout>
  lastUpdate: number
  params: Array<unknown>
  promise: null | Promise<T>
  value: T
}

export interface CacheAtom<T = any> extends MapAtom<unknown, CacheRecord<T>> {
  invalidate: Action<[] /* Promise<ActionPayload<T['onFulfill']>> */>
}

type CacheMapRecord<T extends AsyncAction> =
  | undefined
  | CacheRecord<ActionPayload<T['onFulfill']>>

export type WithCacheOptions<T extends AsyncAction> = {
  /** Maximum amount of cache records
   * @default 5
   */
  length?: number
  /** The amount of milliseconds after which a cache record cleanups
   * @default 5 * 60 * 1000 ms (5 minutes)
   */
  staleTime?: number
  /** The number of excepted parameters, which will used as a cache key
   * @default undefined (all)
   */
  paramsLength?: number

  /** (stale while revalidate) Define if fetching should be triggered even if the cache is exists
   * @default true
   */
  swr?: boolean
  // TODO
  // | {
  //     /** should success revalidation trigger `onFulfill` to notify about the fresh data
  //      * @default true
  //      */
  //     shouldFulfill?: boolean
  //     // TODO
  //     // interval?: number
  //     // auto?: boolean
  //   }

  // TODO
  // staleByDataAtom?: boolean = false

  withPersist?: WithPersist
} & (
  | {
      /** convert params to stabilize it and use as a map key */
      paramsToKey?: (ctx: Ctx, params: ActionParams<T>) => string
    }
  | {
      /** check the equality of a cache record and passed params to find the cache
       * @default isDeepEqual from @reatom/utils
       */
      isEqual?: (
        ctx: Ctx,
        prev: ActionParams<T>,
        next: ActionParams<T>,
      ) => boolean
    }
)

export const withCache =
  <
    T extends AsyncAction & {
      cacheAtom?: CacheAtom<ActionPayload<T['onFulfill']>>
    },
  >({
    staleTime = 5 * 60 * 1000,
    length = 5,
    paramsLength,
    swr = true,
    // @ts-expect-error
    paramsToKey,
    // @ts-expect-error
    isEqual,
    withPersist,
  }: WithCacheOptions<T> = {}): ((anAsync: T) => T & {
    cacheAtom: CacheAtom<ActionPayload<T['onFulfill']>>
  }) =>
  // @ts-ignore
  (anAsync) => {
    if (!anAsync.cacheAtom) {
      const find: (
        ctx: Ctx,
        params: any[],
        state?: any
      ) => { cached: CacheMapRecord<T>; key: unknown } = paramsToKey
        ? (ctx, params, state = ctx.get(cacheAtom)) => {
            const key = paramsToKey(ctx, params as any)
            return {
              cached: state.get(paramsToKey(ctx, params as any)),
              key,
            }
          }
        : ((isEqual ??= (ctx: Ctx, a: any, b: any) => isDeepEqual(a, b)),
          (ctx, params, state = ctx.get(cacheAtom)) => {
            for (const [key, cached] of state) {
              if (isEqual(ctx, key, params)) return { cached, key }
            }
            return { cached: undefined, key: params }
          })

      const cacheAtom = (anAsync.cacheAtom = reatomMap(
        new Map(),
        `${anAsync.__reatom.name}._cacheAtom`,
      ) as CacheAtom)

      cacheAtom.invalidate = action((ctx) => {
        for (const cached of ctx.get(cacheAtom).values()) {
          // @ts-expect-error falsy `>` with undefined is expected
          if (!cached.promise && cached.lastUpdate > lastCached?.lastUpdate) {
            var lastCached: undefined | CacheRecord = cached
          }
        }

        cacheAtom.clear(ctx)

        if (lastCached) {
          anAsync(ctx, ...lastCached.params)
        }
      }, `${cacheAtom.__reatom.name}.invalidate`)

      if (withPersist) {
        cacheAtom.pipe(
          withPersist({
            key: cacheAtom.__reatom.name!,
            // @ts-expect-error
            fromSnapshot: (
              ctx,
              snapshot: Array<[unknown, CacheRecord]>,
              state = new Map(),
            ) => {
              if (
                snapshot.length === state?.size &&
                snapshot.every(([, { params, value }]) => {
                  const { cached, key } = find(ctx, params, state)
                  return state.has(key) && isDeepEqual(cached!.value, value)
                })
              ) {
                return state
              }

              const newState = new Map(snapshot)

              for (const [, rec] of newState) {
                const { key } = find(ctx, rec.params, state)
                const clearTimeoutId = setTimeout(
                  () => cacheAtom.delete(ctx, key),
                  staleTime - (Date.now() - rec.lastUpdate),
                )
                clearTimeoutId.unref?.()
                ctx.schedule(() => clearTimeout(clearTimeoutId), -1)
                rec.clearTimeoutId = clearTimeoutId
              }

              return newState
            },
            time: staleTime,
            toSnapshot: (ctx, cache) =>
              [...cache].filter(([, v]) => !v.promise),
          }),
        )
        if ('dataAtom' in anAsync) {
          onConnect(anAsync.dataAtom as Atom, (ctx) =>
            ctx.subscribe(cacheAtom, () => {}),
          )
        }
      }

      const handlePromise = (
        ctx: Ctx,
        key: any,
        promise: Promise<any>,
        cached: CacheRecord<any>,
      ) => {
        cacheAtom.set(ctx, key, cached)

        __thenReatomed(
          ctx,
          promise,
          (value) => {
            // cache wasn't cleared during promise execution
            if (cacheAtom.has(ctx, key)) {
              const clearTimeoutId = setTimeout(
                () => cacheAtom.delete(ctx, key),
                staleTime,
              )

              clearTimeoutId.unref?.()
              ctx.schedule(() => clearTimeout(clearTimeoutId), -1)
              const cache = cacheAtom.set(ctx, key, {
                clearTimeoutId,
                lastUpdate: Date.now(),
                params: cached.params,
                promise: null,
                value,
              })

              if (cache.size > length) {
                let oldest: { key: unknown; lastUpdate: number }
                for (const [key, cached] of cache.entries()) {
                  const lastUpdate = cached.promise
                    ? Infinity
                    : cached.lastUpdate
                  oldest ??= { key, lastUpdate }

                  if (lastUpdate < oldest.lastUpdate) {
                    oldest = { key, lastUpdate }
                  }
                }
                // @ts-expect-error
                if (oldest) {
                  cacheAtom.delete(ctx, oldest.key)
                }
              }
            }
          },
          (error) => cacheAtom.delete(ctx, key),
        )
      }

      const handleCache = action(
        (ctx, promise: Promise<any>, params: any[]) => {
          if (paramsLength !== undefined) params = params.slice(0, paramsLength)

          const { cached, key } = find(ctx, params)

          if (!cached) {
            handlePromise(ctx, key, promise, {
              clearTimeoutId: 0 as any,
              lastUpdate: 0,
              params,
              promise,
              value: undefined as any,
            })
          } else {
            // @ts-expect-error
            anAsync.pendingAtom(ctx, (state) => --state)

            // the cache is not ready yet
            if (cached.lastUpdate === 0) {
              CACHE.set(promise, async () => cached.promise)
            }
            // the cache is ready
            else {
              anAsync.onFulfill(ctx, cached.value)
              CACHE.set(promise, async (effect) => {
                if (cached.promise) return cached.promise
                if (!swr) return cached.value

                const swrPromise = effect()
                handlePromise(
                  ctx,
                  key,
                  swrPromise,
                  assign({}, cached, { promise: swrPromise }),
                )
                return swrPromise
              })
            }
          }
        },
        `${anAsync.__reatom.name}._handleCache`,
      )

      onUpdate(anAsync, (ctx, promise, { params }) =>
        handleCache(ctx, promise, params),
      )
    }

    return anAsync
  }
