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
  Rec,
  Unsubscribe,
} from './atom'

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

export const actionAtom: {
  <T>(action: Action<any, T>): Atom<null | T>
} = (action) => {
  const a = atom<null | ActionResult<typeof action>>(null)
  action.__reatom.onUpdate.push((ctx) =>
    a.change(ctx, ctx.get(action).at(-1) ?? null),
  )

  return a
}

export const onChange: {
  <T>(ctx: CtxSpy, atom: Atom<T>, handler: Fn<[T, undefined | T]>): void
} = (ctx, atom, handler) => {
  const state = ctx.spy(atom)
  const prevCache = ctx
    .read(ctx[`👀`]!.meta)
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

  atom.__reatom.onUpdate.push(cb)

  return () => {
    const index = atom.__reatom.onUpdate.indexOf(cb)
    if (index > -1) atom.__reatom.onUpdate.splice(index, 1)
  }
}

export const getPrev = <T>(ctx: Ctx, atom: Atom<T>) => {
  return ctx.read(atom.__reatom)?.state
}
