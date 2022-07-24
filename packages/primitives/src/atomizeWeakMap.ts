import { atom, AtomMut } from '@reatom/core'
import { withReducers, WithReducers } from './withReducers'

export type WeakMapAtomReducers<Key extends object, Element> = {
  set(state: WeakMap<Key, Element>, key: Key, el: Element): WeakMap<Key, Element>
  delete(state: WeakMap<Key, Element>, key: Key): WeakMap<Key, Element>
  clear(): WeakMap<Key, Element>
  reset(): WeakMap<Key, Element>
}

export type WeakMapAtom<Key extends object, Element> = WithReducers<
  AtomMut<WeakMap<Key, Element>>,
  WeakMapAtomReducers<Key, Element>
>

export const atomizeWeakMap = <Key extends object, Element>(
  initState = new WeakMap<Key, Element>(),
  name?: string,
): WeakMapAtom<Key, Element> =>
  atom(initState, name).pipe(
    withReducers({
      set: (state, key, el) => {
        const prevEl = state.get(key)

        if (Object.is(prevEl, el) && (el !== undefined || state.has(key))) {
          return state
        }

        return new WeakMap(state).set(key, el)
      },
      delete: (state, key) => {
        if (!state.has(key)) return state
        const newState = new WeakMap(state)
        newState.delete(key)
        return newState
      },
      clear: () => new WeakMap(),
      reset: () => initState,
    }),
  )
