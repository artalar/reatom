import { Action, atom, AtomMut, Ctx, Fn } from '@reatom/core'
import { assign } from '@reatom/utils'
import { withReducers } from './withReducers'

export interface MapAtomReducers<Key, Element> {
  set(state: Map<Key, Element>, key: Key, el: Element): Map<Key, Element>
  delete(state: Map<Key, Element>, key: Key): Map<Key, Element>
  clear(): Map<Key, Element>
  reset(): Map<Key, Element>
}

export interface MapAtom<Key, Element> extends AtomMut<Map<Key, Element>> {
  set: Action<[key: Key, el: Element], Map<Key, Element>>
  delete: Action<[key: Key], Map<Key, Element>>
  clear: Action<[], Map<Key, Element>>
  reset: Action<[], Map<Key, Element>>
  get: Fn<[Ctx, Key], Element | undefined>
  has: Fn<[Ctx, Key], boolean>
}

export const reatomMap = <Key, Element>(
  initState = new Map<Key, Element>(),
  name?: string,
): MapAtom<Key, Element> => {
  const theAtom = atom(initState, name).pipe(
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

  return assign(theAtom, {
    get: (ctx: Ctx, key: any) => ctx.get(theAtom).get(key),
    has: (ctx: Ctx, key: any) => ctx.get(theAtom).has(key),
  })
}
