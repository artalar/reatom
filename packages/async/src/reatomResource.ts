import {
  Atom,
  AtomCache,
  Ctx,
  Fn,
  __count,
  atom,
  throwReatomError,
  Unsubscribe,
  AtomProto,
} from '@reatom/core'
import {
  CauseContext,
  __thenReatomed,
  onCtxAbort,
  withAbortableSchedule,
} from '@reatom/effects'
import { merge, noop, toAbortError } from '@reatom/utils'

import { reatomAsync, AsyncAction, ControlledPromise, AsyncCtx } from '.'
import { onConnect } from '@reatom/hooks'
import { CacheAtom } from './withCache'

export interface ResourceAtom<Resp = any> extends AsyncAction<[], Resp> {
  promiseAtom: Atom<ControlledPromise<Resp>>
  init(ctx: Ctx): Unsubscribe
}

/**
 * @deprecated use ResourceAtom instead
 */
export interface AsyncReaction<Resp = any> extends ResourceAtom<Resp> {}

export interface AsyncCtxSpy extends AsyncCtx {
  spy: {
    <T>(anAtom: Atom<T>): T
  }
}

const resolved = new WeakSet<Promise<any>>()

export const reatomResource = <T>(
  asyncComputed: (ctx: AsyncCtxSpy) => Promise<T>,
  name = __count('asyncAtom'),
): ResourceAtom<T> => {
  const promises = new CauseContext<Promise<any>>()

  const theAsync = reatomAsync((ctx) => {
    const promise = promises.get(ctx.cause)
    throwReatomError(!promise, 'reaction manual call')
    return promise!
  }, name)
  const promiseAtom = atom((_ctx, state?: ControlledPromise<T>) => {
    if (state && !_ctx.cause.pubs.length) return state

    const params: any[] = []

    const ctx = merge(_ctx, {
      spy(anAtom: Atom, cb?: Fn) {
        throwReatomError(cb, 'spy reactions are unsupported in AsyncReaction')
        const value = _ctx.spy(anAtom)
        params.push(value)
        return value
      },
    }) as AsyncCtx

    const controller = new AbortController()
    onCtxAbort(ctx, (error) => controller.abort(error))
    ctx.controller = ctx.cause.controller = controller

    const computedPromise = asyncComputed(
      withAbortableSchedule(ctx) as AsyncCtxSpy,
    )
    computedPromise.catch(noop)
    promises.set(ctx.cause, computedPromise)

    const pendingBefore = ctx.get(theAsync.pendingAtom)
    const fulfillCallsBefore = ctx.get(theAsync.onFulfill)
    let promise = theAsync(
      ctx,
      // @ts-expect-error needed for cache handling
      ...params,
    )

    promise.controller.signal.addEventListener('abort', () => {
      type ReactionWithCache = AsyncReaction & {
        cacheAtom?: CacheAtom
      }
      if (!(theReaction as ReactionWithCache).cacheAtom?.options.ignoreAbort) {
        controller.abort(promise.controller.signal.reason)
      }
    })

    const cached = pendingBefore === ctx.get(theAsync.pendingAtom)
    const fulfillCalls = ctx.get(theAsync.onFulfill)
    if (cached) controller.abort(toAbortError('cached'))
    if (cached && fulfillCallsBefore !== fulfillCalls) {
      promise = Object.assign(
        Promise.resolve(fulfillCalls[fulfillCalls.length - 1]!.payload),
        { controller },
      )
    }

    __thenReatomed(ctx, promise, () => resolved.add(promise)).catch(noop)

    state?.controller.abort(toAbortError('concurrent'))

    return promise
  }, `${name}._promiseAtom`)

  onConnect(theAsync, (ctx) => ctx.subscribe(promiseAtom, noop))
  onConnect(promiseAtom, (ctx) => /* disconnect */ () => {
    const state = ctx.get(promiseAtom)
    state.controller.abort(ctx.controller.signal.reason)
    if (!resolved.has(state)) {
      dropCache(ctx, promiseAtom.__reatom)
    }
  })

  const theReaction = Object.assign(
    (ctx: Ctx) =>
      ctx.get((read, actualize) => {
        dropCache(ctx, promiseAtom.__reatom)
        // force update (needed if the atom is connected)
        actualize!(ctx, promiseAtom.__reatom, noop)
        const state = ctx.get(theAsync)
        const payload = state[state.length - 1]?.payload
        throwReatomError(
          !payload,
          'unexpectedly failed invalidation. Please, report the issue',
        )
        return payload!
      }),
    theAsync,
    {
      promiseAtom,
      init(ctx: Ctx) {
        return ctx.subscribe(promiseAtom, noop)
      },
    },
  ) as ResourceAtom<T>

  // `withCache` could be added only after theReaction return
  Object.defineProperty(theAsync, '_handleCache', {
    get() {
      return theReaction._handleCache
    },
  })

  return theReaction
}

const dropCache = (ctx: Ctx, proto: AtomProto) =>
  ctx.get((read, actualize) => {
    actualize!(ctx, proto, (patchCtx: Ctx, patch: AtomCache) => {
      patch.pubs = []
      patch.state = undefined
    })
  })

/**
 * @deprecated use reatomResource instead
 */
export const reatomAsyncReaction = reatomResource
