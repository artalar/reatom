import { AtomOptions, createAtom } from '@reatom/core'

export function createBooleanAtom(initState = false, options?: AtomOptions) {
  return createAtom(
    {
      toggle: () => null,
      setTrue: () => null,
      setFalse: () => null,
      change: (cb: (state: boolean) => boolean) => cb,
      set: (newState: boolean) => newState,
    },
    ({ onAction }, state = initState) => {
      onAction(`toggle`, () => (state = !state))
      onAction(`setTrue`, () => (state = true))
      onAction(`setFalse`, () => (state = false))
      onAction(`change`, (cb) => (state = cb(state)))
      onAction(`set`, (newState) => (state = newState))

      return state
    },
    options,
  )
}
