import { atom, AtomMut, AtomOptions } from '@reatom/core'
import { withReducers, WithReducers } from './withReducers'

export type BooleanReducers = {
  toggle: () => boolean
  setTrue: () => boolean
  setFalse: () => boolean
  reset: () => boolean
}

export type BooleanAtom = WithReducers<AtomMut<boolean>, BooleanReducers>

export function atomizeBoolean(
  initState = false,
  options: string | AtomOptions = {},
): BooleanAtom {
  const { name, isInspectable = !!name }: AtomOptions =
    typeof options === 'string' ? { name: options } : options

  return atom(initState, {
    name: name ?? `boolean`,
    isInspectable,
  }).pipe(
    withReducers({
      toggle: (state) => !state,
      setTrue: () => true,
      setFalse: () => false,
      reset: () => initState,
    }),
  )
}
