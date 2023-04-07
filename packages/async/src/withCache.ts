import { action, ActionParams, ActionPayload, Ctx, Fn } from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { onUpdate } from '@reatom/hooks'
import { MapAtom, reatomMap } from '@reatom/primitives'
import { assign, isDeepEqual } from '@reatom/utils'

import { CACHE } from './cache'
import { AsyncAction } from '.'

export interface CacheRecord<T> {
  lastUpdate: number
  clearTimeoutId: ReturnType<typeof setTimeout>
  value: T
  promise: null | Promise<T>
}

export interface CacheAtom<T> extends MapAtom<unknown, CacheRecord<T>> {}

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
  }: WithCacheOptions<T> = {}): Fn<
    [T],
    T & {
      cacheAtom: CacheAtom<ActionPayload<T['onFulfill']>>
    }
  > =>
  // @ts-ignore
  (anAsync) => {
    if (!anAsync.cacheAtom) {
      const find: Fn<
        [Ctx, any[]],
        { cached: CacheMapRecord<T>; key: unknown }
      > = paramsToKey
        ? (ctx, params) => {
            const key = paramsToKey(ctx, params as any)
            return {
              cached: cacheAtom.get(ctx, paramsToKey(ctx, params as any)),
              key,
            }
          }
        : ((isEqual ??= (ctx: Ctx, a: any, b: any) => isDeepEqual(a, b)),
          (ctx, params) => {
            for (const [key, cached] of ctx.get(cacheAtom)) {
              if (isEqual(ctx, key, params)) return { cached, key }
            }
            return { cached: undefined, key: params }
          })

      const cacheAtom: CacheAtom<ActionPayload<T['onFulfill']>> =
        (anAsync.cacheAtom = reatomMap(
          new Map(),
          `${anAsync.__reatom.name}._cacheAtom`,
        ))

      const handlePromise = (
        ctx: Ctx,
        key: any,
        promise: Promise<any>,
        cached: CacheRecord<any>,
      ) => {
        cacheAtom.set(ctx, key, cached)

        __thenReatomed(ctx, promise, (value) => {
          // cache was cleared during promise execution
          if (cacheAtom.has(ctx, key)) {
            handleValue(ctx, key, value)
          }
        })
      }

      const handleValue = (ctx: Ctx, key: any, value: any) => {
        const clearTimeoutId = setTimeout(
          () => cacheAtom.delete(ctx, key),
          staleTime,
        )

        clearTimeoutId.unref?.()
        ctx.schedule(() => clearTimeout(clearTimeoutId), -1)
        const cache = cacheAtom.set(ctx, key, {
          lastUpdate: Date.now(),
          clearTimeoutId,
          value,
          promise: null,
        })

        if (cache.size > length) {
          let oldest: { key: unknown; lastUpdate: number }
          for (const [key, cached] of cache.entries()) {
            const lastUpdate = cached.promise ? Infinity : cached.lastUpdate
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

      const handleCache = action(
        (ctx, promise: Promise<any>, params: any[]) => {
          if (paramsLength !== undefined) params = params.slice(0, paramsLength)

          const { cached, key } = find(ctx, params)

          if (!cached) {
            handlePromise(ctx, key, promise, {
              lastUpdate: 0,
              clearTimeoutId: 0 as any,
              value: undefined as any,
              promise,
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

      onUpdate(anAsync, (ctx, promise, { state }) =>
        handleCache(ctx, promise, state.at(-1)!.params),
      )
    }

    return anAsync
  }
