import { Action, atom, Atom, AtomCache, AtomState, Ctx, Fn } from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { mapName } from './utils'
import { type LensAtom, type LensAction } from './'

/** Create action which will invoked with the result of effect */
// @ts-expect-error
export const effect: {
  // TODO for some reason an atom not handled by overloads, if an action overload is first
  <T extends Atom, Res>(
    fn: T extends Action<infer Params, infer Payload>
      ? Fn<[Ctx, Awaited<Payload>, Params], Res>
      : Fn<[Ctx, AtomState<T>], Res>,
    name?: string,
  ): Fn<
    [T],
    T extends Action<infer Params, infer Payload>
      ? LensAction<
          [
            {
              params: [{ params: Params; payload: Awaited<Payload> }]
              payload: Awaited<Res>
            },
          ],
          Awaited<Res>
        >
      : LensAction<
          [{ params: [AtomState<T>]; payload: AtomState<T> }],
          Awaited<Res>
        >
  >
} = (fn: Fn, name?: string) => (anAtom: Atom) => {
  const { isAction } = anAtom.__reatom
  // TODO better error handling
  // @ts-expect-error
  const theAtom: LensAtom & LensAction = atom((ctx, state = []) => {
    const resolve = (params: any[], payload: any) =>
      ctx.get((read, acualize) => {
        if (payload instanceof Promise) {
          payload.then((payload) => resolve(params, payload))
        } else {
          acualize!(ctx, ctx.cause.proto, (patchCtx: Ctx, patch: AtomCache) => {
            patch.state = [{ params, payload }]
          })
        }
      })

    ctx.spy(anAtom, (value) => {
      if (isAction && value.payload instanceof Promise) {
        __thenReatomed(ctx, value.payload, (payload) =>
          ctx.schedule(() =>
            resolve(
              [{ params: value.params, payload }],
              fn(ctx, payload, value.params),
            ),
          ),
        )
      } else {
        ctx.schedule(() =>
          resolve(
            [value],
            isAction ? fn(ctx, value.payload, value.params) : fn(ctx, value),
          ),
        )
      }
    })

    return state ?? []
  }, mapName(anAtom, 'effect', name))
  theAtom.__reatom.isAction = true
  theAtom.deps = [anAtom]

  return theAtom
}
