import { action, atom } from '@reatom/core'
import { withAssign } from './withAssign'

export type ArrayAtom<T> = ReturnType<typeof reatomArray<T>>

export const reatomArray = <T>(initState = new Array<T>(), name?: string) =>
  atom(initState, name).pipe(
    withAssign((theAtom, name) => ({
      toReversed: action(
        (ctx) => theAtom(ctx, (prev) => prev.slice().reverse()),
        `${name}.toReversed`,
      ),
      toSorted: action(
        (ctx, compareFn?: (a: T, b: T) => number) =>
          theAtom(ctx, (prev) => prev.slice().sort(compareFn)),
        `${name}.toSorted`,
      ),
      toSpliced: action(
        (ctx, start: number, deleteCount: number, ...items: T[]) =>
          theAtom(ctx, (state) => {
            state = state.slice()
            state.splice(start, deleteCount, ...items)
            return state
          }),
        `${name}.toSpliced`,
      ),
      with: action(
        (ctx, i: number, value: T) =>
          theAtom(ctx, (state) => {
            if (Object.is(state.at(i), value)) return state
            state = state.slice()
            state[i] = value
            return state
          }),
        `${name}.with`,
      ),
    })),
  )
