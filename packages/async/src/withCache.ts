import { action, ActionParams, ActionPayload, Ctx, Fn } from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { onUpdate } from '@reatom/hooks'
import { MapAtom, reatomMap } from '@reatom/primitives'
import { isDeepEqual, isObject } from '@reatom/utils'

import { CACHE } from './cache'
import { AsyncAction } from '.'

interface CacheRecord<T extends AsyncAction> {
  lastUpdate: number
  clearTimeoutId: ReturnType<typeof setTimeout>
  value: ActionPayload<T['onFulfill']>
}

const stabilize = (ctx: Ctx, thing: any, visited = new Set<any>()): string => {
  if (!isObject(thing)) return String(thing)

  if (visited.has(thing)) return '[Circular]'
  visited.add(thing)

  let result =
    Symbol.iterator in thing
      ? ''
      : ((thing = Object.entries(thing).sort(([a], [b]) => a.localeCompare(b))),
        // add extra symbol to avoid collisions with arrays
        '0')

  for (let item of thing) result += stabilize(ctx, item, visited)

  return result
}

type WithCacheOptions<T extends AsyncAction> = {
  /** Maximum amount of cache records  */
  length?: number
  /** The amount of milliseconds after which a cache record cleanups */
  staleTime?: number
  /** The number of excepted parameters, which will used as a cache key */
  paramsLength?: number
  //TODO  `staleByDataAtom?: boolean = false`
} & (
  | {
      /** convert params to stabilize it and use as a map key */
      paramsToKey?: (ctx: Ctx, params: ActionParams<T>) => string
    }
  | {
      /** check the equality of a cache record and passed params to find the cache */
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
      cacheAtom?: MapAtom<unknown, null | CacheRecord<T>>
    },
  >({
    staleTime = 5 * 60 * 1000,
    length = 5,
    paramsLength,
    // @ts-expect-error
    paramsToKey,
    // @ts-expect-error
    isEqual,
  }: WithCacheOptions<T> = {}): Fn<
    [T],
    T & {
      cacheAtom: MapAtom<unknown, null | CacheRecord<T>>
    }
  > =>
  // @ts-ignore
  (anAsync) => {
    if (!anAsync.cacheAtom) {
      const find: Fn<
        [Ctx, any[]],
        { cached: undefined | null | CacheRecord<T>; key: unknown }
      > = paramsToKey
        ? (ctx, params) => {
            const key = paramsToKey(ctx, params as any)
            return {
              cached: ctx.get(cacheAtom).get(paramsToKey(ctx, params as any)),
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

      const cacheAtom: MapAtom<unknown, null | CacheRecord<T>> =
        (anAsync.cacheAtom = reatomMap(
          new Map(),
          `${anAsync.__reatom.name}._cacheAtom`,
        ))

      const handleCache = action(
        (ctx, promise: Promise<any>, params: any[]) => {
          if (paramsLength !== undefined) params = params.slice(0, paramsLength)

          const { cached, key } = find(ctx, params)

          if (cached) {
            CACHE.set(promise, cached.value)
            // @ts-expect-error
            anAsync.pendingAtom(ctx, (state) => --state)
            anAsync.onFulfill(ctx, cached.value)
          } else {
            cacheAtom.set(ctx, key, null)
            __thenReatomed(ctx, promise, (value) => {
              // it is possible that cache was cleared during promise execution
              if (!find(ctx, params)) return

              const clearTimeoutId = setTimeout(
                () => cacheAtom.delete(ctx, key),
                staleTime,
              )
              clearTimeoutId.toString = () => ''
              clearTimeoutId.unref?.()
              ctx.schedule(() => clearTimeout(clearTimeoutId), -1)
              const cache = cacheAtom.set(ctx, key, {
                lastUpdate: Date.now(),
                clearTimeoutId,
                value,
              })

              if (cache.size > length) {
                let oldest: [unknown, null | CacheRecord<T>]
                for (const [key, cached] of cache.entries()) {
                  oldest ??= [key, cached]

                  if (!cached) continue

                  if (
                    cached.lastUpdate < (oldest![1]?.lastUpdate ?? Infinity)
                  ) {
                    oldest = [key, cached]
                  }
                }
                cacheAtom.delete(ctx, oldest![0])
              }
            })
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
