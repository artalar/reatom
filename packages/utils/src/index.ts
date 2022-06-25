import {
  action,
  Action,
  ActionResult,
  atom,
  Atom,
  AtomCache,
  AtomState,
  Ctx,
  CtxSpy,
  Fn,
  Logs,
  Rec,
  Unsubscribe,
} from '@reatom/core'

export const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))

export const init = (ctx: Ctx, atom: Atom): Unsubscribe =>
  ctx.subscribe(atom, () => {})

const atomizeActionResultCacheKey = Symbol()
export const atomizeActionResult: {
  <T>(action: Action<any, T>): Atom<undefined | T>
} = (action) => {
  if (atomizeActionResultCacheKey in action) {
    // @ts-expect-error
    return action[atomizeActionResultCacheKey]
  }

  const lastResultAtom = atom<undefined | ActionResult<typeof action>>(
    undefined,
    `${action.__reatom.name}.lastResultAtom`,
  )
  action.__reatom.onUpdate.add((ctx) =>
    lastResultAtom(ctx, action.__reatom.patch!.state.at(-1)),
  )

  // @ts-expect-error
  action[atomizeActionResultCacheKey] = lastResultAtom

  return lastResultAtom
}

export const isObject = (thing: any): thing is Record<keyof any, any> =>
  typeof thing === 'object' && thing !== null

export const shallowEqual = (a: any, b: any) => {
  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    return (
      aKeys.length === bKeys.length && aKeys.every((k) => Object.is(a[k], b[k]))
    )
  } else {
    return Object.is(a, b)
  }
}

export const patchesToCollection = (patches: Logs) =>
  patches.reduce(
    (acc, { state, meta: { name } }) => ((acc[name] = state), acc),
    {} as Rec,
  )

export const subscribeOnce: {
  <T>(ctx: Ctx, atom: Atom<T>): Promise<T>
} = (ctx, atom) =>
  new Promise<any>((r) => {
    let skipFirst = true
    const un = ctx.subscribe(atom, (value) => {
      if (skipFirst) return (skipFirst = false)
      r(value)
      un()
    })
  })

export const onChange: {
  <T>(ctx: CtxSpy, atom: Atom<T>, handler: Fn<[T, undefined | T]>): void
} = (ctx, atom, handler) => {
  const state = ctx.spy(atom)
  const prevCache = ctx
    .read(ctx.cause!.meta)
    ?.parents.find((parent) => parent.meta === atom.__reatom)

  if (prevCache === undefined || !Object.is(prevCache.state, state)) {
    handler(state, prevCache?.state)
  }
}

export const isChanged = (ctx: CtxSpy, atom: Atom): boolean => {
  let changed = false
  onChange(ctx, atom, () => (changed = true))
  return changed
}

export const onUpdate: {
  <T>(atom: Atom<T>, handler: Fn<[Ctx, T]>, skipFirst?: boolean): Unsubscribe
} = (atom, handler, skipFirst = true) => {
  const cb = (ctx: Ctx, cache: AtomCache) => {
    const prevCache = ctx.read(atom.__reatom)

    if (prevCache === undefined && skipFirst) return

    handler(ctx, cache.state)
  }

  atom.__reatom.onUpdate.add(cb)

  return () => atom.__reatom.onUpdate.delete(cb)
}

export const getPrev = <T>(ctx: Ctx, atom: Atom<T>) => {
  return ctx.read(atom.__reatom)?.state
}

const impossibleValue = Symbol()

export const withReset =
  <T extends Atom>() =>
  (anAtom: T): T & { reset: Action<[], AtomState<T>> } =>
    Object.assign(anAtom, {
      reset: action(
        (ctx) =>
          ctx['🙊'](
            anAtom.__reatom,
            (patchCtx, patch) => (patch.state = patch.meta.initState),
          ).state,
      ),
    })

export const filter =
  <T>(isChanged: Fn<[newState: T, prevState: T | undefined], boolean>) =>
  (anAtom: Atom<T>): Atom<T> =>
    atom((ctx, state) => {
      const data = ctx.spy(anAtom)

      return isChanged(data, state) ? data : state
    })
