import {
  Atom,
  AtomCache,
  Ctx,
  Fn,
  __count,
  atom,
  throwReatomError,
} from '@reatom/core'
import { CauseContext, __thenReatomed, onCtxAbort } from '@reatom/effects'
import { merge, noop, toAbortError } from '@reatom/utils'

import { reatomAsync, AsyncAction, ControlledPromise, AsyncCtx } from '.'
import { isConnected, onConnect } from '@reatom/hooks'

export interface ReactiveAsync<Resp> extends AsyncAction<[], Resp> {
  promiseAtom: Atom<ControlledPromise<Resp>>
}

/**
 * @deprecated use ReactiveAsync instead
 */
export interface AsyncReaction<Resp> extends ReactiveAsync<Resp> {}

export interface AsyncCtxSpy extends AsyncCtx {
  spy: {
    <T>(anAtom: Atom<T>): T
  }
}

const resolved = new Set<Promise<any>>()

export const reatomReactiveAsync = <T>(
  asyncComputed: (ctx: AsyncCtxSpy) => Promise<T>,
  name = __count('asyncAtom'),
): ReactiveAsync<T> => {
  const promises = new CauseContext<Promise<any>>()

  const dropCache = (ctx: Ctx) =>
    ctx.get((read, actualize) => {
      actualize!(
        ctx,
        promiseAtom.__reatom,
        (patchCtx: Ctx, patch: AtomCache) => {
          patch.pubs = []
        },
      )
    })

  const theAsync = reatomAsync((ctx) => {
    const promise = promises.get(ctx.cause)
    throwReatomError(!promise, 'reaction manual call')
    return promise!
  }, name)
  const promiseAtom = atom((_ctx, state?: ControlledPromise<T>) => {
    const { schedule, spy } = _ctx
    const params: any[] = []
    let cached = false

    const ctx = merge(_ctx, {
      schedule(cb: Fn, step = 1) {
        return schedule.call(
          this,
          () => {
            if (step > 0) {
              // TODO
              // if (ctx.controller.signal.aborted) {
              //   return Promise.reject(
              //     toAbortError(ctx.controller.signal.reason),
              //   )
              // }
              if (cached) {
                return Promise.reject(toAbortError('cached'))
              }
            }
            return cb(ctx)
          },
          step as any,
        )
      },
      spy(anAtom: Atom, cb?: Fn) {
        throwReatomError(cb, 'spy reactions are unsupported in AsyncAtom')

        // @ts-expect-error overloads mismatch
        const value = spy.call(ctx, anAtom) as T
        params.push(value)
        return value instanceof Promise
          ? value.then((v) => {
              if (cached) throw toAbortError('cached')
              return v
            })
          : value
      },
    }) as AsyncCtx

    onCtxAbort(ctx, (error) => ctx.controller.abort(error))
    ctx.controller = ctx.cause.controller = new AbortController()

    promises.set(ctx.cause, asyncComputed(ctx as AsyncCtxSpy))

    const pending = ctx.get(theAsync.pendingAtom)
    let promise = theAsync(
      ctx,
      // @ts-expect-error needed for cache handling
      ...params,
    )

    promise.controller.signal.addEventListener('abort', (error) =>
      ctx.controller.abort(promise.controller.signal.reason),
    )

    if ((cached = pending === ctx.get(theAsync.pendingAtom))) {
      promises.get(ctx.cause)!.catch(noop)
      const fulfillCalls = ctx.get(theAsync.onFulfill)
      promise = Object.assign(
        Promise.resolve(fulfillCalls[fulfillCalls.length - 1]!.payload),
        { controller: ctx.controller },
      )
    }

    __thenReatomed(ctx, promise, () => resolved.add(promise)).catch(noop)

    state?.controller.abort(toAbortError('concurrent'))

    return promise
  }, `${name}._promiseAtom`)

  onConnect(theAsync, (ctx) => ctx.subscribe(promiseAtom, noop))
  onConnect(promiseAtom, (ctx) => {
    ctx.controller.signal.addEventListener('abort', () => {
      const state = ctx.get(promiseAtom)

      if (resolved.has(state)) return

      if (!isConnected(ctx, promiseAtom) && state.controller.signal.aborted) {
        dropCache(ctx)
      }

      state.controller.abort(ctx.controller.signal.reason)
    })
  })

  const theReaction = Object.assign(
    (...a: Parameters<typeof theAsync>) => {
      const [ctx] = a
      return ctx.get((read, actualize) => {
        dropCache(ctx)
        // force update (needed if the atom is connected)
        actualize!(
          ctx,
          promiseAtom.__reatom,
          (patchCtx: Ctx, patch: AtomCache) => {
            patch.state
          },
        )
        const state = ctx.get(theAsync)
        const payload = state[state.length - 1]?.payload
        throwReatomError(!payload, 'failed invalidation')
        return payload!
      })
    },
    theAsync,
    { promiseAtom },
  ) as ReactiveAsync<T>

  Object.defineProperty(theAsync, '_handleCache', {
    get() {
      return theReaction._handleCache
    },
  })

  return theReaction
}

/**
 * @deprecated use reatomReactiveAsync instead
 */
export const reatomAsyncReaction = reatomReactiveAsync
