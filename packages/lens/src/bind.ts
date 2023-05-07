import { Ctx, CtxParams} from '@reatom/core'

export type Binded<T extends (...args: any[]) => any> = (
  ...ctxParams: CtxParams<T>
) => ReturnType<T>
// & {
//   [K in keyof T]: T[K]
// }

const ctxMap = new WeakMap<
  Ctx,
  WeakMap<(...args: any[]) => any, Binded<(...args: any[]) => any>>
>()

export const bind = <T extends (...args: any[]) => any>(ctx: Ctx, fn: T): Binded<T> => {
  let fnMap = ctxMap.get(ctx)
  if (!fnMap) ctxMap.set(ctx, (fnMap = new WeakMap()))

  let bfn = fnMap.get(fn)
  if (!bfn) fnMap.set(fn, (bfn = fn.bind(null, ctx)))

  return bfn as Binded<T>
}
