// TODO https://hyperfetch.bettertyped.com/docs/Getting%20Started/Comparison/
// TODO https://github.com/natemoo-re/ultrafetch

import {
  action,
  Action,
  ActionParams,
  ActionPayload,
  atom,
  Atom,
  AtomMut,
  Ctx,
  CtxParams,
  Fn,
  throwReatomError,
  __count,
  AtomCache,
  Unsubscribe,
  AtomState,
  isAction,
} from '@reatom/core'
import {
  __thenReatomed,
  onCtxAbort,
  withAbortableSchedule,
} from '@reatom/effects'
import { assign, isAbort, noop, sleep, toAbortError } from '@reatom/utils'

import { handleEffect } from './handleEffect'
export { withCache } from './withCache'
export { withStatusesAtom } from './withStatusesAtom'
export type {
  AsyncStatusesNeverPending,
  AsyncStatusesFirstPending,
  AsyncStatusesFulfilled,
  AsyncStatusesRejected,
  AsyncStatusesAnotherPending,
  AsyncStatusesPending,
  AsyncStatuses,
  AsyncStatusesAtom,
} from './withStatusesAtom'
export { reatomAsyncReaction, AsyncReaction } from './reatomAsyncReaction'

export interface AsyncAction<Params extends any[] = any[], Resp = any>
  extends Action<Params, ControlledPromise<Resp>> {
  onFulfill: Action<[Resp], Resp>
  onReject: Action<[unknown], unknown>
  onSettle: Action<[], void>
  pendingAtom: Atom<number>

  /** @deprecated @internal */
  _handleCache?: Action<Params, ControlledPromise<Resp>>
}

export type AsyncResp<T extends AsyncAction> = ActionPayload<T['onFulfill']>

export interface AsyncCause extends AtomCache {
  controller: AbortController
}

export interface AsyncCtx extends Ctx {
  controller: AbortController
  cause: AsyncCause
}

export interface AsyncOptions<Params extends any[] = any[], Resp = any> {
  name?: string
  onEffect?: Fn<[Ctx, Params, ControlledPromise<Resp>]>
  onFulfill?: Fn<[Ctx, Resp]>
  onReject?: Fn<[Ctx, unknown]>
  onSettle?: Fn<[Ctx]>
}

export interface ControlledPromise<T = any> extends Promise<T> {
  controller: AbortController
}

export const isAbortError = isAbort

const getCache = (ctx: Ctx, anAtom: Atom): AtomCache => {
  ctx.get(anAtom)
  return anAtom.__reatom.patch ?? ctx.get((read) => read(anAtom.__reatom))!
}

export const unstable_dropController = (ctx: Ctx): AsyncCtx => {
  const controller = new AbortController()
  return {
    ...ctx,
    cause: {
      ...ctx.cause,
      controller,
    },
    controller,
  }
}

export const reatomAsync = <
  Params extends [AsyncCtx, ...any[]] = [AsyncCtx, ...any[]],
  Resp = any,
>(
  effect: Fn<Params, Promise<Resp>>,
  options: string | AsyncOptions<CtxParams<Params>, Resp> = {},
): AsyncAction<CtxParams<Params>, Resp> => {
  const {
    name = __count('async'),
    onEffect: onEffectHook,
    onFulfill: onFulfillHook,
    onReject: onRejectHook,
    onSettle: onSettleHook,
  } = typeof options === 'string'
    ? ({ name: options } as AsyncOptions<CtxParams<Params>, Resp>)
    : options

  const pendingAtom = atom(0, `${name}.pendingAtom`)

  // @ts-expect-error the missed properties assigned later
  const onEffect: AsyncAction = Object.assign(
    // do not put this function inside `action` to not broke effect mocking
    (...params: Params) =>
      params[0].get((read, actualize) => {
        const { state } = actualize!(
          params[0],
          onEffect.__reatom,
          (ctx: AsyncCtx, patch: AtomCache) => {
            // userspace controller
            ctx.controller = ctx.cause.controller = new AbortController()

            onCtxAbort(params[0], (error) => ctx.controller.abort(error))

            params[0] = withAbortableSchedule(ctx)

            patch.state = [
              ...patch.state,
              {
                params: params.slice(1),
                payload: onEffect._handleCache
                  ? // @ts-expect-error
                    onEffect._handleCache(...params)
                  : handleEffect(onEffect, params),
              },
            ]
          },
        )
        return state[state.length - 1]!.payload
      }),
    action(
      // @ts-expect-error TODO need a better way to pass a custom Ctx.
      effect,
      name,
    ),
  )

  const onFulfill = action<Resp>(`${name}.onFulfill`)
  const onReject = action<unknown>(`${name}.onReject`)
  const onSettle = action(`${name}._onSettle`)

  onFulfill.onCall((ctx) => onSettle(ctx))
  onReject.onCall((ctx) => onSettle(ctx))

  if (onEffectHook) {
    onEffect.onCall((ctx, promise, params) =>
      onEffectHook(ctx, params as any, promise),
    )
  }
  if (onFulfillHook) onFulfill.onCall(onFulfillHook)
  if (onRejectHook) onReject.onCall(onRejectHook)
  if (onSettleHook) onSettle.onCall(onSettleHook)

  return assign(onEffect, {
    onFulfill,
    onReject,
    onSettle,
    pendingAtom,
  })
}
reatomAsync.from = <Params extends any[], Resp = any>(
  effect: Fn<Params, Promise<Resp>>,
  options: string | AsyncOptions<Params, Resp> = {},
): AsyncAction<Params, Resp> => {
  // check uglification
  if (effect.name.length > 2) {
    if (typeof options === 'object') options.name ??= effect.name
    else options ??= effect.name
  }
  // @ts-expect-error
  return reatomAsync((ctx, ...a) => effect(...a), options)
}

export interface AsyncDataAtom<State = any> extends AtomMut<State> {
  reset: Action<[], void>
  mapFulfill?: Fn<[ctx: Ctx, payload: unknown, state: State], State>
}

// TODO
// @ts-ignore
export const withDataAtom: {
  <
    T extends AsyncAction & {
      dataAtom?: AsyncDataAtom<AsyncResp<T>>
    },
  >(): Fn<[T], T & { dataAtom: AtomMut<undefined | AsyncResp<T>> }>
  <
    T extends AsyncAction & {
      dataAtom?: AsyncDataAtom<AsyncResp<T>>
    },
  >(
    initState: AsyncResp<T>,
  ): Fn<[T], T & { dataAtom: AsyncDataAtom<AsyncResp<T>> }>
  <
    T extends AsyncAction & {
      dataAtom?: AsyncDataAtom<State | AsyncResp<T>>
    },
    State,
  >(
    initState: State,
  ): Fn<[T], T & { dataAtom: AsyncDataAtom<State | AsyncResp<T>> }>
  <
    T extends AsyncAction & {
      dataAtom?: AsyncDataAtom<AsyncResp<T>>
    },
  >(
    initState: AsyncResp<T>,
    map?: Fn<
      [ctx: Ctx, payload: AsyncResp<T>, state: AsyncResp<T>],
      AsyncResp<T>
    >,
  ): Fn<[T], T & { dataAtom: AsyncDataAtom<AsyncResp<T>> }>
  <
    T extends AsyncAction & {
      dataAtom?: AsyncDataAtom<State>
    },
    State,
  >(
    initState: State,
    map?: Fn<[ctx: Ctx, payload: AsyncResp<T>, state: State], State>,
  ): Fn<[T], T & { dataAtom: AsyncDataAtom<State> }>
} =
  (initState: any, mapFulfill?: Fn) =>
  // @ts-ignore
  (anAsync: AsyncAction & { dataAtom?: AsyncDataAtom }) => {
    if (!anAsync.dataAtom) {
      const dataAtom: AsyncDataAtom = (anAsync.dataAtom = Object.assign(
        atom(initState, `${anAsync.__reatom.name}.dataAtom`),
        {
          reset: action(
            (ctx) => void dataAtom(ctx, initState),
            `${anAsync.__reatom.name}.dataAtom.reset`,
          ),
          mapFulfill,
        },
      ) as AsyncDataAtom)
      anAsync.onFulfill.onCall((ctx, payload) =>
        dataAtom(ctx, (state: any) =>
          mapFulfill ? mapFulfill(ctx, payload, state) : payload,
        ),
      )
    }

    return anAsync
  }

export const withErrorAtom =
  <
    T extends AsyncAction & {
      errorAtom?: AtomMut<undefined | Err> & { reset: Action }
    },
    Err = Error,
  >(
    parseError: Fn<[Ctx, unknown], Err> = (ctx, e) =>
      (e instanceof Error ? e : new Error(String(e))) as Err,
    {
      resetTrigger,
    }: {
      resetTrigger:
        | null
        | 'onEffect'
        | 'onFulfill'
        | ('dataAtom' extends keyof T ? 'dataAtom' : null)
    } = {
      resetTrigger: 'onEffect',
    },
  ): Fn<[T], T & { errorAtom: Atom<undefined | Err> & { reset: Action } }> =>
  (anAsync) => {
    if (!anAsync.errorAtom) {
      const errorAtomName = `${anAsync.__reatom.name}.errorAtom`
      const errorAtom = (anAsync.errorAtom = assign(
        atom<undefined | Err>(undefined, errorAtomName),
        {
          reset: action((ctx) => {
            errorAtom(ctx, undefined)
          }, `${errorAtomName}.reset`),
        },
      ))
      anAsync.onReject.onCall((ctx, payload) =>
        errorAtom(ctx, parseError(ctx, payload)),
      )
      if (resetTrigger) {
        const resetTriggerAtom = { ...anAsync, onEffect: anAsync }[
          resetTrigger
        ] as Atom

        resetTriggerAtom.onChange((ctx) => {
          if (ctx.get(errorAtom) !== undefined) {
            errorAtom.reset(ctx)
          }
        })
      }
    }

    return anAsync as T & { errorAtom: Atom<undefined | Err> }
  }

export const withAbort =
  <
    T extends AsyncAction & {
      abort?: Action<[reason?: string], void>
      onAbort?: Action<[Error], Error>
      abortControllerAtom?: Atom<AbortController | null>
    },
  >({
    strategy = 'last-in-win',
  }: { strategy?: 'none' | 'last-in-win' | 'first-in-win' } = {}): Fn<
    [T],
    T & {
      abort: Action<[reason?: string], void>
      onAbort: Action<[Error], Error>
      abortControllerAtom: Atom<AbortController | null>
    }
  > =>
  (anAsync) => {
    if (!anAsync.abort) {
      const abortControllerAtom = (anAsync.abortControllerAtom = atom(
        (
          ctx,
          state: AbortController & {
            settled?: boolean
          } = new AbortController(),
        ) => {
          ctx.spy(anAsync, ({ payload: promise }) => {
            if (strategy === 'last-in-win' && state) {
              const controller = state

              ctx.schedule(() => {
                controller.abort(
                  toAbortError('concurrent request (last-in-win)'),
                )
              })
            }

            if (strategy === 'first-in-win' && state && !state.settled) {
              promise.controller.abort(
                toAbortError('concurrent request (first-in-win)'),
              )
              return
            }

            state = promise.controller

            const handleAbort = () => {
              state.settled = true
              anAsync.onAbort!(ctx, toAbortError(state.signal.reason))
            }

            state.signal.addEventListener('abort', handleAbort)

            const removeAbortHandler = () =>
              state.signal.removeEventListener('abort', handleAbort)

            __thenReatomed(ctx, promise, removeAbortHandler, removeAbortHandler)
          })

          return state
        },
        `${anAsync.__reatom.name}._abortControllerAtom`,
      ))
      // force track computed atom
      anAsync.onCall((ctx) => void ctx.get(abortControllerAtom))
      // addOnUpdate(anAsync.onSettle, (ctx) => void ctx.get(abortControllerAtom))

      anAsync.abort = action((ctx, reason?: string) => {
        const controller = ctx.get(abortControllerAtom)
        if (controller) {
          const error = toAbortError(reason)
          ctx.schedule(() => controller.abort(error))
        }
      }, `${anAsync.__reatom.name}.abort`)
      anAsync.onAbort = action<Error>(`${anAsync.__reatom.name}.onAbort`)
    }

    return anAsync as T & {
      abort: Action<[reason?: string], void>
      onAbort: Action<[Error], Error>
      abortControllerAtom: Atom<AbortController | null>
    }
  }

export const withRetry =
  <
    T extends AsyncAction & {
      paramsAtom?: Atom<Params | ActionParams<T>>
      retry?: Action<[after?: number], ActionPayload<T>>
      retriesAtom?: Atom<number>
    },
    Params extends ActionParams<T> | undefined = undefined,
  >({
    fallbackParams,
    onReject,
  }: {
    fallbackParams?: Params
    onReject?: Fn<[ctx: Ctx, error: unknown, retries: number], void | number>
  } = {}): Fn<
    [T],
    T & {
      paramsAtom: Atom<undefined | ActionParams<T>>
      retry: Action<[after?: number], ActionPayload<T>>
      retriesAtom: Atom<number>
    }
  > =>
  (anAsync) => {
    if (!anAsync.paramsAtom) {
      const paramsAtom = (anAsync.paramsAtom = atom(
        fallbackParams as Params,
        `${anAsync.__reatom.name}._paramsAtom`,
      ))
      anAsync.onCall((ctx, payload, params) =>
        paramsAtom(ctx, params as Params),
      )

      anAsync.retry = action((ctx, after = 0): ActionPayload<T> => {
        throwReatomError(after < 0, 'wrong timeout')

        const params = ctx.get(anAsync.paramsAtom!)
        throwReatomError(!params, 'no cached params')

        const asyncSnapshot = getCache(ctx, anAsync)
        const hasOtherCall = () => asyncSnapshot !== getCache(ctx, anAsync)

        retriesAtom(ctx, (s) => s + 1)

        return ctx.schedule(async () => {
          if (after > 0) await sleep(after)

          if (hasOtherCall()) {
            throw toAbortError('outdated retry')
          }

          return await anAsync(ctx, ...params!)
        }) as ActionPayload<T>
      }, `${anAsync.__reatom.name}.retry`)

      const retriesAtom = (anAsync.retriesAtom = atom(
        0,
        `${anAsync.__reatom.name}.retriesAtom`,
      ))

      if (onReject) {
        anAsync.onCall((ctx, payload) => {
          __thenReatomed(
            ctx,
            payload,
            () => retriesAtom(ctx, 0),
            (error) => {
              if (isAbort(error)) return
              const timeout = onReject(ctx, error, ctx.get(retriesAtom)) ?? -1

              if (timeout < 0) return

              anAsync.retry!(unstable_dropController(ctx), timeout).catch(noop)
            },
          )
        })
      }
    }

    return anAsync as T & {
      paramsAtom: Atom<undefined | ActionParams<T>>
      retry: Action<[], ActionPayload<T>>
      retriesAtom: Atom<number>
    }
  }

/** @deprecated use `withRetry` instead */
export const withRetryAction = withRetry

export interface MappedAsyncAction<
  Params extends any[] = unknown[],
  Payload = unknown,
> extends AsyncAction<Params, Payload> {
  /**
   * Function that unsubscribes from source atom
   * @experimental
   */
  unstable_unhook: Unsubscribe
}

/**
 * Transform atom state into reatomAsync arguments
 */
export function mapToAsync<T extends Atom, Res>(
  effect: Fn<[AsyncCtx, AtomState<T>], Promise<Res>>,
  options: AsyncOptions<[AtomState<T>], Res> = {},
): Fn<[T], MappedAsyncAction<[AtomState<T>], Res>> {
  return (sourceAtom: Atom) => {
    const asyncAction = reatomAsync(effect, {
      ...options,
      name: options.name ?? `${sourceAtom.__reatom.name}.mapToAsync`,
    }) as MappedAsyncAction<[AtomState<T>], Res>
    asyncAction.unstable_unhook = sourceAtom.onChange(asyncAction)

    return asyncAction
  }
}
