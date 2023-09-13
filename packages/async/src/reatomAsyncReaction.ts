import { Atom, CtxSpy, Fn, __count, atom, throwReatomError } from '@reatom/core'
import { CauseContext } from '@reatom/effects'
import { merge, noop, toAbortError } from '@reatom/utils'

import { reatomAsync, AsyncAction, ControlledPromise } from '.'

export interface AsyncReaction<Resp> extends AsyncAction<[], Resp> {
  promiseAtom: Atom<ControlledPromise<Resp>>
}

export const reatomAsyncReaction = <T>(
  asyncComputed: (ctx: CtxSpy) => Promise<T>,
  name = __count('asyncAtom'),
): AsyncReaction<T> => {
  const promises = new CauseContext<Promise<any>>()

  const theAsync = reatomAsync((ctx) => {
    const promise = promises.get(ctx.cause)
    throwReatomError(!promise, 'reaction manual call')
    return promise!
  }, name)
  const promiseAtom = atom((ctx, state?: ControlledPromise<T>) => {
    const { schedule, spy } = ctx
    const params: any[] = []
    let cached = false

    ctx = merge(ctx, {
      schedule(cb: Fn, step = 1) {
        return schedule.call(
          this,
          () => {
            if (step > 0 && cached) return Promise.reject(toAbortError('cached'))
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
    })

    promises.set(ctx.cause, asyncComputed(ctx))

    const pending = ctx.get(theAsync.pendingAtom)
    const promise = theAsync(
      ctx,
      // @ts-expect-error needed for cache handling
      ...params,
    )

    if ((cached = pending === ctx.get(theAsync.pendingAtom))) {
      promises.get(ctx.cause)!.catch(noop)
    }

    state?.controller.abort('concurrent')

    return promise
  }, `${name}._promiseAtom`)

  return Object.assign(theAsync, { promiseAtom }) as AsyncReaction<T>
}
