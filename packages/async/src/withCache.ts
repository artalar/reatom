import { ActionPayload, Ctx, Fn } from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { MapAtom, reatomMap } from '@reatom/primitives'
import { AsyncAction, AsyncDataAtom } from '.'

interface CacheRecord<T extends AsyncAction> {
  lastUpdate: number
  clearTimeoutId: number
  value: ActionPayload<T['onFulfill']>
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
    stabilize = (ctx, params) => JSON.stringify(params),
  }: {
    staleTime?: number
    //TODO  `staleByDataAtom?: boolean = false`
    length?: number
    stabilize?: Fn<
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
        const key = stabilize(ctx, params as any)
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
            ) as any as number
            ctx.schedule(() => clearTimeout(clearTimeoutId), -1)
            const cache = cacheAtom.set(ctx, key, {
              lastUpdate: Date.now(),
              clearTimeoutId,
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

        return Promise.resolve(cached)
      }
    }

    return anAsync
  }
