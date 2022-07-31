import {
  action,
  Action,
  atom,
  Atom,
  AtomCache,
  Ctx,
  CtxLessParams,
  Fn,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'

export interface Effect<Params extends any[] = [], Resp = any>
  extends Action<Params, Promise<Resp>> {
  onFulfill: Action<[Resp], Resp>
  onReject: Action<[unknown], unknown>
  onSettle: Action<[], void>
  retry: Action<[], Promise<Resp>>
  countAtom: Atom<number>
  pendingAtom: Atom<boolean>
  paramsAtom: Atom<null | Params>
  toPromise: Fn<[Ctx], Promise<Resp>>
}

export const atomizeAsync = <
  Params extends [Ctx, ...any[]] = [Ctx, ...any[]],
  Resp = any,
>(
  fn: Fn<Params, Promise<Resp>>,
  name?: string,
): Effect<CtxLessParams<Params>, Resp> => {
  type Self = Effect<CtxLessParams<Params>, Resp>
  const onEffect = action((ctx, ...a) => {
    paramsAtom(ctx, a)
    countAtom(ctx, (s) => ++s)

    // @ts-ignore
    const promise = fn(ctx, ...a)
    const decreaseCount = () => countAtom(ctx, (s) => --s)
    promise.then(decreaseCount, decreaseCount)

    return promise
  }, name) as Self

  const onFulfill: Self['onFulfill'] = action()
  const onReject: Self['onReject'] = action()
  const onSettle: Self['onSettle'] = action()

  const retry: Self['retry'] = action((ctx) => {
    const params = ctx.get(paramsAtom)
    throwReatomError(params === null, 'empty params')
    // @ts-ignore
    return onEffect(ctx, ...params)
  })

  const countAtom = atom(0)
  const pendingAtom: Self['pendingAtom'] = atom((ctx) => ctx.spy(countAtom) > 0)

  const paramsAtom = atom<null | CtxLessParams<Params>>(null)

  const toPromise: Self['toPromise'] = (ctx) =>
    new Promise((res, rej) => {
      const un1: Unsubscribe = ctx.subscribe(
        onFulfill,
        (v) => v.length > 0 && (un1(), un2(), res(v.at(-1)!)),
      )
      const un2: Unsubscribe = ctx.subscribe(
        onReject,
        (v) => v.length > 0 && (un1(), un2(), rej(v.at(-1)!)),
      )
    })

  const onUpdate = (onEffect.__reatom.onUpdate = new Set())
  onUpdate.add((ctx, patch: AtomCache<Array<Promise<Resp>>>) =>
    patch.state.forEach((promise) =>
      promise
        .then((response) => onFulfill(ctx, response))
        .catch((error) => error?.name !== 'AbortError' && onReject(ctx, error))
        .finally(() => onSettle(ctx)),
    ),
  )

  return Object.assign(onEffect, {
    onFulfill,
    onReject,
    onSettle,
    retry,
    countAtom,
    pendingAtom,
    paramsAtom,
    toPromise,
  })
}

// TODO rename?
export const withLastWin = <
  T extends Fn<[Ctx, AbortController, ...any[]], Promise<any>>,
>(
  fn: T,
): T extends Fn<[Ctx, AbortController, ...infer Input], infer Output>
  ? Fn<[Ctx, ...Input], Output>
  : never => {
  const versionAtom = atom(0)
  // @ts-ignore
  return (ctx, ...a) => {
    const controller = new AbortController()
    controller.signal.throwIfAborted ??= () => {
      if (controller.signal.aborted) {
        const error = new Error(controller.signal.reason)
        error.name = 'AbortError'
        throw error
      }
    }
    const version = versionAtom(ctx, (s) => ++s)

    return fn(ctx, controller, ...a).then((resp) => {
      if (version !== ctx.get(versionAtom)) {
        controller.abort('concurrent request')
      }
      controller.signal.throwIfAborted()
      return resp
    })
  }
}
