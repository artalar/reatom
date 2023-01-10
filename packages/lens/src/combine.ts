import { atom, Atom, AtomState, Rec } from '@reatom/core'
import { addOnUpdate } from '@reatom/hooks'
import { isShallowEqual } from '@reatom/utils'

type Combined<Shape extends Rec<Atom>> = {
  [K in keyof Shape]: AtomState<Shape[K]>
}

export const unstable_combine = <Shape extends Rec<Atom>>(
  shape: Shape,
): Atom<Combined<Shape>> => {
  const theAtom = atom((ctx, state = {} as Combined<Shape>) => {
    const newState = {} as Combined<Shape>
    for (const key in shape) state[key] = ctx.spy(shape[key]!)
    return isShallowEqual(state, newState) ? state : newState
  })

  for (const name in shape)
    addOnUpdate(shape[name]!, (ctx) =>
      ctx.get((r, a) => {
        a!(ctx, theAtom.__reatom)
      }),
    )

  return theAtom
}
