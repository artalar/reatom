import { atom, AtomMut } from '@reatom/core'
import { withReducers, WithReducers } from './withReducers'

export type SetAtom<T> = WithReducers<
  AtomMut<Set<T>>,
  {
    set(state: Set<T>, el: T): Set<T>
    delete(state: Set<T>, el: T): Set<T>
    clear(): Set<T>
    reset(): Set<T>
  }
>

export const reatomSet = <T>(
  initState = new Set<T>(),
  name?: string,
): SetAtom<T> =>
  atom(initState, name).pipe(
    withReducers({
      set: (state, el) => (state.has(el) ? state : new Set(state).add(el)),
      delete: (state, el) => {
        if (!state.has(el)) return state
        const newState = new Set(state)
        newState.delete(el)
        return newState
      },
      clear: () => new Set(),
      reset: () => initState,
    }),
  )
