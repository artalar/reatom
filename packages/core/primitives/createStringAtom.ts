import { AtomOptions, createAtom } from '@reatom/core'

export function createToggleAtom(initState = ``, options: AtomOptions) {
  return createAtom(
    {
      change: (newState: string) => newState,
    },
    ({ onAction }, state = initState) => {
      onAction(`change`, (newState) => (state = newState))

      return state
    },
    options,
  )
}
