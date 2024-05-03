import {
  __count,
  atom,
  Atom,
  AtomCache,
  AtomProto,
  AtomReturn,
  Ctx,
  CtxSpy,
  Fn,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import {
  AbortError,
  isAbort,
  merge,
  noop,
  throwIfAborted,
  toAbortError,
} from '@reatom/utils'

export class CauseContext<T> extends WeakMap<AtomCache, T> {
  has(cause: AtomCache): boolean {
    return super.has(cause) || (cause.cause !== null && this.has(cause.cause))
  }
  get(cause: AtomCache): T | undefined {
    while (!super.has(cause) && cause.cause) {
      cause = cause.cause
    }
    return super.get(cause)
  }
}

export const abortCauseContext = new CauseContext<AbortController | undefined>()

export const getTopController = (
  patch: AtomCache & { controller?: AbortController },
): null | AbortController => abortCauseContext.get(patch) ?? null

/** Handle abort signal from a cause */
export const onCtxAbort = (
  ctx: Ctx,
  cb: Fn<[AbortError]>,
): undefined | Unsubscribe => {
  const controller = getTopController(ctx.cause)

  if (controller) {
    const handler = () => cb(toAbortError(controller.signal.reason))
    const cleanup = () =>
      controller.signal.removeEventListener('abort', handler)

    // TODO schedule
    if (controller.signal.aborted) handler()
    else {
      controller.signal.addEventListener('abort', handler)
      ctx.schedule(
        () => controller.signal.removeEventListener('abort', handler),
        -1,
      )
      return cleanup
    }
  }
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
    const promise = origin.then(
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
        // prevent Uncaught DOMException for aborts
        if (isAbort(error)) promise.catch(noop)
        throw error
      },
    )

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

const skip: unique symbol = Symbol()
type skip = typeof skip
export const take = <T extends Atom, Res = AtomReturn<T>>(
  ctx: Ctx,
  anAtom: T,
  mapper: Fn<[Ctx, Awaited<AtomReturn<T>>, skip], Res | skip> = (ctx, v: any) =>
    v,
): Promise<Awaited<Res>> => {
  const cleanups: Array<Fn> = []
  return new Promise<Awaited<Res>>((res: Fn, rej) => {
    cleanups.push(
      onCtxAbort(ctx, rej) ?? noop,
      ctx.subscribe(anAtom, async (state) => {
        // skip the first sync call
        if (!cleanups.length) return

        try {
          if (anAtom.__reatom.isAction) state = state[0].payload
          const value = await state
          const result = mapper(ctx, value, skip)
          if (result !== skip) res(result)
        } catch (error) {
          rej(error)
        }
      }),
    )
  }).finally(() => cleanups.forEach((cb) => cb()))
}

export const takeNested = <I extends any[]>(
  ctx: Ctx,
  cb: Fn<[Ctx, ...I]>,
  ...params: I
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const unabort = onCtxAbort(ctx, reject)

    let i = 1 // one for extra check
    const { schedule } = ctx
    const check = () => {
      if (i === 0) {
        unabort?.()
        resolve()
      }

      // add extra tick to make sure there is no microtask races
      if (--i === 0) Promise.resolve().then(check)
    }

    const result = cb(
      Object.assign({}, ctx, {
        schedule(this: Ctx, cb: Fn, step?: -1 | 0 | 1 | 2) {
          return schedule.call<Ctx, Parameters<Ctx['schedule']>, Promise<any>>(
            this,
            (ctx) => {
              const result = cb(ctx)
              if (result instanceof Promise) {
                ++i
                result.finally(check).catch(noop)
              }
              return result
            },
            step,
          )
        },
      }),
      ...params,
    )

    check()

    return result
  })

const _isCausedBy = (cause: AtomCache, proto: AtomProto): boolean =>
  cause.cause !== null &&
  (cause.cause.proto === proto || isCausedBy(cause.cause, proto))

export const isCausedBy = (
  caused: Ctx | AtomCache,
  by: Atom | AtomProto,
): boolean =>
  _isCausedBy(
    'subscribe' in caused ? caused.cause : caused,
    '__reatom' in by ? by.__reatom : by,
  )

export const withAbortableSchedule = <T extends Ctx>(ctx: T): T => {
  const { schedule } = ctx

  return merge(ctx, {
    schedule(
      this: Ctx,
      cb: Parameters<typeof schedule>[0],
      step: Parameters<typeof schedule>[1] = 1,
    ) {
      if (step < 1) return schedule.call(this, cb, step)

      let resolve: Fn
      let reject: Fn
      const promise = new Promise((res, rej) => {
        resolve = res
        reject = rej
      })
      // do not wait the effect if the abort occurs
      const unabort = onCtxAbort(this, (error) => {
        // prevent unhandled error for abort
        promise.catch(noop)
        reject(error)
      })
      schedule
        .call(
          this,
          async (_ctx) => {
            try {
              const controller = getTopController(this.cause)
              throwIfAborted(controller)
              const value = await cb(_ctx)
              throwIfAborted(controller)
              resolve(value)
            } catch (error) {
              reject(error)
            }
            unabort?.()
          },
          step,
        )
        .catch((error) => {
          reject(error)
          unabort?.()
        })

      return promise
    },
  })
}

export const concurrent = <T extends Fn<[Ctx, ...any[]]>>(fn: T): T => {
  const abortControllerAtom = atom<null | AbortController>(
    null,
    `${__count('_concurrent')}.abortControllerAtom`,
  )

  return Object.assign(
    (ctx: Ctx, ...a: any[]) => {
      const prevController = ctx.get(abortControllerAtom)
      // do it outside of the schedule to save the call stack
      const abort = toAbortError('concurrent')
      // TODO it is better to do it sync?
      if (prevController) ctx.schedule(() => prevController.abort(abort))

      const unabort = onCtxAbort(ctx, (error) => {
        // prevent unhandled error for abort
        if (res instanceof Promise) res.catch(noop)
        controller.abort(error)
      })
      const controller = abortControllerAtom(ctx, new AbortController())!
      ctx = { ...ctx, cause: { ...ctx.cause } }
      abortCauseContext.set(ctx.cause, controller)

      var res = fn(withAbortableSchedule(ctx), ...a)
      if (res instanceof Promise) {
        res = res.finally(() => {
          unabort?.()
          throwIfAborted(controller)
        })
        // prevent uncaught rejection for the abort
        controller.signal.addEventListener('abort', () => {
          res.catch(noop)
        })

        return res
      }
      return res
    },
    // if the `fn` is an atom we need to assign all related properties
    fn,
  )
}

export const spawn = <Args extends any[], Payload>(
  ctx: Ctx,
  fn: Fn<[Ctx, ...Args], Payload>,
  args: Args = [] as any[] as Args,
  controller = new AbortController(),
): Payload => {
  ctx = { ...ctx, cause: { ...ctx.cause } }
  abortCauseContext.set(ctx.cause, controller)
  return fn(ctx, ...args)
}
