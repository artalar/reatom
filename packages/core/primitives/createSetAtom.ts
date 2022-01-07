import { AtomOptions } from '@reatom/core'
import { createPrimitiveAtom } from '.'

let count = 0
export function createSetAtom<Element>(
  initState = new Set<Element>(),
  options: AtomOptions<Set<Element>> = `set${++count}`,
) {
  type State = Set<Element>

  return createPrimitiveAtom<
    State,
    {
      set: (state: State, el: Element) => State
      delete: (state: State, el: Element) => State
      clear: () => State
      change: (state: State, cb: (stateCopy: State) => State) => State
    }
  >(
    initState,
    {
      set: (state, el: Element) => new Set(state).add(el),
      delete: (state, el: Element) => {
        const newState = (state = new Set(state))
        if (!newState.delete(el)) return state
        return newState
      },
      clear: () => new Set(),
      change: (state, cb: (stateCopy: State) => State) => cb(new Set(state)),
    },
    options,
  )
}
