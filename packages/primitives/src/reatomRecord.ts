import { atom, AtomMut, Rec } from '@reatom/core'
import { omit } from '@reatom/utils'
import { withReducers, WithReducers } from './withReducers'

export type RecordAtom<T extends Rec> = WithReducers<
  AtomMut<T>,
  {
    merge(state: T, slice: Partial<T>): T
    omit(state: T, ...keys: Array<keyof T>): T
    reset(state: T, ...keys: Array<keyof T>): T
  }
>

export const reatomRecord = <T extends Rec>(
  initState: T,
  name?: string,
): RecordAtom<T> => {
  return atom(initState, name).pipe(
    withReducers({
      merge: (state, slice: Partial<T>) => {
        for (const key in slice) {
          if (!Object.is(slice[key], state[key])) {
            return Object.assign({}, state, slice)
          }
        }

        return state
      },
      omit: (state, ...keys) =>
        keys.some((k) => k in state)
          ? // @ts-expect-error
            (omit(state, keys) as typeof state)
          : state,
      reset: (state, ...keys) => {
        if (keys.length === 0) return initState

        const newState: T = {} as T
        let changed = false
        for (const key in state) {
          if (keys.includes(key)) {
            if (key in initState) {
              newState[key] = initState[key]
              changed ||= !Object.is(state[key], initState[key])
            } else {
              changed ||= key in state
            }
          } else {
            newState[key] = state[key]
          }
        }
        return changed ? newState : state
      },
    }),
  )
}
