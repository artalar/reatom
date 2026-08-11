import type { Action, Atom } from '../core'
import { atom, named, withActions } from '../core'
import type { Fn, Rec } from '../utils'
import { omit } from '../utils'

export interface RecordAtom<T extends Rec> extends Atom<T> {
  merge: Action<[slice: Partial<T>], T>
  omit: Action<Array<keyof T>, T>
  reset: Action<Array<keyof T>, T>
}

/**
 * Creates an object atom with helpers for shallow updates, key removal, and
 * resetting to the initial snapshot.
 *
 * @remarks
 *   This works well for filter panels, drafts, and settings objects where you
 *   usually patch a few fields at a time.
 * @example
 *   // Edit a product filter draft
 *   const filters = reatomRecord(
 *     { query: '', onlyInStock: false, sort: 'popular' },
 *     'filters',
 *   )
 *
 *   filters.merge({ query: 'keyboard', onlyInStock: true })
 *   filters.omit('sort')
 *   filters.reset('query')
 *
 *   filters() // { query: '', onlyInStock: true }
 */
export const reatomRecord = <T extends Rec>(
  initState: Exclude<T, Fn>,
  name: string = named('recordAtom'),
): RecordAtom<T> =>
  atom(initState, name).extend(
    withActions((target) => ({
      merge: (slice: Partial<T>) =>
        target.set((prev) => {
          for (const key in prev) {
            if (key in slice && !Object.is(prev[key], slice[key])) {
              return { ...prev, ...slice }
            }
          }
          for (const key in slice) {
            if (!(key in prev)) {
              return { ...prev, ...slice }
            }
          }
          return prev
        }),
      omit: (...keys: Array<keyof T>) =>
        target.set((prev) => {
          if (keys.some((key) => key in prev)) return omit(prev, keys) as any
          return prev
        }),
      reset: (...keys: (keyof T)[]) =>
        target.set(
          // @ts-ignore
          (prev) => {
            if (keys.length === 0) return initState
            const next = { ...prev } as T
            let changed = false
            for (const key of keys) {
              if (key in initState) {
                if (!(key in prev) || !Object.is(prev[key], initState[key])) {
                  next[key] = initState[key]
                  changed = true
                }
              } else if (key in prev) {
                delete next[key]
                changed = true
              }
            }
            return changed ? next : prev
          },
        ),
    })),
  )
