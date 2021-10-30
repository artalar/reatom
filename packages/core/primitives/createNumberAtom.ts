import { AtomOptions } from '@reatom/core'

import { createPrimitiveAtom } from './'

let count = 0
export function createNumberAtom(
  initState = 0,
  options: AtomOptions = `number${++count}`,
) {
  return createPrimitiveAtom(
    initState,
    {
      increment: (state) => state + 1,
      decrement: (state) => state - 1,
      add: (state, value: number) => state + value,
      subtract: (state, value: number) => state - value,
      change: (state, map: (state: number) => number) => map(state),
      set: (state, newState: number) => newState,
    },
    options,
  )
}
