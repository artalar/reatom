import { Action, action, atom, AtomMut } from '@reatom/core'
import { withAssign } from './withAssign'

export type StringAtom<T extends string = string> = AtomMut<T> & {
  reset: Action<[], T>
}

export const reatomString: {
  (init?: string, name?: string): StringAtom
  <T extends string>(init: T, name?: string): StringAtom<T>
} = (init = '', name?: string) =>
  atom(init, name).pipe(
    withAssign((target, name) => ({
      reset: action((ctx) => target(ctx, init), `${name}.reset`),
    })),
  )
