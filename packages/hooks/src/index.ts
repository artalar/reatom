import {
  action,
  Action,
  atom,
  Atom,
  AtomCache,
  AtomState,
  Ctx,
  CtxSpy,
  Fn,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { toAbortError } from '@reatom/utils'

export const getRootCause = (cause: AtomCache): AtomCache =>
  cause.cause === null ? cause : getRootCause(cause.cause)

export const isSameCtx = (ctx1: Ctx, ctx2: Ctx) =>
  getRootCause(ctx1.cause) === getRootCause(ctx2.cause)

export const addOnConnect = (anAtom: Atom, cb: Fn<[Ctx]>) =>
  (anAtom.__reatom.connectHooks ??= new Set()).add(cb)

export const addOnDisconnect = (anAtom: Atom, cb: Fn<[Ctx]>) =>
  (anAtom.__reatom.disconnectHooks ??= new Set()).add(cb)

export const addOnUpdate = <T extends Atom>(
  anAtom: T,
  cb: Fn<[Ctx, AtomCache<AtomState<T>>]>,
) => (anAtom.__reatom.updateHooks ??= new Set()).add(cb)

export const withInit =
  <T extends Atom>(
    createState: Fn<[Ctx, T['__reatom']['initState']], AtomState<T>>,
  ): Fn<[T], T> =>
  (anAtom) => {
    const { initState, isAction } = anAtom.__reatom

    throwReatomError(isAction, 'action state is not manageable')

    anAtom.__reatom.initState = (ctx) => createState(ctx, initState)

    return anAtom
  }

export const onConnect = (
  anAtom: Atom,
  cb: Fn<[Ctx & { controller: AbortController; isConnected(): boolean }]>,
): Unsubscribe => {
  const connectHook = (ctx: Ctx) => {
    const controller = new AbortController()
    const cleanup = cb(
      Object.assign({}, ctx, {
        // TODO: how to do it more performant
        cause: Object.assign(
          {},
          ctx.get((read) => read(anAtom.__reatom)!),
          { controller },
        ),
        controller,
        isConnected: () => isConnected(ctx, anAtom),
      }),
    )

    if (cleanup instanceof Promise) {
      cleanup.catch((error) => {
        if (error.name !== 'AbortError') throw error
      })
    }

    // TODO: abort on `connectHooks.delete`?
    const cleanupHook = (_ctx: Ctx) => {
      if (
        isSameCtx(ctx, _ctx) &&
        disconnectHooks.delete(cleanupHook) &&
        connectHooks.has(connectHook)
      ) {
        controller.abort(toAbortError(`${anAtom.__reatom.name} disconnect`))
        typeof cleanup === 'function' && cleanup()
      }
    }

    const disconnectHooks = addOnDisconnect(anAtom, cleanupHook)
  }

  const connectHooks = addOnConnect(anAtom, connectHook)

  return () => connectHooks.delete(connectHook)
}

export const onDisconnect = (anAtom: Atom, cb: Fn<[Ctx]>): Unsubscribe =>
  onConnect(anAtom, (ctx) => () => cb(ctx))

// @ts-expect-error
export const onUpdate: {
  <Params extends any[], Payload>(
    anAction: Action<Params, Payload>,
    cb: Fn<
      [
        Ctx,
        Payload,
        AtomCache<AtomState<Action<Params, Payload>>> & { params: Params },
      ]
    >,
  ): Unsubscribe
  <T>(anAtom: Atom<T>, cb: Fn<[Ctx, T, AtomCache<T>]>): Unsubscribe
} = <T>(anAtom: Action<any[], T> | Atom<T>, cb: Fn<[Ctx, T, AtomCache<T>]>) => {
  const hook = (ctx: Ctx, patch: AtomCache & { params?: unknown[] }) => {
    let { state } = patch
    if (anAtom.__reatom.isAction) {
      if (patch.state.length === 0) return
      const call = state.at(-1)!
      state = call.payload
      patch.params = call.params
    }
    cb(ctx, state, patch)
  }

  const hooks = addOnUpdate(anAtom, hook)

  return () => hooks.delete(hook)
}

/** @deprecated use the second parameter of `ctx.spy` instead */
// @ts-ignore
export const spyChange: {
  <Params extends any[], Payload>(
    ctx: CtxSpy,
    anAction: Action<Params, Payload>,
    handler?: Fn<[{ params: Params; payload: Payload }]>,
  ): boolean
  <T>(ctx: CtxSpy, anAtom: Atom<T>, handler?: Fn<[T, T?]>): boolean
} = (ctx: CtxSpy, anAtom: Atom, handler?: Fn) => {
  let isChanged = false
  ctx.spy(anAtom, (newState, prevState) => {
    isChanged = true
    handler?.(newState, prevState)
  })
  return isChanged
}

export const controlConnection =
  <T>(
    initState = true,
    name?: string,
  ): Fn<
    [Atom<T>],
    Atom<T> & { toggleConnection: Action<[boolean?], boolean> }
  > =>
  (anAtom) => {
    name ??= `${anAtom.__reatom.name}.controlConnection`

    const isActiveAtom = atom(initState, `${name}._isActiveAtom`)

    return Object.assign(
      {
        toggleConnection: action(
          (ctx, value) => isActiveAtom(ctx, (state) => value ?? !state),
          `${name}.toggleConnection`,
        ),
      },
      atom(
        (ctx, state?: any) => (ctx.spy(isActiveAtom) ? ctx.spy(anAtom) : state),
        name,
      ),
    )
  }

export const isConnected = (ctx: Ctx, { __reatom: proto }: Atom) =>
  ctx.get((read) => {
    const cache = proto.patch ?? read(proto)
    return !!cache && cache.subs.size + cache.listeners.size > 0
  })
