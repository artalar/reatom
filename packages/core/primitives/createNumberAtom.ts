import { AtomOptions } from '@reatom/core'
import { createPrimitiveAtom } from '.'

let count = 0
export function createNumberAtom(
  initState = 0,
  options: AtomOptions = `number${++count}`,
) {
  return createPrimitiveAtom<
    number,
    {
      increment: (state: number) => number
      decrement: (state: number) => number
      add: (state: number, value: number) => number
      subtract: (state: number, value: number) => number
      change: (state: number, map: (state: number) => number) => number
      set: (state: number, newState: number) => number
    }
  >(
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
