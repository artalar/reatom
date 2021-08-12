import { AtomDecorator } from '@reatom/core'

export type PersistStorage = {
  get: (key: string) => unknown
  set?: (key: string, data: unknown) => void
  setDebounce?: number
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
export function createPersist({ get, set, setDebounce = 0 }: PersistStorage) {
  return function persist<T>(
    /** Unique stable key */
    key?: string,
  ): AtomDecorator<T> {
    const timeoutKey = `__SNAPSHOT [${++count}]`

    return (reducer) => (transaction, cacheTemplate) => {
      const { id } = cacheTemplate.atom

      if (cacheTemplate.tracks == undefined) {
        // @ts-expect-error
        cacheTemplate.state = get(key ?? id)
      }

      const cache = reducer(transaction, cacheTemplate)

      if (set != undefined) {
        transaction.schedule(() => {
          if (setDebounce == 0) {
            set(key ?? id, cache.state)
          } else {
            clearInterval(cache.ctx[timeoutKey] as number)
            cache.ctx[timeoutKey] = setTimeout(
              () => set(key ?? id, cache.state),
              150,
            )
          }
        })
      }

      return cache
    }
  }
}

export const localStoragePersistStorage: PersistStorage = {
  get: (key) => JSON.parse(globalThis.localStorage?.getItem(key) ?? ''),
  set: (key, data) =>
    globalThis.localStorage?.setItem(key, JSON.stringify(data)),
  setDebounce: 150,
}

/** Persist with localStorage */
export const persistLS = createPersist(localStoragePersistStorage)
