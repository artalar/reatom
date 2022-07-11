import { action, Action, Atom, AtomState, Fn, Rec } from '@reatom/core'

interface Reducers<A extends Atom>
  extends Rec<(state: AtomState<A>, ...args: Array<any>) => AtomState<A>> {}

export type WithReducers<A extends Atom, R extends Reducers<A>> = A & {
  [K in keyof R]: R[K] extends Fn<[any, ...infer Args]>
    ? Action<Args, AtomState<A>>
    : never
}

export const withReducers =
  <A extends Atom, R extends Reducers<A>>(reducers: R) =>
  (anAtom: A): WithReducers<A, R> =>
    Object.keys(reducers).reduce((anAtom, k) => {
      // @ts-expect-error
      anAtom[k] = action(
        (ctx, ...args) =>
          ctx['🙊'](anAtom.__reatom, (ctx, patch) => {
            patch.state = reducers[k]!(patch.state, ...args)
          }).state,
      )
      return anAtom
    }, anAtom) as any
