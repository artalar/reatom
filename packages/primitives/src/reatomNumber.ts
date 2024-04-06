import { action, atom } from '@reatom/core'
import { withAssign } from './withAssign'

export type NumberAtom = ReturnType<typeof reatomNumber>

export const reatomNumber = (initState = 0, name?: string) =>
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
