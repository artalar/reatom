import React from 'react'
import { useSyncExternalStore } from 'use-sync-external-store/shim'
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
import { bind, Binded } from '@reatom/lens'

let getName = (type: string): string => {
  let name =
    // @ts-expect-error does we have another way?
    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentOwner
      ?.current?.type?.name
  return (name && name.concat('.', type)) || `_${type}`
}

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

// use it instead of `setState` to handle HMR
const useRefSetup = <T extends Fn<[], { deps: Array<any> }>>(
  deps: Array<any>,
  setup: T,
): React.MutableRefObject<ReturnType<T>> => {
  let ref = React.useRef<ReturnType<typeof setup>>()
  if (
    ref.current === undefined ||
    ref.current.deps.length !== deps.length ||
    ref.current!.deps.some((v, i) => !Object.is(v, deps[i]!))
  ) {
    // @ts-expect-error
    ref.current = setup()
  }

  // @ts-expect-error
  return ref
}

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

  let { theAtom, update, sub, get } = useRefSetup(deps, () => {
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

    return { theAtom, update, deps, sub, get, subscribe }
  }).current!

  return [
    subscribe ? useSyncExternalStore(sub, get, get) : get(),
    update,
    theAtom,
    ctx,
  ]
}

export const useAtomCreator = <T extends Atom>(
  creator: Fn<[], T>,
  deps: Array<any> = [],
  options?: { subscribe?: boolean },
) => {
  const ref = useRefSetup(deps, () => ({ deps, theAtom: creator() }))
  return useAtom(ref.current.theAtom, [], options)
}

export const useUpdate = <T extends [any] | Array<any>>(
  cb: Fn<
    [
      Ctx,
      // @ts-expect-error
      ...{
        [K in keyof T]: T[K] extends Atom ? AtomState<T[K]> : T[K]
      },
    ]
  >,
  deps: T,
): null => {
  const ctx = useCtx()

  React.useEffect(() => {
    const call = (ctx: Ctx) => {
      // @ts-expect-error
      cb(ctx, ...deps.map((thing) => (isAtom(thing) ? ctx.get(thing) : thing)))
    }

    call(ctx)

    deps.forEach(
      (thing, i) =>
        isAtom(thing) && (thing.__reatom.updateHooks ??= new Set()).add(call),
    )

    return () =>
      deps.forEach(
        (thing, i) => isAtom(thing) && thing.__reatom.updateHooks!.delete(call),
      )
  }, deps.concat(ctx))

  return null
}

export const useAction = <T extends Fn<[Ctx, ...Array<any>]>>(
  fn: T,
  deps: Array<any> = [],
  name?: string,
): T extends Fn<[Ctx, ...infer Args], infer Res> ? Fn<Args, Res> : never => {
  deps ??= []
  let ctx = useCtx()
  deps.push(ctx)
  if (isAction(fn)) deps.push(fn)

  let ref = useRefSetup(deps, () => {
    let theAction: Action = isAction(fn)
      ? fn
      : action((...a) => ref.current!.fn(...a), name ?? getName(`useAction`))
    let cb = (...a: Array<any>) => batch(() => theAction(ctx, ...a))
    return { fn, deps, cb }
  })
  React.useLayoutEffect(() => {
    ref.current!.fn = fn
  })

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
