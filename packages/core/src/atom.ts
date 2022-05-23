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

export function callSafety<I extends any[], O>(
  fn: (...a: I) => O,
  ...args: I
): O | Error {
  try {
    return fn(...args)
  } catch (err: any) {
    setTimeout(() => {
      throw err
    })
    return (err = err instanceof Error ? err : new Error(err))
  }
}

// --- SOURCES

const INTERNAL = `🙊`
type INTERNAL = typeof INTERNAL

/** Main context of data storing and effects processing */
export interface Ctx {
  cause: null | AtomCache
  get<T>(atom: Atom<T>): T
  schedule<T = void>(cb?: Fn<[Ctx], T>, isNearEffect?: boolean): Promise<T>

  /** @private  */
  [INTERNAL]: {
    actualize(
      meta: AtomMeta,
      mutator?: Fn<[patchCtx: Ctx, patch: AtomCache]>,
    ): AtomCache
    log(cb: Fn<[patches: Logs, error: null | Error]>): Unsubscribe
    read(meta: AtomMeta): undefined | AtomCache
    subscribe<T>(atom: Atom<T>, cb: Fn<[T]>): Unsubscribe
    run<T>(cb: Fn<[], T>): T
  }
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
  readonly isAction: boolean
  readonly isInspectable: boolean
  readonly initState: State
  readonly computer: null | Fn<[CtxSpy, AtomCache]>
  readonly onCleanup: Set<Fn<[Ctx]>>
  readonly onInit: Set<Fn<[Ctx]>>
  readonly onUpdate: Set<Fn<[Ctx, AtomCache]>>
  // temporal cache of the last patch during transaction
  patch: null | AtomCache
}

// The order of properties is sorted by debugging purposes
// (the most interesting properties are at the top)
export interface AtomCache<State = any> {
  state: State
  readonly meta: AtomMeta
  cause: Ctx[`cause`]
  parents: Array<AtomCache>
  readonly children: Set<AtomMeta>
  readonly listeners: Set<Fn>
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
  return typeof thing === `function` && isAtom(thing)
}

export const isStale = (cache: AtomCache): boolean => {
  return cache.children.size + cache.listeners.size === 0
}

const assertFunction = (thing: any) => {
  if (typeof thing !== `function`) {
    throw new Error(`Invalid "${typeof thing}", function expected`)
  }
}

const copyCache = (cache: AtomCache, cause: AtomCache[`cause`]) => ({
  state: cache.state,
  meta: cache.meta,
  cause,
  parents: cache.parents,
  children: cache.children,
  listeners: cache.listeners,
})

export interface ContextOptions {
  /** Use it to delay late effects such as subscriptions notification */
  callLateEffects?: Fn<[Fn]>
  /** Use it to override catch behavior of failed effect */
  callSafety?: typeof callSafety

  createCache?: Fn<[AtomMeta], AtomCache>
}

export const createContext = ({
  callLateEffects = (cb) => cb(),
  callSafety: _callSafety = callSafety,
  createCache = (meta) => ({
    state: meta.initState,
    meta,
    cause: null,
    parents: [],
    children: new Set(),
    listeners: new Set(),
  }),
}: ContextOptions = {}): Ctx => {
  let caches = new WeakMap<AtomMeta, AtomCache>()
  let logsListeners = new Set<Fn<[Logs, null | Error]>>()
  let nearEffects: Array<Fn<[Ctx]>> = []
  let nearEffectsIdx = 0
  let lateEffects: Array<Fn<[Ctx]>> = []
  let lateEffectsIdx = 0

  // `tr` is short for `transaction`
  let inTr: boolean
  let trNearEffects: Array<Fn>
  let trError: Error | null
  let trLateEffects: Array<Fn>
  let trLinks: Set<AtomMeta>
  let trLogs: Array<AtomCache>
  let trRollbacks: Array<Fn>
  let trUnlinks: Set<AtomMeta>
  let resetTr = () => {
    inTr = false
    trNearEffects = []
    trError = null
    trLateEffects = []
    trLinks = new Set()
    trLogs = []
    trRollbacks = []
    trUnlinks = new Set()
  }
  resetTr()

  const walkNearEffects = () => {
    while (nearEffectsIdx < nearEffects.length)
      _callSafety(nearEffects[nearEffectsIdx++], ctx)
    nearEffects = []
    nearEffectsIdx = 0
  }
  const walkLateEffects = () => {
    while (lateEffectsIdx < lateEffects.length) {
      _callSafety(lateEffects[lateEffectsIdx++], ctx)
      if (nearEffects.length > 0) walkNearEffects()
    }
    lateEffects = []
    lateEffectsIdx = 0
  }

  const addPatch = (patch: AtomCache) => {
    trLogs.push((patch.meta.patch = patch))
    return patch
  }

  const enqueueComputers = (cache: AtomCache) => {
    for (let i = 0, queue = [cache.children]; i < queue.length; ) {
      queue[i++].forEach((childMeta) => {
        const childCache = childMeta.patch ?? caches.get(childMeta)!

        if (
          childCache.cause !== null &&
          addPatch(copyCache(childCache, null)).listeners.size === 0
        )
          queue.push(childCache.children)
      })
    }
  }

  const actualizeParents = (ctx: CtxSpy, patch: AtomCache) => {
    let done = false
    let { cause, parents } = patch
    let isParentsChanged = parents.length === 0

    if (
      isParentsChanged ||
      parents.some(
        ({ meta, state }) => !Object.is(state, (cause = actualize(meta)).state),
      )
    ) {
      patch.parents = []

      ctx.spy = (atom: Atom) => {
        if (done) {
          throw new Error(
            `async spy "${atom.__reatom.name}" in "${patch.meta.name}")`,
          )
        }

        const depPatch = actualize(atom.__reatom)
        const length = patch.parents.push(depPatch)

        isParentsChanged ||=
          length > parents.length || depPatch.meta !== parents[length - 1].meta

        return depPatch.state
      }

      patch.meta.computer!(ctx, patch)

      done = true

      patch.cause = cause
    }

    return isParentsChanged
  }

  const actualize: Ctx[INTERNAL][`actualize`] = (meta, mutator) => {
    let { patch } = meta
    if (patch !== null && patch!.cause !== null) return patch!
    let isPlain = meta.computer === null

    let cache = caches.get(meta) ?? (patch ??= addPatch(createCache(meta)))

    patch ??= addPatch(copyCache(cache, null))

    let { state } = patch
    let isParentsChanged = false

    const patchCtx = {
      cause: patch,
      get: ctx.get,
      schedule: ctx.schedule,
      // @ts-expect-error
      spy: ctx.spy,
      [INTERNAL]: ctx[INTERNAL],
    }

    mutator?.(patchCtx, patch)
    isParentsChanged = !isPlain && actualizeParents(patchCtx, patch)

    if (isParentsChanged) {
      if (cache !== patch) trUnlinks.add(meta)
      trLinks.add(meta)
    }

    if (!Object.is(state, patch.state)) {
      if (patch.children.size > 0) enqueueComputers(patch)

      for (const hook of meta.onUpdate) hook(ctx, patch)
    }

    patch.cause ??= patch

    return patch
  }

  const ctx: Ctx = {
    cause: null,
    get: ({ __reatom: meta }) => ctx[INTERNAL].run(() => actualize(meta).state),
    // FIXME: asserts `inTr`
    schedule(effect = noop, isNearEffect = true) {
      assertFunction(effect)
      const effects = isNearEffect ? trNearEffects : trLateEffects

      return new Promise<any>((res, rej) => {
        trRollbacks.push(rej)
        effects.push((ctx) => {
          try {
            res(effect(ctx))
          } catch (error) {
            rej(error)
          }
        })
      })
    },
    // @ts-ignore
    spy: null,
    [INTERNAL]: {
      actualize,
      log(cb) {
        assertFunction(cb)

        logsListeners.add(cb)
        return () => logsListeners.delete(cb)
      },
      read(meta) {
        return caches.get(meta)
      },
      run(cb) {
        if (inTr) return cb()

        inTr = true

        try {
          var result = cb()

          if (trLogs.length === 0) return result

          for (let patch of trLogs) {
            if (patch.listeners.size > 0) actualize(patch.meta)
          }

          for (const meta of trUnlinks) {
            const cache = caches.get(meta)!
            for (const parentCache of cache.parents) {
              parentCache.children.delete(meta)
              if (isStale(parentCache)) {
                parentCache.meta.patch ??
                  addPatch(copyCache(parentCache, cache))
                trUnlinks.add(parentCache.meta)
              }
            }
          }

          for (const meta of trLinks) {
            for (const parentPatch of meta.patch!.parents) {
              if (isStale(parentPatch)) trLinks.add(parentPatch.meta)
              parentPatch.children.add(meta)
            }
          }

          for (const meta of trUnlinks) {
            if (isStale(meta.patch!)) nearEffects.push(...meta.onCleanup)
          }

          for (const meta of trLinks) {
            if (!isStale(meta.patch!) && !trUnlinks.has(meta)) {
              nearEffects.push(...meta.onInit)
            }
          }

          for (const log of logsListeners) log(trLogs, trError)

          for (const {
            meta,
            meta: { patch },
          } of trLogs) {
            if (patch !== null) {
              caches.set(meta, patch!)
              meta.patch = null
              const { state } = patch
              const schedule: Fn<[Fn]> = meta.isAction
                ? ((patch.state = []),
                  (cb) => nearEffects.push(() => cb(state)))
                : (cb) => lateEffects.push(() => cb(caches.get(meta)!.state))
              patch.listeners.forEach(schedule)
            }
          }

          nearEffects.push(...trNearEffects)
          lateEffects.push(...trLateEffects)
        } catch (e: any) {
          trError = e = e instanceof Error ? e : new Error(String(e))
          for (const log of logsListeners) log(trLogs, e)
          for (const cb of trRollbacks) cb(e)
          for (const { meta } of trLogs) meta.patch = null

          throw e
        } finally {
          resetTr()
        }

        walkNearEffects()
        callLateEffects(walkLateEffects)

        return result
      },
      subscribe(atom, cb) {
        assertFunction(cb)

        const { __reatom: meta } = atom

        let lastState = impossible
        const fn: typeof cb = (state) =>
          Object.is(lastState, state) || cb((lastState = state))

        let cache = caches.get(meta)

        if (cache === undefined || isStale(cache)) {
          ctx[INTERNAL].run(() => {
            trRollbacks.push(() => meta.patch!.listeners.delete(fn))
            actualize(meta, (ctx, patch) =>
              (patch.cause = patch).listeners.add(fn),
            )
          })
        } else {
          cache.listeners.add(fn)
        }

        fn(caches.get(meta)!.state)

        return () => {
          if (inTr)
            throw new Error(`unsubscribe is not allowed during transaction`)

          if ((cache = caches.get(meta)!).listeners.delete(fn)) {
            if (isStale(cache)) {
              const queue: Array<AtomCache> = [copyCache(cache, cache)]
              for (const patch of queue) {
                caches.set(patch.meta, patch)
                nearEffects.push(...patch.meta.onCleanup)

                for (const parentCache of patch.parents) {
                  parentCache.children.delete(patch.meta)
                  if (isStale(parentCache)) {
                    queue.push(copyCache(parentCache, patch))
                  }
                }
              }
              walkNearEffects()
              callLateEffects(walkLateEffects)
            }
          }
        }
      },
    },
  }

  return ctx
}

export const log = (ctx: Ctx, cb: Fn<[patches: Logs, error: null | Error]>) =>
  ctx[INTERNAL].log(cb)

export const read = (ctx: Ctx, meta: AtomMeta) => ctx[INTERNAL].read(meta)

export const run: {
  <T>(ctx: Ctx, cb: Fn<[], T>): T
} = (ctx, cb) => ctx[INTERNAL].run(cb)

export const subscribe: {
  <T>(ctx: Ctx, atom: Atom<T>, cb: Fn<[T]>): Unsubscribe
} = (ctx, atom, cb) => ctx[INTERNAL].subscribe(atom, cb)

export type ActionsReducers<
  State = any,
  Actions extends Rec<Fn<[State, ...any[]], State>> = Rec<Fn>,
> = Merge<{
  [K in keyof Actions]: Actions[K] extends Fn<[State, ...infer Params]>
    ? Action<Params, State>
    : never
}>

export type AtomOptions = Merge<
  Partial<Pick<AtomMeta, `name` | `isInspectable`>>
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
  let computer: AtomMeta[`computer`] = null

  if (typeof initState === `function`) {
    const userComputer = initState
    initState = undefined
    computer = (ctx, patch) => (patch.state = userComputer(ctx, patch.state))
  }

  let {
    // @ts-ignore
    name,
    isInspectable = !!name,
    reducers = typeof initState === `function`
      ? {}
      : {
          change: (state: any, update: any) =>
            typeof update === `function` ? update(state) : update,
        },
  } = typeof options === `string` ? { name: options } : options

  const meta: AtomMeta = {
    name: `${name ?? `atom`}[${++count}]`,
    isAction: false,
    isInspectable,
    initState,
    computer,
    onCleanup: new Set(),
    onInit: new Set(),
    onUpdate: new Set(),
    patch: null,
  }

  const atom: Rec = {}

  for (const name in reducers) {
    atom[name] = action(
      (ctx, param) =>
        ctx[INTERNAL].actualize(meta, (patchCtx, patch) => {
          patch.cause = ctx.cause
          patch.state = reducers[name](patch.state, param)
        }).state,
      `${meta.name}.${name}`,
    )
  }

  atom.__reatom = meta

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

  const meta: AtomMeta = {
    name: `${name ?? `action`}[${++count}]`,
    isInspectable: true,
    isAction: true,
    initState: [],
    computer: null,
    onCleanup: new Set(),
    onInit: new Set(),
    onUpdate: new Set(),
    patch: null,
  }

  const action: Action = (ctx: Ctx, ...params: any[]) =>
    ctx[INTERNAL].run(() =>
      ctx[INTERNAL].actualize(meta, (patchCtx, patch) => {
        patch.cause = ctx.cause ?? patch
        patch.state = [...patch.state, (fn as Fn)(patchCtx, ...params)]
      }).state.at(-1),
    )

  action.__reatom = meta

  return action
}
