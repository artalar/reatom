import { AtomDecorator } from '@reatom/core'

export type PersistStorage = {
  get: (key: string) => unknown
  set?: (key: string, data: unknown) => void
  throttle?: number
}

let count = 0

/**
 * @example
 * ```ts
 * export const persist = createPersist({ get: key => snapshot[key] })
 * let snapshot: Record<string, any> = {}
 * // Process init before any atoms subscriptions
 * export function init(data) {
 *   snapshot = data
 * }
 * ```
 */
export function createPersist({ get, set, throttle = 0 }: PersistStorage) {
  return function persist<T>(
    /** Unique stable key */
    key?: string,
  ): AtomDecorator<T> {
    const intervalIdKey = `__persistIntervalId${++count}`

    return (reducer) => (transaction, cacheTemplate) => {
      const { id } = cacheTemplate.atom

      if (cacheTemplate.tracks == undefined) {
        // @ts-expect-error
        cacheTemplate.state = get(key ?? id)
      }

      const cache = reducer(transaction, cacheTemplate)

      if (set != undefined) {
        transaction.schedule(() => {
          if (throttle == 0) {
            set(key ?? id, cache.state)
          } else {
            const intervalId = (cache.ctx[intervalIdKey] as number) ?? null

            if (intervalId === null) {
              cache.ctx[intervalIdKey] = setTimeout(() => {
                cache.ctx[intervalIdKey] = null
                set(key ?? id, transaction.getCache(cache.atom)!.state)
              }, 150)
            }
          }
        })
      }

      return cache
    }
  }
}

export const localStoragePersistStorage: PersistStorage = {
  get: (key) => {
    const dataStr = globalThis.localStorage?.getItem(key)
    return dataStr ? JSON.parse(dataStr) : undefined
  },
  set: (key, data) =>
    globalThis.localStorage?.setItem(key, JSON.stringify(data)),
  throttle: 150,
}

/** Persist with localStorage */
export const persistLS = createPersist(localStoragePersistStorage)
