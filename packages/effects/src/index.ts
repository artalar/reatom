import {
  Atom,
  AtomReturn,
  Ctx,
  Fn,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'

const REATOM_THEN = Symbol('REATOM_THEN')
const REATOM_CATCH = Symbol('REATOM_CATCH')
/**
 * Subscribe to promise result with batching
 * @internal
 * @deprecated
 */
export const __thenReatomed = <T>(
  ctx: Ctx,
  promise: Promise<T>,
  onFulfill?: Fn<[T, Fn, Fn]>,
  onReject?: Fn<[unknown, Fn, Fn]>,
) => {
  // @ts-expect-error
  let thenListeners: Array<Fn> = promise[REATOM_THEN]
  // @ts-expect-error
  let catchListeners: Array<Fn> = promise[REATOM_CATCH]

  const resolver =
    (listeners: typeof thenListeners | typeof catchListeners) => (value: any) =>
      ctx.get((read, actualize) =>
        listeners.forEach((cb) => cb(value, read, actualize)),
      )

  if (thenListeners == undefined) {
    Object.defineProperties(promise, {
      [REATOM_THEN]: {
        value: (thenListeners = []),
        enumerable: false,
      },
      [REATOM_CATCH]: {
        value: (catchListeners = []),
        enumerable: false,
      },
    }).then(resolver(thenListeners), resolver(catchListeners))
  }

  if (onFulfill) thenListeners.push(onFulfill)
  if (onReject) catchListeners.push(onReject)
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
  ctx: Ctx,
  anAtom: T,
  mapper: Fn<[Ctx, Awaited<AtomReturn<T>>], Res> = (ctx, v: any) => v,
): Promise<Awaited<Res>> =>
  new Promise<Awaited<Res>>((res: Fn, rej) => {
    let skipFirst = true,
      fn = ctx.subscribe(anAtom, (state) => {
        if (skipFirst) return (skipFirst = false)
        fn()
        if (anAtom.__reatom.isAction) state = state[0].payload
        if (state instanceof Promise) state.then((v) => res(mapper(ctx, v)), rej)
        res(mapper(ctx, state))
      })
  })

export const takeNested = (ctx: Ctx, cb: Fn<[Ctx]>): Promise<any> =>
  new Promise<void>((r) => {
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
                result.finally(() => --i === 0 && r())
              }
              return result
            },
            step,
          )
        },
      }),
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
