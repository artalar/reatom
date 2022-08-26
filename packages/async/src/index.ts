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
import { addOnUpdate, onUpdate } from '@reatom/hooks'

export interface AsyncAction<Params extends any[] = any[], Resp = any>
  extends Action<Params, Promise<Resp>> {
  onFulfill: Action<[Resp], Resp>
  onReject: Action<[unknown], unknown>
  onSettle: Action<[], void>
  countAtom: Atom<number>
  pendingAtom: Atom<boolean>
  paramsAtom: Atom<null | Params>
  /** mutate it in tests */
  fnAtom: Atom<Fn<Params, Promise<Resp>>>
}

const NEVER = Symbol()

export const atomizeAsync = <
  Params extends [Ctx, ...any[]] = [Ctx, ...any[]],
  Resp = any,
>(
  fn: Fn<Params, Promise<Resp>>,
  name?: string,
): AsyncAction<CtxLessParams<Params>, Resp> => {
  type Self = AsyncAction<CtxLessParams<Params>, Resp>
  const fnAtom = atom(() => fn, name?.concat('.fn'))
  // @ts-ignore
  const onEffect: Self = action((ctx, ...a) => {
    paramsAtom(ctx, a)
    countAtom(ctx, (s) => ++s)
    const fn = ctx.get(fnAtom)

    // @ts-ignore
    return ctx.schedule(() => fn(ctx, ...a))
  }, name)

  const onFulfill: Self['onFulfill'] = action(name?.concat('.onFulfill'))
  const onReject: Self['onReject'] = action(name?.concat('.onReject'))
  const onSettle: Self['onSettle'] = action(name?.concat('.onSettle'))

  const countAtom = atom(0, name?.concat('.count'))
  // this "isLoading" state type is too utilized
  // to separate it to a additional `withPending` atom
  const pendingAtom: Self['pendingAtom'] = atom(
    (ctx) => ctx.spy(countAtom) > 0,
    name?.concat('.pending'),
  )

  const paramsAtom = atom<null | CtxLessParams<Params>>(
    null,
    name?.concat('.params'),
  )

  const fin = (ctx: Ctx, payload: any, isError: boolean) => {
    // FIXME: error here could broke things
    ctx.get(() => {
      countAtom(ctx, (s) => --s)
      isError
        ? payload?.name === 'AbortError' || onReject(ctx, payload)
        : onFulfill(ctx, payload)
      onSettle(ctx)
    })
  }

  addOnUpdate(
    onEffect,
    (ctx, patch: AtomCache<Array<Promise<Resp>>>) =>
      patch.state.at(-1)?.then(
        (v) => fin(ctx, v, false),
        (e) => fin(ctx, e, true),
      ),
    // couldn't use `finally` here because it creates extra tick
    // which allow user to get outdated data in `onEffect().then( here )`
  )

  return Object.assign(onEffect, {
    onFulfill,
    onReject,
    onSettle,
    countAtom,
    pendingAtom,
    paramsAtom,
    fnAtom,
  })
}

export const withDataAtom =
  <State = undefined, T extends AsyncAction = AsyncAction>(
    initState?: State,
  ): Fn<[T], T & { dataAtom: AtomMut<State | ActionResult<T['onFulfill']>> }> =>
  (anAsync) => {
    onUpdate(
      anAsync.onFulfill,
      // @ts-expect-error
      (anAsync.dataAtom = atom(
        initState,
        anAsync.__reatom.name?.concat('.dataAtom'),
      )),
    )

    return anAsync as T & { dataAtom: any }
  }

export const withErrorAtom =
  <T extends AsyncAction & { errorAtom?: AtomMut<undefined | Error> }>(
    parseError: Fn<[unknown], Error> = (e) =>
      e instanceof Error ? e : new Error(String(e)),
  ): Fn<[T], T & { errorAtom: AtomMut<undefined | Error> }> =>
  (anAsync) => {
    const errorAtom = (anAsync.errorAtom = atom<undefined | Error>(
      undefined,
      anAsync.__reatom.name?.concat('.errorAtom'),
    ))
    addOnUpdate(anAsync.onReject, (ctx, { state }) =>
      errorAtom(ctx, parseError(state[0])),
    )
    addOnUpdate(anAsync.onFulfill, (ctx) => errorAtom(ctx, undefined))

    return anAsync as T & { errorAtom: any }
  }

export const withRetry =
  <T extends AsyncAction & { retry?: Action<[], ActionResult<T>> }>(): Fn<
    [T],
    T & { retry: Action<[], ActionResult<T>> }
  > =>
  (anAsync) => {
    anAsync.retry = action((ctx) => {
      const params = ctx.get(anAsync.paramsAtom)
      throwReatomError(params === null, 'no cached params')
      return anAsync(ctx, ...params!) as ActionResult<T>
    }, anAsync.__reatom.name?.concat('.retry'))
    return anAsync as T & { retry: any }
  }

export const withFetchOnConnect =
  <T extends AsyncAction, Targets extends keyof T>(
    targets: Array<Targets>,
    params: ActionParams<T> | Fn<[Ctx], ActionParams<T>>,
  ): Fn<[T], T> =>
  (anAsync) => {
    const getPrams = typeof params === 'function' ? params : () => params
    const addHook = (anAtom: Atom) =>
      (anAtom.__reatom.onConnect ??= new Set()).add(
        (ctx: Ctx) =>
          ctx.get(anAsync.countAtom) === 0 && anAsync(ctx, ...getPrams(ctx)),
      )

    addHook(anAsync)
    for (const k of targets) addHook(anAsync[k] as any as Atom)

    return anAsync
  }

export const withOnAbort =
  <T extends AsyncAction & { onAbort?: Action<[Error], Error> }>(): Fn<
    [T],
    T & { onAbort: Action<[Error], Error> }
  > =>
  (anAsync) => {
    const onAbort = (anAsync.onAbort = action(
      anAsync.__reatom.name?.concat('.onAbort'),
    ))
    addOnUpdate(anAsync, (ctx, { state }) =>
      state
        .at(-1)
        ?.catch((err: any) => err?.name === 'AbortError' && onAbort(ctx, err)),
    )

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
