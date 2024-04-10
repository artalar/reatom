import { Action, AtomMut, action, atom } from '@reatom/core'
import { withAssign } from './withAssign'

export interface BooleanAtom extends AtomMut<boolean> {
  toggle: Action<[], boolean>
  setTrue: Action<[], true>
  setFalse: Action<[], false>
  reset: Action<[], boolean>
}

export const reatomBoolean = (init = false, name?: string): BooleanAtom =>
  atom(init, name).pipe(
    withAssign((theAtom, name) => ({
      toggle: action((ctx) => theAtom(ctx, (prev) => !prev), `${name}.toggle`),
      setTrue: action((ctx) => theAtom(ctx, true) as true, `${name}.setTrue`),
      setFalse: action(
        (ctx) => theAtom(ctx, false) as false,
        `${name}.setFalse`,
      ),
      reset: action((ctx) => theAtom(ctx, init), `${name}.reset`),
    })),
  )
