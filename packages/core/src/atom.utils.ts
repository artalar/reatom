import {
  Action,
  ActionResult,
  atom,
  Atom,
  AtomCache,
  Ctx,
  CtxSpy,
  Fn,
  Logs,
  read,
  Rec,
  subscribe,
  Unsubscribe,
} from './atom'

export const init = (ctx: Ctx, atom: Atom): Unsubscribe =>
  subscribe(ctx, atom, () => {})

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
    lastResultAtom.change(ctx, action.__reatom.patch!.state.at(-1)),
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
    const un = subscribe(ctx, atom, (value) => {
      if (skipFirst) return (skipFirst = false)
      r(value)
      un()
    })
  })

export const onChange: {
  <T>(ctx: CtxSpy, atom: Atom<T>, handler: Fn<[T, undefined | T]>): void
} = (ctx, atom, handler) => {
  const state = ctx.spy(atom)
  const prevCache = read(ctx, ctx.cause!.meta)?.parents.find(
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

export const onUpdate: {
  <T>(atom: Atom<T>, handler: Fn<[Ctx, T]>, skipFirst?: boolean): Unsubscribe
} = (atom, handler, skipFirst = true) => {
  const cb = (ctx: Ctx, cache: AtomCache) => {
    const prevCache = read(ctx, atom.__reatom)

    if (prevCache === undefined && skipFirst) return

    handler(ctx, cache.state)
  }

  atom.__reatom.onUpdate.add(cb)

  return () => atom.__reatom.onUpdate.delete(cb)
}

export const getPrev = <T>(ctx: Ctx, atom: Atom<T>) => {
  return read(ctx, atom.__reatom)?.state
}
