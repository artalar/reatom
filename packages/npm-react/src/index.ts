import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import {
  action,
  Action,
  atom,
  Atom,
  AtomMut,
  AtomState,
  Ctx,
  CtxSpy,
  Fn,
  isAction,
  isAtom,
  throwReatomError,
} from '@reatom/core'

let batch = (cb: Fn) => cb()

export const setupBatch = (newBatch: typeof batch) => {
  batch = newBatch
}

export const reatomContext = createContext<null | Ctx>(null)

export const useReatomContext = (): Ctx => {
  const ctx = useContext(reatomContext)

  throwReatomError(
    !ctx,
    'ctx is not set, you probably forgot to specify the ctx provider',
  )

  return ctx!
}

// @ts-ignore
export const useAtom: {
  <T extends Atom>(atom: T, deps?: Array<any>, shouldSubscribe?: boolean): [
    AtomState<T>,
    T extends Fn<[Ctx, ...infer Args], infer Res> ? Fn<Args, Res> : undefined,
    T,
    Ctx,
  ]
  <T>(
    init: T | Fn<[CtxSpy], T>,
    deps?: Array<any>,
    shouldSubscribe?: boolean,
  ): [T, Fn<[T | Fn<[T, Ctx], T>], T>, AtomMut<T>, Ctx]
} = (anAtom: any, deps: Array<any> = [], shouldSubscribe = true) => {
  const ctx = useReatomContext()

  const [theAtom, subscribe, getSnapshot, update] = useMemo(() => {
    const theAtom = isAtom(anAtom) ? anAtom : atom(anAtom)
    return [
      theAtom,
      (cb: Fn) => ctx.subscribe(theAtom, cb),
      () => ctx.get(theAtom),
      typeof theAtom === 'function'
        ? // @ts-expect-error
          (...a) => batch(() => theAtom(ctx, ...a))
        : undefined,
    ]
  }, deps.concat([ctx]))

  const state = shouldSubscribe
    ? useSyncExternalStore(subscribe, getSnapshot)
    : ctx.get(theAtom)

  return [state, update, theAtom, ctx]
}

// export const useAtomCreator = <T extends Atom>(
//   creator: Fn<[], T>,
//   deps: Array<any> = [],
//   shouldSubscribe?: boolean,
// ) => useAtom(useMemo(creator, deps), deps, shouldSubscribe)

export const useAction: {
  <T extends Action>(anAction: T): typeof useAtom<T>
  <T extends Fn<[Ctx, ...Array<any>]>>(cb: T, deps?: Array<any>): T extends Fn<
    [Ctx, ...infer Args],
    infer Res
  >
    ? typeof useAtom<Action<Args, Res>>
    : never
  // @ts-ignore
} = (anAction, deps) => {
  const theAction = isAction(anAction)
    ? anAction
    : useMemo(() => action(anAction), deps)

  return useAtom(theAction, deps, false)[1]
}
