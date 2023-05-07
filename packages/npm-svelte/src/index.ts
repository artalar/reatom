import {
  Atom,
  AtomState,
  createCtx,
  Ctx,
  CtxParams,
  isAtom,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { getContext, setContext } from 'svelte'

const KEY = 'reatomCtx'

export const setupCtx = (ctx = createCtx()) => setContext(KEY, ctx)

export const withSvelte = <
  T extends Atom & {
    subscribe?: (cb: (arg: any) => any) => Unsubscribe
    set?: (arg: any) => any
  },
>(
  anAtom: T,
): T & {
  subscribe: (cb: (atom: AtomState<T>) => any) => Unsubscribe

  set: T extends (...args: any[]) => any
    ? (...ctxParams: CtxParams<T>) => ReturnType<T>
    : never
} => {
  throwReatomError(!isAtom(anAtom), 'atom expected')

  const ctx = getContext<Ctx>(KEY)

  anAtom.subscribe = (cb) => ctx.subscribe(anAtom, cb)

  // @ts-expect-error
  if (typeof anAtom === 'function') anAtom.set = (...a) => anAtom(ctx, ...a)

  // @ts-expect-error
  return anAtom
}
