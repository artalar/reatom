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

export const onConnect = <T>(
  anAtom: Atom<T>,
  hook: Fn<[Ctx, T, AtomCache<T>], void | Unsubscribe>,
): Unsubscribe => {
  const connectHooks = (anAtom.__reatom.onConnect ??= new Set())
  const cleanupHooks = (anAtom.__reatom.onCleanup ??= new Set())
  const connectCleanups = new WeakMap<Ctx, Fn>()

  const connectCb = (ctx: Ctx) => {
    const cache = ctx.get((read) => read(anAtom.__reatom)!)
    const cleanup = hook(ctx, cache.state, cache)

    if (typeof cleanup === 'function') {
      connectCleanups.set(ctx, cleanup)
    }
  }
  const cleanupCb = (ctx: Ctx) => {
    const cleanup = connectCleanups.get(ctx)
    if (typeof cleanup === 'function') {
      connectCleanups.delete(ctx)
      cleanup()
    }
  }

  connectHooks.add(connectCb)
  cleanupHooks.add(cleanupCb)

  return () => {
    connectHooks.delete(connectCb)
    cleanupHooks.delete(cleanupCb)
  }
}

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
