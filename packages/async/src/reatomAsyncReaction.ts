import { Atom, Fn, __count, atom, throwReatomError } from '@reatom/core'
import { CauseContext, onCtxAbort } from '@reatom/effects'
import { merge, noop, toAbortError } from '@reatom/utils'

import { reatomAsync, AsyncAction, ControlledPromise, AsyncCtx } from '.'
import { onConnect } from '@reatom/hooks'

export interface AsyncReaction<Resp> extends AsyncAction<[], Resp> {
  promiseAtom: Atom<ControlledPromise<Resp>>
}

export interface AsyncCtxSpy extends AsyncCtx {
  spy: {
    <T>(anAtom: Atom<T>): T
  }
}

export const reatomAsyncReaction = <T>(
  asyncComputed: (ctx: AsyncCtxSpy) => Promise<T>,
  name = __count('asyncAtom'),
): AsyncReaction<T> => {
  const promises = new CauseContext<Promise<any>>()

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
            if (step > 0 && cached)
              return Promise.reject(toAbortError('cached'))
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
      ctx.controller.abort(error),
    )

    if ((cached = pending === ctx.get(theAsync.pendingAtom))) {
      promises.get(ctx.cause)!.catch(noop)
      const fulfillCalls = ctx.get(theAsync.onFulfill)
      promise = Object.assign(
        Promise.resolve(fulfillCalls[fulfillCalls.length - 1]!.payload),
        { controller: ctx.controller },
      )
    }

    promise.catch(noop)

    state?.controller.abort('concurrent')

    return promise
  }, `${name}._promiseAtom`)

  onConnect(theAsync, (ctx) => ctx.subscribe(promiseAtom, noop))

  return Object.assign(theAsync, { promiseAtom }) as AsyncReaction<T>
}
