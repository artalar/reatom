import { action, atom } from '@reatom/core'
import { withAssign } from './withAssign'

export type BooleanAtom = ReturnType<typeof reatomBoolean>

export const reatomBoolean = (init = false, name?: string) =>
  atom(init, name).pipe(
    withAssign((theAtom, name) => ({
      toggle: action(
        (ctx) => theAtom(ctx, !ctx.get(theAtom)),
        `${name}.toggle`,
      ),
      setTrue: action((ctx) => theAtom(ctx, true), `${name}.setTrue`),
      setFalse: action((ctx) => theAtom(ctx, false), `${name}.setFalse`),
      reset: action((ctx) => theAtom(ctx, init), `${name}.reset`),
    })),
  )
