import { AtomOptions, createAtom } from '@reatom/core'

export function createNumberAtom(initState = 0, options: AtomOptions) {
  return createAtom(
    {
      increment: () => null,
      decrement: () => null,
      add: (value: number) => value,
      subtract: (value: number) => value,
      change: (cb: (state: number) => number) => cb,
    },
    ({ onAction }, state = initState) => {
      onAction(`increment`, () => state++)
      onAction(`decrement`, () => state--)
      onAction(`add`, (value) => (state += value))
      onAction(`subtract`, (value) => (state -= value))

      onAction(`change`, (cb) => (state = cb(state)))

      return state
    },
    options,
  )
}
