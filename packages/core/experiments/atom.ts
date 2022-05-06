// --- UTILS

export type AllTypes =
  | undefined
  | null
  | boolean
  | number
  | string
  | Record<keyof any, any>
  | Fn
  | symbol
  | bigint

export interface Fn<Args extends any[] = any[], Return = any> {
  (...a: Args): Return
}

export interface Rec<Values = any> extends Record<string, Values> {}

export type Merge<Intersection> = Intersection extends Fn
  ? Intersection
  : Intersection extends new (...a: any[]) => any
  ? Intersection
  : Intersection extends object
  ? {
      [Key in keyof Intersection]: Intersection[Key]
    }
  : Intersection

export type Values<T> = Merge<T[keyof T]>

export type OmitValues<Collection, Target> = Merge<
  Omit<
    Collection,
    Values<{
      [K in keyof Collection]: Collection[K] extends Target ? K : never
    }>
  >
>
export type PickValues<Collection, Target> = Merge<
  Pick<
    Collection,
    Values<{
      [K in keyof Collection]: Collection[K] extends Target ? K : never
    }>
  >
>

export type Replace<T, K extends keyof T, V> = {
  [k in keyof T]: k extends K ? V : T[k]
}

const noop: Fn = () => {}

// impossible value for internal marks
const impossible: any = Symbol()

export function callSafety<I extends any[], O, This = unknown>(
  this: This,
  fn: (this: This, ...a: I) => O,
  ...args: I
): O | Error {
  try {
    return fn.apply(this, args)
  } catch (err: any) {
    setTimeout(() => {
      throw err
    })
    return (err = err instanceof Error ? err : new Error(err))
  }
}

// --- SOURCES

const CAUSE = `👀`
const ACTUAL = `🙊`

/** Main context of data storing and effects processing */
export interface Ctx {
  get<T>(atom: Atom<T>): T
  log(cb: Fn<[patches: Logs, error: null | Error]>): Unsubscribe
  read(meta: AtomMeta): undefined | AtomCache
  run<T>(cb: Fn<[], T>): T
  schedule<T = void>(cb?: Fn<[], T>): Promise<T>
  scheduleLate<T = void>(cb?: Fn<[], T>): Promise<T>
  subscribe<T>(atom: Atom<T>, cb: Fn<[T]>): Unsubscribe

  /** @private outside module */
  [ACTUAL](
    meta: AtomMeta,
    mutator?: Fn<[AtomCache]>,
    patch?: AtomCache,
  ): AtomCache
  /** @private outside module */
  [CAUSE]: null | AtomCache
}

export interface CtxSpy extends Ctx {
  spy<T>(atom: Atom<T>): T
}

export interface Logs extends Array<AtomCache> {}

export interface Atom<State = any> {
  __reatom: AtomMeta<State>
}

// The order of properties is sorted by debugging purposes
// (the most interesting properties are at the top)
export interface AtomMeta<State = any> {
  // TODO: domain / namespace / tags
  readonly name: string
  readonly isInspectable: boolean
  readonly initState: State
  readonly computer: null | Fn<[CtxSpy, AtomCache]>
  readonly onCleanup: Array<Fn<[Ctx]>>
  readonly onInit: Array<Fn<[Ctx]>>
  readonly onUpdate: Array<Fn<[Ctx, AtomCache]>>
  readonly schedule: Fn<[Ctx, AtomCache], void>
}

// The order of properties is sorted by debugging purposes
// (the most interesting properties are at the top)
export interface AtomCache<State = any> {
  state: State
  cause: Ctx[typeof CAUSE]
  readonly meta: AtomMeta
  parents: Array<AtomCache>
  stale: boolean
  readonly children: Set<AtomMeta>
  readonly listeners: Set<Fn<[any]>>
}

export interface Action<Params extends any[] = any[], Res = any>
  extends Atom<Array<Res>> {
  (ctx: Ctx, ...params: Params): Res
}

export interface ActionChange<State>
  extends Action<[newState: State] | [reducer: Fn<[State], State>], State> {}

export interface AtomMutable<State = any> extends Atom<State> {
  change: ActionChange<State>
}

export type AtomState<T> = T extends Atom<infer State> ? State : never

export type ActionParams<T> = T extends Action<infer Params, any>
  ? Params
  : never
export type ActionResult<T> = T extends Action<any, infer Result>
  ? Result
  : never

export interface Unsubscribe {
  (): void
}

export const isAtom = (thing: any): thing is Atom => {
  return !!thing?.__reatom
}

export const isAction = (thing: any): thing is Action => {
  return typeof thing === `function` && '__reatom' in thing
}

export const isStale = (cache: AtomCache): boolean => {
  return cache.children.size + cache.listeners.size === 0
}

const assertFunction = (thing: any) => {
  if (typeof thing !== 'function') {
    throw new Error(`Invalid "${typeof thing}", function expected`)
  }
}

const createTr = (): {
  effects: Array<Fn>
  error: Error | null
  hooks: Set<AtomMeta>
  lateEffects: Array<Fn>
  links: Array<AtomCache>
  logs: Array<AtomCache>
  patches: Map<AtomMeta, AtomCache>
  rollbacks: Array<Fn>
  unlinks: Array<AtomCache>
} => ({
  effects: [],
  error: null,
  hooks: new Set(),
  lateEffects: [],
  links: [],
  logs: [],
  patches: new Map(),
  rollbacks: [],
  unlinks: [],
})

export const createContext = ({
  callLastEffects = (fn) => fn(),
}: {
  callLastEffects?: Fn<[Fn]>
} = {}): Ctx => {
  let caches = new WeakMap<AtomMeta, AtomCache>()
  let logListeners = new Set<Fn<[Logs, null | Error]>>()
  let effects: Array<Fn> = []
  let effectsIdx = 0
  let lateEffects: Array<Fn> = []
  let lateEffectsIdx = 0

  let tr = createTr()
  let inTr = false

  const walkEffects = () => {
    while (effectsIdx < effects.length) callSafety(effects[effectsIdx++])
    effects = []
    effectsIdx = 0
  }
  const walkLateEffects = () => {
    while (lateEffectsIdx < lateEffects.length) {
      callSafety(lateEffects[lateEffectsIdx++])
      if (effects.length > 0) walkEffects()
    }
    lateEffects = []
    lateEffectsIdx = 0
  }

  const addPatch = (patch: AtomCache) => {
    tr.patches.set(patch.meta, patch)
    tr.logs.push(patch)
    return patch
  }

  const computersEnqueue = (cache: AtomCache) => {
    for (const childMeta of cache.children) {
      const childCache = tr.patches.get(childMeta) ?? caches.get(childMeta)!

      childCache.cause !== null &&
        addPatch({ ...childCache, cause: null }).listeners.size === 0 &&
        computersEnqueue(childCache)
    }
  }

  const actualizeParents = (patch: AtomCache) => {
    let { cause, parents } = patch
    let isParentsChanged = parents.length === 0

    if (
      isParentsChanged ||
      parents.some(
        ({ meta, state }) => !Object.is(state, (cause = actualize(meta)).state),
      )
    ) {
      patch.parents = []

      patch.meta.computer!(
        {
          ...ctx,
          [CAUSE]: patch,
          spy: (atom: Atom) => {
            const depPatch = actualize(atom.__reatom)
            const length = patch.parents.push(depPatch)

            depPatch.cause ??= patch

            isParentsChanged ||=
              length > parents.length ||
              depPatch.meta !== parents[length - 1].meta

            return depPatch.state
          },
        },
        patch,
      )

      patch.cause = cause
    }

    return isParentsChanged
  }

  const actualize: Ctx[typeof ACTUAL] = (
    meta,
    mutator,
    patch = tr.patches.get(meta),
  ) => {
    const hasPatch = patch !== undefined
    const cache = caches.get(meta)
    patch ??=
      cache === undefined
        ? addPatch({
            state: meta.initState,
            cause: null,
            meta,
            parents: [],
            stale: true,
            children: new Set(),
            listeners: new Set(),
          })
        : cache

    if (patch.cause !== null) {
      if (mutator === undefined && (!patch.stale || hasPatch)) return patch

      patch = addPatch({ ...patch, cause: null })
    }

    let { state } = patch
    let isParentsChanged = false

    try {
      mutator?.(patch)
      if (meta.computer !== null) isParentsChanged = actualizeParents(patch)
    } catch (err) {
      // TODO 🤔
      patch.state = err = err instanceof Error ? err : new Error(String(err))
      tr.patches.delete(meta)

      throw err
    }

    if (!Object.is(state, patch.state) || cache === undefined) {
      if (patch.children.size > 0) computersEnqueue(patch)

      for (const hook of meta.onUpdate) hook(ctx, patch)

      meta.schedule(ctx, patch)
    }

    if (isParentsChanged) {
      if (cache !== undefined) tr.unlinks.push(cache)
      // FIXME should be unique set
      tr.links.push(patch)
      tr.hooks.add(meta)
    }

    return patch
  }

  const schedule = (
    name: 'schedule' | 'scheduleLate',
  ): Ctx['schedule'] | Ctx['scheduleLate'] => {
    const effectsName = name === 'schedule' ? 'effects' : 'lateEffects'
    return (effect = noop) => {
      assertFunction(effect)

      return inTr
        ? new Promise<any>((res, rej) => {
            tr.rollbacks.push(rej)
            tr[effectsName].push(() =>
              new Promise((r) => r(effect())).then(res, rej),
            )
          })
        : ctx.run(() => ctx[name](effect))
    }
  }

  const ctx: Ctx = {
    get({ __reatom: meta }) {
      // try to prevent unnecessary work
      // for common case when we read internal atom
      // which have no children / listeners
      const cache = tr.patches.get(meta) ?? caches.get(meta)
      if (
        cache !== undefined &&
        cache.cause !== null &&
        (!cache.stale || meta.computer === null)
      ) {
        return cache.state
      }

      return ctx.run(() => actualize(meta, undefined, cache).state)
    },
    log(cb) {
      assertFunction(cb)

      logListeners.add(cb)
      return () => logListeners.delete(cb)
    },
    read: (meta) => caches.get(meta),
    run(cb) {
      if (inTr) return cb()

      inTr = true

      try {
        var result = cb()

        for (let patch of tr.logs) {
          if (patch.listeners.size > 0) {
            patch = tr.patches.get(patch.meta)!
            if (patch.cause === null) actualize(patch.meta, undefined, patch)
          }
        }

        for (const cache of tr.unlinks) {
          for (const parentCache of cache.parents) {
            parentCache.children.delete(cache.meta)
            if (isStale(parentCache)) {
              tr.unlinks.push(parentCache)
              tr.hooks.add(addPatch({ ...parentCache, cause: cache }).meta)
            }
          }
        }

        for (const patch of tr.links) {
          for (const parentPatch of patch.parents) {
            if (isStale(parentPatch)) {
              tr.links.push(parentPatch)
              tr.hooks.add(parentPatch.meta)
            }
            parentPatch.children.add(patch.meta)
          }
        }

        for (const meta of tr.hooks) {
          const patch = tr.patches.get(meta)!

          if (patch.stale !== (patch.stale = isStale(patch))) {
            const hooks = patch.stale ? patch.meta.onCleanup : patch.meta.onInit
            for (const hook of hooks) effects.push(() => hook(ctx))
          }
        }

        for (const log of logListeners) log(tr.logs, tr.error)

        for (const [meta, patch] of tr.patches) caches.set(meta, patch)

        effects.push(...tr.effects)
        lateEffects.push(...tr.lateEffects)
      } catch (e: any) {
        tr.error = e = e instanceof Error ? e : new Error(String(e))
        for (const log of logListeners) log(tr.logs, e)
        for (const cb of tr.rollbacks) cb(e)

        throw e
      } finally {
        tr = createTr()
        inTr = false
      }

      walkEffects()
      callLastEffects(walkLateEffects)

      return result
    },
    schedule: schedule('schedule'),
    scheduleLate: schedule('scheduleLate'),
    subscribe({ __reatom: meta }: Atom<any>, cb: Fn) {
      assertFunction(cb)

      let lastState = impossible
      const fn: typeof cb = (state) =>
        Object.is(lastState, state) || cb((lastState = state))

      let cache = caches.get(meta)

      if (cache === undefined || cache.stale) {
        ctx.run(() => {
          tr.rollbacks.push(() => cache!.listeners.delete(fn))
          actualize(meta, (patch) =>
            (cache = patch.cause = patch).listeners.add(fn),
          )
        })
      } else {
        cache.listeners.add(fn)
      }

      fn(caches.get(meta)!.state)

      return () => {
        if (inTr)
          throw new Error(`unsubscribe is not allowed during transaction`)

        if (cache!.listeners.delete(fn)) {
          if (isStale((cache = caches.get(meta)!))) {
            const stack: Array<AtomCache> = [
              { ...cache, stale: true, cause: cache },
            ]
            while (stack.length > 0) {
              const patch = stack.pop()!
              caches.set(patch.meta, patch)
              effects.push(...patch.meta.onCleanup)

              for (const parentCache of patch.parents) {
                parentCache.children.delete(patch.meta)
                if (isStale(parentCache)) {
                  stack.push({ ...parentCache, stale: true, cause: patch })
                }
              }
            }
            walkEffects()
          }
        }
      }
    },
    [ACTUAL]: (meta, mutator) => ctx.run(() => actualize(meta, mutator)),
    [CAUSE]: null,
  }

  return ctx
}

export type ActionsReducers<
  State = any,
  Actions extends Rec<Fn<[State, ...any[]], State>> = Rec<Fn>,
> = Merge<{
  [K in keyof Actions]: Actions[K] extends Fn<[State, ...infer Params]>
    ? Action<Params, State>
    : never
}>

export type AtomOptions = Merge<
  Partial<Pick<AtomMeta, 'name' | 'isInspectable'>>
>

// TODO
// const sid = ((Math.random() * 999) | 0).toString(36)
let count = 0

// @ts-ignore
export const atom: {
  <State, Reducers extends Rec<Fn<[State, ...any[]], State>>>(
    initState: Fn<[CtxSpy], State> | State,
    options: AtomOptions & { reducers: Reducers },
  ): Atom<State> & ActionsReducers<State, Reducers>
  <State>(
    initState: Fn<[CtxSpy], State>,
    options?: string | AtomOptions,
  ): Atom<State> & ActionsReducers<State, {}>
  <State>(initState: State, options?: string | AtomOptions): AtomMutable<State>
} = (
  initState: Fn<[CtxSpy, any?]> | Exclude<AllTypes, Fn>,
  options: string | (AtomOptions & { reducers?: Rec<Fn> }) = {},
): Atom & ActionsReducers => {
  let computer: AtomMeta['computer'] = null

  if (typeof initState === 'function') {
    const userComputer = initState
    computer = (ctx, patch) => (patch.state = userComputer(ctx, patch.state))
    initState = undefined
  }

  let {
    // @ts-ignore
    name = `atom`,
    isInspectable = !!name,
    reducers = typeof initState === `function`
      ? {}
      : {
          change: (state: any, update: any) =>
            typeof update === `function` ? update(state) : update,
        },
  } = typeof options === 'string' ? { name: options } : options

  const meta: AtomMeta = {
    name: `${name}[${++count}]`,
    isInspectable,
    initState,
    computer,
    onCleanup: [],
    onInit: [],
    onUpdate: [],
    schedule: (ctx, patch) =>
      patch.listeners.forEach((cb) =>
        ctx.scheduleLate(() => cb(ctx.read(patch.meta)!.state)).catch(noop),
      ),
  }

  const atom: Rec = { ...reducers, __reatom: meta }

  for (const name in reducers) {
    const act = (atom[name] = action(
      (ctx, param) =>
        ctx[ACTUAL](meta, (patch) => {
          patch.cause = ctx[CAUSE]
          patch.state = reducers[name](patch.state, param)
        }).state,
      `${meta.name}.${name}`,
    ))
  }

  // @ts-ignore
  return atom
}

export const action: {
  <T = void>(name?: string): Action<[T], T>

  <Params extends any[] = any[], Res = void>(
    fn: (ctx: Ctx, ...params: Params) => Res,
    name?: string,
  ): Action<Params, Res>
} = (fn?: string | Fn, name?: string): Action => {
  if (fn === undefined || typeof fn === `string`) {
    name = fn
    fn = (v?: any) => v
  }

  assertFunction(fn)

  const action: Action = (ctx: Ctx, ...params: any[]) =>
    ctx.run(() =>
      ctx[ACTUAL](action.__reatom, (patch) => {
        patch.cause = ctx[CAUSE] ?? patch
        patch.state = patch.state.concat([
          (fn as Fn)({ ...ctx, [CAUSE]: patch }, ...params),
        ])
      }).state.at(-1),
    )

  action.__reatom = {
    name: `${name ?? `action`}[${++count}]`,
    isInspectable: true,
    initState: [],
    computer: null,
    onCleanup: [],
    onInit: [],
    onUpdate: [],
    schedule: (ctx, { listeners, state }) =>
      listeners.forEach((cb) => ctx.schedule(() => cb(state)).catch(noop)),
  }

  return action
}
