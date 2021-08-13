import { AtomOptions, createAtom } from '@reatom/core'

export function createBooleanAtom(initState = false, options: AtomOptions) {
  return createAtom(
    {
      toggle: () => null,
      setTrue: () => null,
      setFalse: () => null,
      change: (cb: (state: boolean) => boolean) => cb,
    },
    ({ onAction }, state = initState) => {
      onAction(`toggle`, () => (state = !state))
      onAction(`setTrue`, () => (state = true))
      onAction(`setFalse`, () => (state = false))

      onAction(`change`, (cb) => (state = cb(state)))

      return state
    },
    options,
  )
}
