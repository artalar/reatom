import {
  Atom,
  AtomCache,
  AtomReturn,
  Ctx,
  Fn,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { __findCause } from '@reatom/hooks'

const LISTENERS = new WeakMap<Promise<any>, Array<Fn>>()
// TODO `reatomPromise`
/**
 * Subscribe to promise result with batching
 * @internal
 * @deprecated
 */
export const __thenReatomed = <T>(
  ctx: Ctx,
  promise: Promise<T>,
  onFulfill: Fn<[value: T, read: Fn, actualize: Fn]>,
) => {
  let listeners = LISTENERS.get(promise)
  if (!listeners) {
    LISTENERS.set(promise, (listeners = []))

    promise.then((value: any) =>
      ctx.get((read, actualize) =>
        listeners!.forEach((cb) => cb(value, read, actualize)),
      ),
    )
  }

  listeners.push(onFulfill)
}

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
    const signal =
      ctx.controller?.signal ??
      __findCause(
        ctx.cause,
        (cause: AtomCache & { controller?: AbortController }) =>
          cause.controller?.signal,
      )
    if (signal) {
      signal.throwIfAborted()
      signal.addEventListener('abort', () => rej(signal.reason))
    }

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
  })

export const takeNested = <I extends any[]>(
  ctx: Ctx & { controller?: AbortController },
  cb: Fn<[Ctx, ...I]>,
  ...params: I
): Promise<void> =>
  new Promise<void>((res, rej) => {
    const signal = ctx.controller?.signal
    if (signal) {
      signal.throwIfAborted()
      signal.addEventListener('abort', () => rej(signal.reason))
    }

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

// export const unstable_actionizeAllChanges = <T extends Rec<Atom> | Array<Atom>>(
//   shape: T,
//   name?: string,
// ): Action<
//   [NEVER],
//   {
//     [K in keyof T]: AtomState<T[K]>
//   }
// > => {
//   const cacheAtom = atom(
//     Object.keys(shape).reduce((acc, k) => ((acc[k] = SKIP), acc), {} as Rec),
//   )

//   const theAction = atom((ctx, state = []) => {
//     for (const key in shape) {
//       const anAtom = shape[key] as Atom
//       spyChange(ctx, anAtom, (value) => {
//         // if (anAtom.__reatom.isAction) {
//         //   if (value.length === 0) return
//         //   value = value[0]
//         // }
//         cacheAtom(ctx, (state) => ({ ...state, [key]: value }))
//       })
//     }

//     let cache = ctx.get(cacheAtom)

//     if (Object.values(cache).some((v) => v === SKIP)) return state

//     for (const key in shape) {
//       const anAtom = shape[key] as Atom
//       if (anAtom.__reatom.isAction === false) {
//         cache = { ...cache, [key]: ctx.get(anAtom) }
//       }
//     }

//     return [Array.isArray(shape) ? Object.values(cache) : cache]
//   }, name)
//   theAction.__reatom.isAction = true

//   return theAction as any
// }

// export const take
