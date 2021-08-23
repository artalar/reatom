import { AtomOptions } from '@reatom/core'
import { createPrimitiveAtom } from '.'

let count = 0
export function createMapAtom<Key, Element>(
  initState = new Map<Key, Element>(),
  options: AtomOptions<Map<Key, Element>> = `map atom [${++count}]`,
) {
  type State = Map<Key, Element>
  return createPrimitiveAtom(
    initState,
    {
      set: (state, key: Key, el: Element) => new Map(state).set(key, el),
      delete: (state, key: Key) => {
        const newState = (state = new Map(state))
        if (!newState.delete(key)) return state
        return newState
      },
      clear: () => new Map(),
      change: (state, cb: (stateCopy: State) => State) => cb(new Map(state)),
    },
    options,
  )
}
