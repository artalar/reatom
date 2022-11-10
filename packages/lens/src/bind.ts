import { Ctx, CtxParams, Fn } from '@reatom/core'

export type Binded<T extends Fn> = Fn<CtxParams<T>, ReturnType<T>>
// & {
//   [K in keyof T]: T[K]
// }

const ctxMap = new WeakMap<Ctx, WeakMap<Fn, Fn>>()
export const bind = <T extends Fn>(ctx: Ctx, fn: T): Binded<T> => {
  let fnMap = ctxMap.get(ctx)
  if (!fnMap) ctxMap.set(ctx, (fnMap = new WeakMap()))

  let bfn = fnMap.get(fn)
  if (!bfn) fnMap.set(fn, (bfn = fn.bind(ctx)))

  return bfn as Binded<T>
}
