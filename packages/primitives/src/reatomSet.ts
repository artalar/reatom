import { Action, atom, AtomMut, Ctx, Fn } from '@reatom/core'
import { assign } from '@reatom/utils'
import { withReducers } from './withReducers'

export interface SetAtom<T> extends AtomMut<Set<T>> {
  set: Action<[el: T], Set<T>>
  delete: Action<[el: T], Set<T>>
  clear: Action<[], Set<T>>
  reset: Action<[], Set<T>>
  has: Fn<[Ctx, T], boolean>
}

export const reatomSet = <T>(
  initState = new Set<T>(),
  name?: string,
): SetAtom<T> => {
  const theAtom = atom(initState, name).pipe(
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

  return assign(theAtom, {
    has: (ctx: Ctx, el: T) => ctx.get(theAtom).has(el),
  })
}
