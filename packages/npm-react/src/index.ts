import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import {
  atom,
  Atom,
  AtomMut,
  AtomState,
  Ctx,
  CtxSpy,
  Fn,
  isAtom,
  throwReatomError,
} from '@reatom/core'
import { bind, Binded } from '@reatom/lens'

let batch = (cb: Fn) => cb()

export const setupBatch = (newBatch: typeof batch) => {
  batch = newBatch
}

export const reatomContext = createContext<null | Ctx>(null)

export const useCtx = (): Ctx => {
  const ctx = useContext(reatomContext)

  throwReatomError(
    !ctx,
    'ctx is not set, you probably forgot to specify the ctx provider',
  )

  return ctx!
}

const bindBind = (ctx: Ctx, fn: Fn) => bind(ctx, fn)
export const useCtxBind = (): (<T extends Fn>(fn: T) => Binded<T>) =>
  bind(useCtx(), bindBind)

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
  const ctx = useCtx()
  deps.push(ctx)

  const setup = () => {
    const theAtom = isAtom(anAtom) ? anAtom : atom(anAtom)
    const state = ctx.get(theAtom)
    return [
      state,
      typeof theAtom === 'function'
        ? // @ts-expect-error
          (...a) => batch(() => theAtom(ctx, ...a))
        : undefined,
      theAtom,
      deps,
    ] as const
  }

  let [[state, update, theAtom, prevDeps], setState] = React.useState(setup)

  if (
    deps.length !== prevDeps.length ||
    deps.some((v, i) => !Object.is(v, prevDeps[i]!))
  ) {
    const newState = setup()
    setState(newState)
    ;[state, update, theAtom, prevDeps] = newState
  }

  if (shouldSubscribe) {
    useEffect(
      () =>
        ctx.subscribe(theAtom, (v) =>
          setState((atomState) =>
            Object.is(atomState[0], v)
              ? atomState
              : [v, atomState[1], atomState[2], atomState[3]],
          ),
        ),
      deps,
    )
  }

  return [state, update, theAtom, ctx]
}

// export const useAtomCreator = <T extends Atom>(
//   creator: Fn<[], T>,
//   deps: Array<any> = [],
//   shouldSubscribe?: boolean,
// ) => useAtom(useMemo(creator, deps), deps, shouldSubscribe)

export const useAction = <T extends Fn<[Ctx, ...Array<any>]>>(
  cb: T,
  deps: Array<any> = [],
): T extends Fn<[Ctx, ...infer Args], infer Res> ? Fn<Args, Res> : never => {
  const ctx = useCtx()
  deps.push(ctx)

  // @ts-ignore
  return useCallback(
    (...a: Array<any>) => batch(() => ctx.get(() => cb(ctx, ...a))),
    deps,
  )
}

// export const unstable_reatomComponent =
//   <T = {}>(
//     render: (
//       ctx: CtxSpy,
//       props: React.PropsWithChildren<T>,
//     ) => React.ReactElement,
//   ): React.FC<T> =>
//   (props) => {
//     const [propsAtom] = useState(() => atom(props))
//     propsAtom(useCtx(), props)
//     const [[element]] = useAtom((ctx, state?: any) => {
//       const props = ctx.spy(propsAtom)

//       return [
//         props === ctx.cause!.parents[0]?.state ? state : render(ctx, props),
//       ]
//     })

//     return element
//   }
