import { atom, AtomMut } from '@reatom/core'
import { withReducers, WithReducers } from './withReducers'

export type WeakSetAtom<T extends object> = WithReducers<
  AtomMut<WeakSet<T>>,
  {
    set(state: WeakSet<T>, el: T): WeakSet<T>
    delete(state: WeakSet<T>, el: T): WeakSet<T>
    clear(): WeakSet<T>
    reset(): WeakSet<T>
  }
>

export const atomizeWeakSet = <T extends object>(
  initState = new WeakSet<T>(),
  name?: string,
): WeakSetAtom<T> =>
  atom(initState, name).pipe(
    withReducers({
      set: (state, el) => (state.has(el) ? state : new WeakSet(state).add(el)),
      delete: (state, el) => {
        if (!state.has(el)) return state
        const newState = new WeakSet(state)
        newState.delete(el)
        return newState
      },
      clear: () => new WeakSet(),
      reset: () => initState,
    }),
  )
