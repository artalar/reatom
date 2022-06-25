import { atom, AtomMut, AtomOptions } from '@reatom/core'
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

export function atomizeSet<T>(
  initState = new Set<T>(),
  options: string | AtomOptions = {},
): SetAtom<T> {
  const { name, isInspectable = !!name }: AtomOptions =
    typeof options === 'string' ? { name: options } : options

  return atom(initState, {
    name: name ?? `set`,
    isInspectable,
  }).pipe(
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
}
