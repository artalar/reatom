import {
  action,
  Action,
  ActionParams,
  ActionResult,
  atom,
  Atom,
  AtomCache,
  AtomMut,
  Ctx,
  CtxLessParams,
  Fn,
  throwReatomError,
} from '@reatom/core'
import { addOnUpdate } from '@reatom/hooks'

export interface Effect<Params extends any[] = any[], Resp = any>
  extends Action<Params, Promise<Resp>> {
  onFulfill: Action<[Resp], Resp>
  onReject: Action<[unknown], unknown>
  onSettle: Action<[], void>
  countAtom: Atom<number>
  pendingAtom: Atom<boolean>
  paramsAtom: Atom<null | Params>
}

const NEVER = Symbol()

export const atomizeAsync = <
  Params extends [Ctx, ...any[]] = [Ctx, ...any[]],
  Resp = any,
>(
  fn: Fn<Params, Promise<Resp>>,
  name?: string,
): Effect<CtxLessParams<Params>, Resp> => {
  type Self = Effect<CtxLessParams<Params>, Resp>
  // @ts-ignore
  const onEffect: Self = action((ctx, ...a) => {
    paramsAtom(ctx, a)
    countAtom(ctx, (s) => ++s)

    // @ts-ignore
    return ctx.schedule(() => fn(ctx, ...a))
  }, name)

  const onFulfill: Self['onFulfill'] = action(name?.concat('.onFulfill'))
  const onReject: Self['onReject'] = action(name?.concat('.onReject'))
  const onSettle: Self['onSettle'] = action(name?.concat('.onSettle'))

  const countAtom = atom(0, name?.concat('.count'))
  // this "isLoading" state type is too utilized
  // to separate it to a separate fabric
  const pendingAtom: Self['pendingAtom'] = atom(
    (ctx) => ctx.spy(countAtom) > 0,
    name?.concat('.pending'),
  )

  const paramsAtom = atom<null | CtxLessParams<Params>>(
    null,
    name?.concat('.params'),
  )

  addOnUpdate(onEffect, (ctx, patch: AtomCache<Array<Promise<Resp>>>) => {
    let res: any = NEVER
    let err: any = NEVER
    patch.state
      .at(-1)
      ?.then(
        (v) => (res = v),
        (e) => (err = e),
      )
      .finally(() =>
        ctx.get(() => {
          countAtom(ctx, (s) => --s)
          if (err !== NEVER) {
            if (err?.name !== 'AbortError') onReject(ctx, err)
          } else {
            onFulfill(ctx, res)
          }
          onSettle(ctx)
        }),
      )
  })

  return Object.assign(onEffect, {
    onFulfill,
    onReject,
    onSettle,
    countAtom,
    pendingAtom,
    paramsAtom,
  })
}

export const withDataAtom =
  <State = undefined, T extends Effect = Effect>(
    initState?: State,
  ): Fn<[T], T & { dataAtom: AtomMut<State | ActionResult<T['onFulfill']>> }> =>
  (anAsync) => {
    // @ts-expect-error
    if (!anAsync.dataAtom) {
      // @ts-expect-error
      const dataAtom = (anAsync.errorAtom = atom(
        initState,
        anAsync.__reatom.name?.concat('.errorAtom'),
      ))
      addOnUpdate(anAsync, (ctx, { state }: AtomCache) => dataAtom(ctx, state))
    }

    return anAsync as T & { dataAtom: any }
  }

export const withErrorAtom =
  <T extends Effect = Effect>(): Fn<
    [T],
    T & { errorAtom: AtomMut<undefined | Error> }
  > =>
  (anAsync) => {
    // @ts-expect-error
    if (!anAsync.errorAtom) {
      // @ts-expect-error
      const errorAtom = (anAsync.errorAtom = atom<undefined | Error>(
        undefined,
        anAsync.__reatom.name?.concat('.errorAtom'),
      ))
      addOnUpdate(anAsync.onReject, (ctx, { state }) =>
        errorAtom(
          ctx,
          state instanceof Error ? state : new Error(String(state)),
        ),
      )
      addOnUpdate(anAsync.onFulfill, (ctx) => errorAtom(ctx, undefined))
    }

    return anAsync as T & { errorAtom: any }
  }

export const withRetry =
  <T extends Effect>(): Fn<[T], T & { retry: Action<[], ActionResult<T>> }> =>
  (anAsync) => {
    // @ts-expect-error
    anAsync.retry ??= action((ctx) => {
      const params = ctx.get(anAsync.paramsAtom)
      throwReatomError(params === null, 'no cached params')
      return anAsync(ctx, ...params!) as ActionResult<T>
    }, anAsync.__reatom.name?.concat('.retry'))
    return anAsync as T & { retry: any }
  }

export const withFetchOnConnect =
  <T extends Effect, Targets extends keyof T>(
    targets: Array<Targets>,
    params: ActionParams<T> | Fn<[Ctx], ActionParams<T>>,
  ): Fn<[T], T> =>
  (anAsync) => {
    const getPrams = typeof params === 'function' ? params : () => params
    const addHook = (anAtom: Atom) =>
      (anAtom.__reatom.onConnect ??= new Set()).add(
        (ctx: Ctx) =>
          // @ts-ignore
          ctx.get(anAsync.countAtom) === 0 && anAsync(ctx, ...getPrams(ctx)),
      )

    addHook(anAsync)
    for (const k of targets) addHook(anAsync[k] as any as Atom)

    return anAsync
  }

export const withOnAbort =
  <T extends Effect>(): Fn<[T], T & { onAbort: Action<[], Error> }> =>
  (anAsync) => {
    // @ts-expect-error
    if (anAsync.onAbort === undefined) {
      // @ts-expect-error
      const onAbort = (anAsync.onAbort = action(
        anAsync.__reatom.name?.concat('.onAbort'),
      ))
      addOnUpdate(anAsync, (ctx, { state }) =>
        state
          .at(-1)
          ?.catch(
            (err: any) => err?.name === 'AbortError' && onAbort(ctx, err),
          ),
      )
    }
    return anAsync as T & { onAbort: any }
  }

export const withAbort = <
  T extends Fn<[Ctx, AbortController, ...any[]], Promise<any>>,
>(
  fn: T,
  shouldAbortStale = true,
): T extends Fn<[Ctx, AbortController, ...infer Input], infer Output>
  ? Fn<[Ctx, ...Input], Output>
  : never => {
  const controllerAtom = atom<null | AbortController>(null)
  // @ts-ignore
  return (ctx, ...a) => {
    if (shouldAbortStale) ctx.get(controllerAtom)?.abort('concurrent request')
    const controller = controllerAtom(ctx, new AbortController())!
    controller.signal.throwIfAborted ??= () => {
      if (controller.signal.aborted) {
        const error = new Error(controller.signal.reason)
        error.name = 'AbortError'
        throw error
      }
    }

    return fn(ctx, controller, ...a).then((resp) => {
      controllerAtom(ctx, null)
      controller.signal.throwIfAborted()
      return resp
    })
  }
}
