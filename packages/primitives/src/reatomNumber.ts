import { atom, AtomMut } from '@reatom/core'
import { withReducers, WithReducers } from './withReducers'

// it would be better for semantic use additional `add` and `subtract`
// but is it really needed to take slow down creation and increase mem usage?
export type NumberAtomReducers = {
  increment(state: number, value?: number): number
  decrement(state: number, value?: number): number
  random(): number
  reset(): number
}

export type NumberAtom = WithReducers<AtomMut<number>, NumberAtomReducers>

export const reatomNumber = (initState = 0, name?: string): NumberAtom =>
  atom(initState, name).pipe(
    withReducers({
      increment: (state, value = 1) => state + value,
      decrement: (state, value = 1) => state - value,
      random: Math.random,
      reset: () => initState,
    }),
  )
