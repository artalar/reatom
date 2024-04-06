import { Action, action, atom, AtomMut } from '@reatom/core'
import { withAssign } from './withAssign'

export interface NumberAtom extends AtomMut<number> {
  increment: Action<[by?: number], number>
  decrement: Action<[by?: number], number>
  random: Action<[], number>
  reset: Action<[], number>
}

export const reatomNumber = (initState = 0, name?: string): NumberAtom =>
  atom(initState, name).pipe(
    withAssign((theAtom, name) => ({
      increment: action(
        (ctx, by = 1) => theAtom(ctx, (prev) => prev + by),
        `${name}.increment`,
      ),
      decrement: action(
        (ctx, by = 1) => theAtom(ctx, (prev) => prev - by),
        `${name}.decrement`,
      ),
      random: action((ctx) => theAtom(ctx, Math.random()), `${name}.decrement`),
      reset: action((ctx) => theAtom(ctx, initState), `${name}.reset`),
    })),
  )
