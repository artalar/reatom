import React from 'react'
import { useSyncExternalStore } from 'use-sync-external-store/shim'
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
import { Action, action, isAction } from '@reatom/framework'

export let DEBUG_INTERNALS_PARSING = true

let getName = (type: string): string =>
  (DEBUG_INTERNALS_PARSING && // @ts-expect-error
    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactDebugCurrentFrame?.getCurrentStack?.()
      ?.trim?.()
      .match(/at\s(\w+)\s/)[1]
      ?.concat('.', type)) ||
  `_${type}`

let batch = (cb: Fn) => cb()

export const setupBatch = (newBatch: typeof batch) => {
  batch = newBatch
}

export const withBatching = (ctx: Ctx): Ctx => {
  let queue: Array<Fn> = []
  return {
    ...ctx,
    // @ts-ignore
    subscribe: (anAtom, cb) =>
      ctx.subscribe(
        anAtom,
        cb &&
          ((value) =>
            Promise.resolve(queue.push(() => cb(value))).then(
              (length) =>
                length === queue.length &&
                batch(() => queue.splice(0).forEach((cb) => cb())),
            )),
      ),
  }
}

export const reatomContext = React.createContext<null | Ctx>(null)

export const useCtx = (): Ctx => {
  let ctx = React.useContext(reatomContext)

  throwReatomError(
    !ctx,
    'ctx is not set, you probably forgot to specify the ctx provider',
  )

  return ctx!
}

let bindBind = (ctx: Ctx, fn: Fn) => bind(ctx, fn)
export const useCtxBind = (): (<T extends Fn>(fn: T) => Binded<T>) =>
  bind(useCtx(), bindBind)

// @ts-ignore
export const useAtom: {
  <T extends Atom>(
    atom: T,
    deps?: Array<any>,
    options?: boolean | { name?: string; subscribe?: boolean },
  ): [
    AtomState<T>,
    T extends Fn<[Ctx, ...infer Args], infer Res> ? Fn<Args, Res> : undefined,
    T,
    Ctx,
  ]
  <T>(
    init: T | Fn<[CtxSpy], T>,
    deps?: Array<any>,
    options?: boolean | { name?: string; subscribe?: boolean },
  ): [T, Fn<[T | Fn<[T, Ctx], T>], T>, AtomMut<T>, Ctx]
} = (
  anAtom: any,
  deps: Array<any> = [],
  options: boolean | { name?: string; subscribe?: boolean } = {},
) => {
  let { name, subscribe = true }: { name?: string; subscribe?: boolean } =
    typeof options === 'boolean' ? { subscribe: options } : options
  let ctx = useCtx()
  deps.push(ctx)
  if (isAtom(anAtom)) deps.push(anAtom)

  let setup = () => {
    let theAtom = isAtom(anAtom)
      ? anAtom
      : atom(anAtom, getName(name ?? `useAtom#${typeof anAtom}`))
    let update =
      typeof theAtom === 'function'
        ? // @ts-expect-error
          (...a) => batch(() => theAtom(ctx, ...a))
        : undefined
    let sub = (cb: Fn) => ctx.subscribe(theAtom, cb)
    let get = () => ctx.get(theAtom)

    return { theAtom, update, deps, sub, get }
  }

  let ref = React.useRef<ReturnType<typeof setup>>()
  if (
    ref.current === undefined ||
    ref.current.deps.length !== deps.length ||
    ref.current!.deps.some((v, i) => !Object.is(v, deps[i]!))
  ) {
    ref.current = setup()
  }

  let { theAtom, update, sub, get } = ref.current

  let state = subscribe ? useSyncExternalStore(sub, get, get) : get()

  return [state, update, theAtom, ctx]
}

export const useAtomCreator = <T extends Atom>(
  creator: Fn<[], T>,
  deps: Array<any> = [],
  options: { name?: string; subscribe?: boolean },
) => useAtom(React.useMemo(creator, deps), [], options)

export const useAction = <T extends Fn<[Ctx, ...Array<any>]>>(
  fn: T,
  deps?: Array<any>,
  name?: string,
): T extends Fn<[Ctx, ...infer Args], infer Res> ? Fn<Args, Res> : never => {
  let isCallbackRef = !deps || deps.length === 0
  deps ??= []
  let ctx = useCtx()
  deps.push(ctx)
  if (isAction(fn)) deps.push(fn)

  let setup = () => {
    let theAction: Action = isAction(fn)
      ? fn
      : action((...a) => ref.current!.fn(...a), name ?? getName(`useAction`))
    let cb = (...a: Array<any>) => batch(() => theAction(ctx, ...a))
    return { fn, deps, cb }
  }

  let ref = React.useRef<ReturnType<typeof setup>>()
  if (
    ref.current === undefined ||
    ref.current.deps!.length !== deps.length ||
    ref.current!.deps!.some((v, i) => !Object.is(v, deps![i]!))
  ) {
    ref.current = setup()
  }
  if (isCallbackRef)
    React.useLayoutEffect(() => {
      ref.current!.fn = fn
    }, [])

  // @ts-ignore
  return ref.current.cb
}

// export let unstable_reatomComponent =
//   <T = {}>(
//     render: (
//       ctx: CtxSpy,
//       props: React.PropsWithChildren<T>,
//     ) => React.ReactElement,
//   ): React.FC<T> =>
//   (props) => {
//     let ctx = useCtx()
//     return ctx.get(() => {
//       let trackCtx: Ctx = {
//         get: ctx.get,
//         spy(anAtom) {},
//         schedule: ctx.schedule,
//         subscribe: ctx.subscribe,
//         cause: ctx.cause,
//       }
//       let element = render(trackCtx, props)
//     })

//     let [propsAtom] = useState(() => atom(props))
//     propsAtom(useCtx(), props)
//     let [[element]] = useAtom((ctx, state?: any) => {
//       let props = ctx.spy(propsAtom)

//       return [
//         props === ctx.cause!.parents[0]?.state ? state : render(ctx, props),
//       ]
//     })

//     return element
//   }
