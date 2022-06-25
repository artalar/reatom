import { atom, AtomMut, AtomOptions } from '@reatom/core'
import { withReducers, WithReducers } from './withReducers'

export type MapAtomReducers<Key, Element> = {
  set(state: Map<Key, Element>, key: Key, el: Element): Map<Key, Element>
  delete(state: Map<Key, Element>, key: Key): Map<Key, Element>
  clear(): Map<Key, Element>
  reset(): Map<Key, Element>
}

export type MapAtom<Key, Element> = WithReducers<
  AtomMut<Map<Key, Element>>,
  MapAtomReducers<Key, Element>
>

export function atomizeMap<Key, Element>(
  initState = new Map<Key, Element>(),
  options: string | AtomOptions = {},
): MapAtom<Key, Element> {
  const { name, isInspectable = !!name }: AtomOptions =
    typeof options === 'string' ? { name: options } : options

  return atom(initState, {
    name: name ?? `map`,
    isInspectable,
  }).pipe(
    withReducers({
      set: (state, key, el) => {
        const prevEl = state.get(key)

        if (Object.is(prevEl, el) && (el !== undefined || state.has(key))) {
          return state
        }

        return new Map(state).set(key, el)
      },
      delete: (state, key) => {
        if (!state.has(key)) return state
        const newState = new Map(state)
        newState.delete(key)
        return newState
      },
      clear: () => new Map(),
      reset: () => initState,
    }),
  )
}
