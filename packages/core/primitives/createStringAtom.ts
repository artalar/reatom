import { AtomOptions, createAtom } from '@reatom/core'

export function createStringAtom<T extends string = string>(
  initState: T = `` as T,
  options?: AtomOptions,
) {
  return createAtom(
    {
      change: (cb: (state: T) => T) => cb,
      set: (newState: T) => newState,
    },
    ({ onAction }, state = initState) => {
      onAction(`change`, (cb) => (state = cb(state)))
      onAction(`set`, (newState) => (state = newState))

      return state
    },
    options,
  )
}
