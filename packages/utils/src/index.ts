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
  isAction,
  Unsubscribe,
} from '@reatom/core'

import { sleep, isObject, shallowEqual } from './common'

export { sleep, isObject, shallowEqual }

export const onCleanup = (atom: Atom, cb: Fn<[Ctx]>): Unsubscribe => {
  const hooks = (atom.__reatom.onCleanup ??= new Set())
  hooks.add(cb)
  return () => hooks.delete(cb)
}

export const onConnect = (atom: Atom, hook: Fn<[Ctx]>): Unsubscribe => {
  const connectHooks = (atom.__reatom.onConnect ??= new Set())
  const cleanupHooks = (atom.__reatom.onCleanup ??= new Set())
  const connectCleanups = new WeakMap<Ctx, Fn>()

  const connectCb = (ctx: Ctx) => {
    const cleanup = hook(ctx)

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

export const onUpdate = (atom: Atom, cb: Fn<[Ctx, AtomCache]>) => {
  const hooks = (atom.__reatom.onUpdate ??= new Set())
  hooks.add(cb)
  return () => hooks.delete(cb)
}

// export const withAssign =
//   <Props extends Rec, Target>(props: Props) =>
//   (target: Target): Target & Props =>
//     Object.assign(target, props)

// export const init = (ctx: Ctx, atom: Atom): Unsubscribe =>
//   ctx.subscribe(atom, () => {})

// const atomizeActionResultCacheKey = Symbol()
// export const atomizeActionResult = <T>(
//   action: Action<any, T>,
//   name?: string,
// ): Atom<undefined | T> => {
//   if (atomizeActionResultCacheKey in action.__reatom) {
//     // @ts-expect-error
//     return action.__reatom[atomizeActionResultCacheKey]
//   }

//   const actionResultAtom = atom<undefined | ActionResult<typeof action>>(
//     undefined,
//     name,
//   )
//   action.__reatom.onUpdate.add((ctx, patch) =>
//     actionResultAtom(ctx, patch.state.at(-1)),
//   )

//   // @ts-expect-error
//   return (action[atomizeActionResultCacheKey] = actionResultAtom)
// }

export const promisifyUpdate = <T>(
  anAtom: Atom<T>,
  targetCtx?: Ctx,
): Promise<[T, Ctx]> =>
  new Promise((resolve) => {
    const un = onUpdate(anAtom, (ctx, patch) => {
      if (targetCtx !== undefined && targetCtx !== ctx) return

      // multiple updates will be ignored
      // and only first will accepted
      ctx.schedule(() => {
        un()
        resolve([ctx.get((read) => read(anAtom.__reatom)!.state), ctx])
      })
    })
  })

export const onChange: {
  <T>(ctx: CtxSpy, atom: Atom<T>, handler: Fn<[T, undefined | T]>): void
} = (ctx, atom, handler) => {
  const state = ctx.spy(atom)
  // TODO find starts from the end?
  const prevCache = ctx.cause!.parents.find(
    (parent) => parent.meta === atom.__reatom,
  )

  if (prevCache === undefined || !Object.is(prevCache.state, state)) {
    handler(state, prevCache?.state)
  }
}

export const isChanged = (ctx: CtxSpy, atom: Atom): boolean => {
  let changed = false
  onChange(ctx, atom, () => (changed = true))
  return changed
}

export const withReset =
  <T extends Atom>() =>
  (anAtom: T): T & { reset: Action<[], AtomState<T>> } =>
    Object.assign(anAtom, {
      reset: action((ctx) =>
        ctx.get(
          (read, actualize) =>
            actualize!(
              anAtom.__reatom,
              (patchCtx: CtxSpy, patch: AtomCache) =>
                (patch.state = patch.meta.initState(ctx)),
            ).state,
        ),
      ),
    })

export const filter =
  <T>(isChanged: Fn<[newState: T, prevState: T | undefined], boolean>) =>
  (anAtom: Atom<T>): Atom<T> =>
    atom((ctx, state = undefined as undefined | T) => {
      const data: T = ctx.spy(anAtom)

      return isChanged(data, state) ? data : (state as T)
    })
