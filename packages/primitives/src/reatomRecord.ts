import { atom, AtomMut, Rec } from '@reatom/core'
import { withReducers, WithReducers } from './withReducers'

export type RecordAtom<T extends Rec> = WithReducers<
  AtomMut<T>,
  {
    merge(state: T, slice: Partial<T>): T
    reset(): T
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
      reset: () => initState,
    }),
  )
}
