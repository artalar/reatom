import { atom, AtomMut } from '@reatom/core'
import { withReducers, WithReducers } from './withReducers'
 
export type ArrayAtom<T> = WithReducers<
  AtomMut<Array<T>>,
  {
    toReversed(state: Array<T>): Array<T>
    toSorted(state: Array<T>, compareFn?: (a: T, b: T) => number): Array<T>
    toSpliced(state: Array<T>, start: number, deleteCount: number, ...items: T[]): Array<T>
    with(state: Array<T>, index: number, value: T): Array<T>
  }
>
 
export const atomizeArray = <T>(initState = new Array<T>(), name?: string): ArrayAtom<T> => {
  return atom(initState, name).pipe(
    withReducers({
      toReversed: (state) => state.slice(0).reverse(),
      toSorted: (state, compareFn) => state.slice(0).sort(compareFn),
      toSpliced: (state, start, deleteCount, ...items) => {
        state = state.slice(0)
        state.splice(start, deleteCount, ...items)
 
        return state
      },
      with: (state, index, value) => {
        state = state.slice(0)
        state[index] = value
 
        return state
      }
    }),
  )
}
