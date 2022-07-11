import { atom, AtomMut } from '@reatom/core'
import { withReset } from '@reatom/utils'
import { withReducers, WithReducers } from './withReducers'

export type StringAtom<State extends string = string> = WithReducers<
  AtomMut<State>,
  {
    /* reset: () => State */
  }
>

export const atomizeString = <T extends string = string>(
  initState: T = '' as T,
  name?: string,
): StringAtom<T> => atom(initState, name).pipe(withReset())
