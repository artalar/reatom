import { atom, AtomMut } from '@reatom/core'
import { withReducers, WithReducers } from './withReducers'

export type BooleanReducers = {
  toggle: () => boolean
  setTrue: () => boolean
  setFalse: () => boolean
  reset: () => boolean
}

export type BooleanAtom = WithReducers<AtomMut<boolean>, BooleanReducers>

export const reatomBoolean = (initState = false, name?: string): BooleanAtom =>
  atom(initState, name).pipe(
    withReducers({
      toggle: (state) => !state,
      setTrue: () => true,
      setFalse: () => false,
      reset: () => initState,
    }),
  )
