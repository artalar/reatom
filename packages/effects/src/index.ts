import {
  Atom,
  AtomCache,
  AtomReturn,
  Ctx,
  Fn,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'

export interface AbortError extends DOMException {
  name: 'AbortError'
}

const AbortError = (
  typeof DOMException === 'function' ? DOMException : Error
) as new (message: string) => AbortError

export const toAbortError = (reason: unknown): AbortError => {
  let error = reason as AbortError
  if (error instanceof Error) {
    if (error.name !== 'AbortError') {
      error = new AbortError(error.message)
      error.cause = reason
    }
  } else {
    reason = new AbortError(String(reason))
  }

  error.name = 'AbortError'

  return error
}

export const throwIfAborted = (controller?: void | AbortController) => {
  if (controller?.signal.aborted) {
    throw toAbortError(controller.signal.reason)
  }
}

export const isAbort = (thing: any): thing is AbortError =>
  thing instanceof Error && thing.name === 'AbortError'

/** Handle abort signal from a cause */
export const onCtxAbort = (ctx: Ctx, cb: Fn<[AbortError]>) => {
  let cause: null | (AtomCache & { controller?: AbortController }) = ctx.cause
  while (cause && !cause.controller) cause = cause.cause
  const controller = cause?.controller

  throwIfAborted(controller)

  controller?.signal.addEventListener('abort', () =>
    cb(toAbortError(controller.signal.reason)),
  )
}

const LISTENERS = new WeakMap<
  Promise<any>,
  {
    then: Array<Fn>
    catch: Array<Fn>
  }
>()
// TODO `reatomPromise`
/**
 * Subscribe to promise result with batching
 * @internal
 * @deprecated
 */
export const __thenReatomed = <T>(
  ctx: Ctx,
  promise: Promise<T>,
  onFulfill?: Fn<[value: T, read: Fn, actualize: Fn]>,
  onReject?: Fn<[error: unknown, read: Fn, actualize: Fn]>,
) => {
  let listeners = LISTENERS.get(promise)
  if (!listeners) {
    LISTENERS.set(promise, (listeners = { then: [], catch: [] }))

    promise.then(
      (value: any) =>
        ctx.get((read, actualize) =>
          listeners!.then.forEach((cb) => cb(value, read, actualize)),
        ),
      (error: any) =>
        ctx.get((read, actualize) =>
          listeners!.catch.forEach((cb) => cb(error, read, actualize)),
        ),
    )
  }

  onFulfill && listeners.then.push(onFulfill)
  onReject && listeners.catch.push(onReject)
}

/** @deprecated use `ctx.controller` which is AbortController instead */
export const disposable = (
  ctx: Ctx,
): Ctx & {
  dispose: Unsubscribe
} => {
  const _ctx = Object.assign({}, ctx)
  let isDisposed = false

  for (const key in ctx) {
    // @ts-expect-error
    const value = ctx[key]

    if (typeof value !== 'function') continue

    Object.assign(_ctx, {
      [key](...a: Array<any>) {
        throwReatomError(isDisposed, 'access to disposed context branch')

        if (key === 'schedule') {
          const [effect] = a
          a[0] = (...a: Array<any>) => {
            try {
              var promise = Promise.resolve(effect(...a))
            } catch (error) {
              promise = Promise.reject(error)
            }

            return promise.finally(() => {
              // stack it forever
              if (isDisposed) return new Promise(() => {})
            })
          }
        }

        return value.apply(this, a)
      },
    })
  }

  return Object.assign(_ctx, {
    dispose() {
      isDisposed = true
    },
  })
}

export const take = <T extends Atom, Res = AtomReturn<T>>(
  ctx: Ctx & { controller?: AbortController },
  anAtom: T,
  mapper: Fn<[Ctx, Awaited<AtomReturn<T>>], Res> = (ctx, v: any) => v,
): Promise<Awaited<Res>> =>
  new Promise<Awaited<Res>>((res: Fn, rej) => {
    onCtxAbort(ctx, rej)

    let skipFirst = true,
      un = ctx.subscribe(anAtom, (state) => {
        if (skipFirst) return (skipFirst = false)
        un()
        if (anAtom.__reatom.isAction) state = state[0].payload
        if (state instanceof Promise) {
          state.then((v) => res(mapper(ctx, v)), rej)
        } else {
          res(mapper(ctx, state))
        }
      })
    ctx.schedule(un, -1)
  })

export const takeNested = <I extends any[]>(
  ctx: Ctx & { controller?: AbortController },
  cb: Fn<[Ctx, ...I]>,
  ...params: I
): Promise<void> =>
  new Promise<void>((res, rej) => {
    onCtxAbort(ctx, rej)

    let i = 0,
      { schedule } = ctx

    return cb(
      Object.assign({}, ctx, {
        schedule(this: Ctx, cb: Fn, step?: -1 | 0 | 1 | 2) {
          return schedule.call<Ctx, Parameters<Ctx['schedule']>, Promise<any>>(
            this,
            (ctx) => {
              const result = cb(ctx)
              if (result instanceof Promise) {
                ++i
                result.finally(() => --i === 0 && res())
              }
              return result
            },
            step,
          )
        },
      }),
      ...params,
    )
  })
