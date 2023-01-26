import { ActionPayload, Ctx, Fn, Rec } from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { MapAtom, reatomMap } from '@reatom/primitives'
import { AsyncAction, AsyncDataAtom } from '.'

interface CacheRecord<T extends AsyncAction> {
  lastUpdate: number
  clearTimeoutId: number
  value: ActionPayload<T['onFulfill']>
}

// TODO tests
const stabilize = <T>(thing: T): T => {
  if (typeof thing !== 'object' || thing === null) return thing

  const isArray = Array.isArray(thing)
  const entries = Object.entries(thing)
  const result = (isArray ? [] : {}) as T

  if (!isArray && entries.length > 1) {
    entries.sort(([a], [b]) => a.localeCompare(b))
  }

  for (const [key, value] of entries) result[key as keyof T] = stabilize(value)

  return result
}

export const withCache =
  <
    T extends AsyncAction & {
      dataAtom?: AsyncDataAtom<ActionPayload<T['onFulfill']>>
      // TODO
      // abort?: Action<[reason?: string], void>

      cacheAtom?: MapAtom<string, null | CacheRecord<T>>
    },
  >({
    staleTime = 5 * 60 * 1000,
    length = 5,
    paramsToKey = (ctx, params) => JSON.stringify(stabilize(params)),
  }: {
    staleTime?: number
    //TODO  `staleByDataAtom?: boolean = false`
    length?: number
    paramsToKey?: Fn<
      [Ctx, T extends AsyncAction<infer Params> ? Params : never],
      string
    >
  } = {}): Fn<
    [T],
    T & {
      cacheAtom: MapAtom<string, null | CacheRecord<T>>
    }
  > =>
  // @ts-ignore
  (anAsync) => {
    if (!anAsync.cacheAtom) {
      const { __fn } = anAsync
      const cacheAtom: MapAtom<string, null | CacheRecord<T>> =
        (anAsync.cacheAtom = reatomMap(
          new Map(),
          `${anAsync.__reatom.name}._cacheAtom`,
        ))

      anAsync.__fn = (ctx, ...params) => {
        const cache = ctx.get(cacheAtom)
        const key = paramsToKey(ctx, params as any)
        const cached = cache.get(key)

        if (!cached) {
          cacheAtom.set(ctx, key, null)
          const promise = __fn(ctx, ...params)
          __thenReatomed(ctx, promise, (value) => {
            // it is possible that cache was cleared during promise execution
            if (!ctx.get(cacheAtom).has(key)) return

            const clearTimeoutId = setTimeout(
              () => cacheAtom.delete(ctx, key),
              staleTime,
            )
            clearTimeoutId.unref?.()
            ctx.schedule(() => clearTimeout(clearTimeoutId), -1)
            const cache = cacheAtom.set(ctx, key, {
              lastUpdate: Date.now(),
              clearTimeoutId: clearTimeoutId as any as number,
              value,
            })

            if (cache.size > length) {
              let oldest: [string, null | CacheRecord<T>]
              for (const [key, cached] of cache.entries()) {
                oldest ??= [key, cached]

                if (!cached) continue

                if (cached.lastUpdate < (oldest![1]?.lastUpdate ?? Infinity)) {
                  oldest = [key, cached]
                }
              }
              cacheAtom.delete(ctx, oldest![0])
            }
          })

          return promise
        }

        anAsync.dataAtom?.(ctx, cached.value)

        return Promise.resolve(cached.value)
      }
    }

    return anAsync
  }
