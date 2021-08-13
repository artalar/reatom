import { AtomOptions, createAtom } from '@reatom/core'

export function createSetAtom<Element>(
  initState = new Set<Element>(),
  options?: AtomOptions<Set<Element>>,
) {
  const mapAtom = createAtom(
    {
      add: (el: Element) => el,
      delete: (el: Element) => el,
      clear: () => null,

      change: (cb: (stateCopy: Set<Element>) => void) => cb,
    },
    ({ onAction }, state = initState) => {
      let newState = state

      const getMutState = () =>
        newState === state ? (newState = new Set(state)) : newState

      onAction(`add`, (el) => getMutState().add(el))

      onAction(`delete`, (key) => getMutState().delete(key))

      onAction(`clear`, () => getMutState().clear())

      onAction(`change`, (cb) => cb(getMutState()))

      return newState
    },
    options,
  )

  return mapAtom
}
