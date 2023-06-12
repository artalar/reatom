import {
  Atom,
  AtomCache,
  AtomReturn,
  Ctx,
  Fn,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { AbortError, throwIfAborted, toAbortError } from '@reatom/utils'

/** Handle abort signal from a cause */
export const onCtxAbort = (ctx: Ctx, cb: Fn<[AbortError]>) => {
  const find = () => {
    let cause: null | (AtomCache & { controller?: AbortController }) = ctx.cause
    while (cause && !cause.controller) cause = cause.cause
    const controller = cause?.controller

    if (controller) {
      const handler = () => cb(toAbortError(controller.signal.reason))

      if (controller.signal.aborted) handler()
      else controller?.signal.addEventListener('abort', handler)
    }

    return controller
  }
  if (!find()) ctx.schedule(find)
}

const CHAINS = new WeakMap<
  Promise<any>,
  {
    promise: Promise<any>
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
  origin: Promise<T>,
  onFulfill?: Fn<[value: T, read: Fn, actualize: Fn]>,
  onReject?: Fn<[error: unknown, read: Fn, actualize: Fn]>,
): Promise<T> => {
  let chain = CHAINS.get(origin)
  if (!chain) {
    const promise = origin
      .then(
        (value: any) => {
          ctx.get((read, actualize) =>
            chain!.then.forEach((cb) => cb(value, read, actualize)),
          )
          return value
        },
        (error: any) => {
          ctx.get((read, actualize) =>
            chain!.catch.forEach((cb) => cb(error, read, actualize)),
          )
          throw error
        },
      )
      // need to chain caught promise to not prevent error propagation
      .then((v) => v)

    CHAINS.set(origin, (chain = { promise, then: [], catch: [] }))
    CHAINS.set(promise, chain)
  }

  onFulfill && chain.then.push(onFulfill)
  onReject && chain.catch.push(onReject)

  return chain.promise
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
