import { atom, AtomMut, AtomOptions } from '@reatom/core'
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

export function atomizeNumber(
  initState = 0,
  options: string | AtomOptions = {},
): NumberAtom {
  const { name, isInspectable = !!name }: AtomOptions =
    typeof options === 'string' ? { name: options } : options

  return atom(initState, {
    name: name ?? `number`,
    isInspectable,
  }).pipe(
    withReducers({
      increment: (state, value = 1) => state + value,
      decrement: (state, value = 1) => state - value,
      random: Math.random,
      reset: () => initState,
    }),
  )
}
