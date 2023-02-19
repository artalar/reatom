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
  cb: Fn<[Ctx & { isConnected(): boolean }]>,
): Unsubscribe => {
  const connectHook = (ctx: Ctx) => {
    const cleanup = cb(
      Object.assign({}, ctx, {
        isConnected: () => isConnected(ctx, anAtom),
      }),
    )

    if (typeof cleanup === 'function') {
      const cleanupHook = (_ctx: Ctx) =>
        isSameCtx(ctx, _ctx) &&
        disconnectHooks.delete(cleanupHook) &&
        connectHooks.has(connectHook) &&
        cleanup()

      const disconnectHooks = addOnDisconnect(anAtom, cleanupHook)
    }
  }

  const connectHooks = addOnConnect(anAtom, connectHook)

  return () => connectHooks.delete(connectHook)
}

export const onDisconnect = (anAtom: Atom, cb: Fn<[Ctx]>): Unsubscribe => {
  const disconnectHooks = addOnDisconnect(anAtom, cb)
  return () => disconnectHooks.delete(cb)
}

export const onUpdate = <T>(
  anAtom: Action<any[], T> | Atom<T>,
  cb: Fn<[Ctx, T, AtomCache<T>]>,
) => {
  const hook = (ctx: Ctx, patch: AtomCache) => {
    let { state } = patch
    if (anAtom.__reatom.isAction) {
      if (patch.state.length === 0) return
      state = state.at(-1)!.payload
    }
    cb(ctx, state, patch)
  }

  const hooks = addOnUpdate(anAtom, hook)

  return () => hooks.delete(hook)
}

// @ts-ignore
export const spyChange: {
  <Params extends any[], Payload>(
    ctx: CtxSpy,
    anAction: Action<Params, Payload>,
    handler?: Fn<
      [
        { params: Params; payload: Payload },
        { params: Params; payload: Payload }?,
      ]
    >,
  ): boolean
  <T>(ctx: CtxSpy, anAtom: Atom<T>, handler?: Fn<[T, T?]>): boolean
} = (ctx: CtxSpy, anAtom: Atom, handler: Fn) => {
  const { pubs } = ctx.cause
  const { isAction } = anAtom.__reatom
  let state: any = ctx.spy(anAtom)

  // we walk from the end because
  // it is possible to have a few different
  // caches for the same atom
  // and the last one is the most actual
  for (let i = pubs.length; i > 0; ) {
    const pub = pubs[--i]!
    if (pub.proto === anAtom.__reatom) {
      if (
        Object.is(pub.state, state) ||
        // TODO impossible state?
        (isAction && state.length === 0)
      ) {
        return false
      }
      handler?.(
        isAction ? state.at(-1) : state,
        isAction ? state.at(-2) : pub.state,
      )
      return true
    }
  }

  if (isAction) {
    if (state.length === 0) return false
    state = state.at(-1)
  }

  handler?.(state)

  return true
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
    const isActiveAtom = atom(initState)

    return Object.assign(
      {
        toggleConnection: action(
          (ctx, value) => isActiveAtom(ctx, (state) => value ?? !state),
          name?.concat('.toggleConnection'),
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
