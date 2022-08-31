import {
  Action,
  Atom,
  AtomCache,
  AtomState,
  Ctx,
  CtxSpy,
  Fn,
  Unsubscribe,
} from '@reatom/core'

export const withInit =
  <T extends Atom>(
    createState: Fn<[Ctx, T['__reatom']['initState']], AtomState<T>>,
  ): Fn<[T], T> =>
  (anAtom) => {
    const { initState } = anAtom.__reatom
    anAtom.__reatom.initState = (ctx) => createState(ctx, initState)
    return anAtom
  }

export const onConnect = (
  anAtom: Atom,
  hook: Fn<[Ctx], void | Unsubscribe>,
): Unsubscribe => {
  const connectHooks = (anAtom.__reatom.onConnect ??= new Set())

  const connectHook = (ctx: Ctx) => {
    const cleanup = hook(ctx)

    if (typeof cleanup === 'function') {
      const cleanupHook = (_ctx: Ctx) => {
        if (ctx === _ctx) {
          cleanupHooks.delete(cleanupHook)
          if (connectHooks.has(connectHook)) cleanup()
        }
      }
      const cleanupHooks = (anAtom.__reatom.onCleanup ??= new Set()).add(
        cleanupHook,
      )
    }
  }

  connectHooks.add(connectHook)

  return () => connectHooks.delete(connectHook)
}

export const whileConnected = <T>(anAtom: Atom<T>, cb: Fn<[Ctx], Promise<any>>) =>
  onConnect(anAtom, (ctx) => {
    let isConnected = true

    cb(ctx).then(() => isConnected && cb(ctx))

    return () => (isConnected = false)
  })

export const addOnUpdate = <T extends Atom>(
  anAtom: T,
  cb: Fn<[Ctx, AtomCache<AtomState<T>>]>,
) => (anAtom.__reatom.onUpdate ??= new Set()).add(cb)

export const onUpdate = <T>(
  anAtom: Action<any[], T> | Atom<T>,
  hook: Fn<[Ctx, T, AtomCache<T>]>,
) => {
  const cb = (ctx: Ctx, patch: AtomCache) => {
    let { state } = patch
    if (anAtom.__reatom.isAction) {
      if (patch.state.length === 0) return
      state = state.at(-1)
    }
    hook(ctx, state, patch)
  }
  const hooks = addOnUpdate(anAtom, cb)
  return () => hooks.delete(cb)
}

export const isChanged = (ctx: CtxSpy, atom: Atom): boolean => {
  const state = ctx.spy(atom)
  const { parents } = ctx.cause!
  // we walk from the end because
  // it is possible to have a few different
  // caches for the same atom
  // and the last one is the most actual
  for (let i = parents.length; i > 0; ) {
    const parent = parents[--i]!
    if (parent.meta === atom.__reatom) {
      return !Object.is(parent.state, state)
    }
  }
  return false
}
