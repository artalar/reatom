import { atom, Atom, AtomMut, AtomState, Ctx, Fn } from '@reatom/core'

export interface LensOptions<T extends Atom = Atom> {
  get?: Fn<[AtomState<T>]>
  set?: Fn<[any], AtomState<T>>
  // TODO filter
}

type LensOptionsGetResult<Options extends LensOptions> =
  Options['get'] extends Fn<[any], infer O>
    ? O
    : Options extends LensOptions<Atom<infer State>>
    ? State
    : never

export const lens =
  <T extends Atom, Options extends LensOptions<T>>({
    get,
    set,
  }: Options): Fn<
    [T],
    Options['set'] extends Fn<[infer I]>
      ? AtomMut<LensOptionsGetResult<Options>, I>
      : Atom<LensOptionsGetResult<Options>>
  > =>
  (anAtom: T): any => {
    let resultAtom: any = anAtom

    if (get !== undefined) {
      resultAtom = atom((ctx) => get(ctx.spy(anAtom)))
    }

    if (set !== undefined) {
      const { __reatom } = resultAtom
      resultAtom = (ctx: Ctx, input: any) => {
        // @ts-ignore
        return anAtom(ctx, () => set(input))
      }
      resultAtom.__reatom = __reatom
    }

    return resultAtom
  }

// TODO
// export const view = <T, K extends keyof T>
