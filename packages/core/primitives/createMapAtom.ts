import { AtomOptions, createAtom } from '@reatom/core'

export function createMapAtom<Key, Element>(
  initState = new Map<Key, Element>(),
  options?: AtomOptions<Map<Key, Element>>,
) {
  const mapAtom = createAtom(
    {
      set: (key: Key, el: Element) => ({ key, el }),
      delete: (key: Key) => key,
      clear: () => null,

      change: (cb: (stateCopy: Map<Key, Element>) => void) => cb,
    },
    ({ onAction }, state = initState) => {
      let newState = state

      const getMutState = () =>
        newState === state ? (newState = new Map(state)) : newState

      onAction(`set`, ({ key, el }) => getMutState().set(key, el))

      onAction(`delete`, (key) => getMutState().delete(key))

      onAction(`clear`, () => getMutState().clear())

      onAction(`change`, (cb) => cb(getMutState()))

      return newState
    },
    options,
  )

  return mapAtom
}
