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

const impossibleValue: any = Symbol()

export const callSafety = <I extends any[], O>(
  fn: (...a: I) => O,
  ...args: I
): O | Error => {
  try {
    return fn(...args)
  } catch (err: any) {
    setTimeout(() => {
      throw err
    })
    return err instanceof Error ? err : (err = new Error(err))
  }
}

/* TODO export?  */ const throwError = (condition: any, message: string) => {
  if (condition) throw new Error(`Reatom error: ${message}`)
}

// --- SOURCES

const ACTUALIZE = `🙊`
type ACTUALIZE = typeof ACTUALIZE

/** Main context of data storing and effects processing */
export interface Ctx {
  get<T>(atom: Atom<T>): T
  spy: null | (<T>(atom: Atom<T>) => T)
  schedule<T = void>(cb?: Fn<[Ctx], T>, isNearEffect?: boolean): Promise<T>

  run<T>(cb: Fn<[], T>): T
  read(meta: AtomMeta): AtomCache<any> | undefined
  log(cb: Fn<[patches: Logs, error: null | Error]>): Unsubscribe
  subscribe<T>(atom: Atom<T>, cb: Fn<[T]>): Unsubscribe
  cause: null | AtomCache
  /** @private  */
  [ACTUALIZE](
    meta: AtomMeta,
    mutator?: Fn<[patchCtx: Ctx, patch: AtomCache]>,
  ): AtomCache
}

export interface CtxSpy extends Ctx {
  spy<T>(atom: Atom<T>): T
}

export interface Logs extends Array<AtomCache> {}

export interface Atom<State = any> {
  __reatom: AtomMeta<State>

  pipe<T1>(operator1: Fn<[this], T1>): T1
  pipe<T1, T2>(operator1: Fn<[this], T1>, operator2: Fn<[T1], T2>): T2
  pipe<T1, T2, T3>(
    operator1: Fn<[this], T1>,
    operator2: Fn<[T1], T2>,
    operator3: Fn<[T2], T3>,
  ): T3
  pipe<T1, T2, T3, T4>(
    operator1: Fn<[this], T1>,
    operator2: Fn<[T1], T2>,
    operator3: Fn<[T2], T3>,
    operator4: Fn<[T3], T4>,
  ): T4
  pipe<T1, T2, T3, T4, T5>(
    operator1: Fn<[this], T1>,
    operator2: Fn<[T1], T2>,
    operator3: Fn<[T2], T3>,
    operator4: Fn<[T3], T4>,
    operator5: Fn<[T4], T5>,
  ): T5
}

export interface AtomMut<State = any> extends Atom<State> {
  (ctx: Ctx, update: Fn<[State], State> | State): State
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
  readonly onConnect: Set<Fn<[Ctx]>>
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

const assertFunction = (thing: any) =>
  throwError(
    typeof thing !== `function`,
    `invalid "${typeof thing}", function expected`,
  )

const copyCache = (cache: AtomCache, cause: AtomCache[`cause`]) => ({
  state: cache.state,
  meta: cache.meta,
  cause,
  parents: cache.parents,
  children: cache.children,
  listeners: cache.listeners,
})

export interface ContextOptions {
  /** Use it to delay or track late effects such as subscriptions notification */
  callLateEffect?: typeof callSafety
  /** Use it to delay or track near effects such as API calls */
  callNearEffect?: typeof callSafety

  createCache?: Fn<[AtomMeta], AtomCache>
}

const pushSpread = <T>(arr: Array<T>, iterable: Set<T> | Array<T>) =>
  iterable.forEach((el) => arr.push(el))

export const createContext = ({
  callLateEffect = callSafety,
  callNearEffect = callSafety,
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
    while (nearEffectsIdx < nearEffects.length) {
      callNearEffect(nearEffects[nearEffectsIdx++], ctx)
    }
    nearEffects = []
    nearEffectsIdx = 0
  }
  const walkLateEffects = () => {
    walkNearEffects()
    while (lateEffectsIdx < lateEffects.length) {
      callLateEffect(lateEffects[lateEffectsIdx++], ctx)
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
          addPatch(copyCache(childCache, null)).listeners.size === 0 &&
          childCache.children.size > 0
        )
          queue.push(childCache.children)
      })
    }
  }

  const actualizeParents = (ctx: Ctx, patch: AtomCache) => {
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
        throwError(
          done,
          `async spy "${atom.__reatom.name}" in "${patch.meta.name}")`,
        )

        const depPatch = actualize(atom.__reatom)
        const length = patch.parents.push(depPatch)

        isParentsChanged ||=
          length > parents.length || depPatch.meta !== parents[length - 1].meta

        return depPatch.state
      }

      patch.meta.computer!(ctx as CtxSpy, patch)

      done = true

      patch.cause = cause
    }

    return isParentsChanged
  }

  const actualize: Ctx[ACTUALIZE] = (meta, mutator) => {
    let { patch } = meta
    if (patch !== null && patch.cause !== null && mutator === undefined) {
      return patch!
    }
    let isPlain = meta.computer === null

    let cache = caches.get(meta) ?? (patch ??= addPatch(createCache(meta)))

    patch ??= addPatch(copyCache(cache, null))
    if (patch.cause !== null) patch = addPatch(copyCache(patch, null))

    let { state } = patch
    let isParentsChanged = false

    const patchCtx: Ctx = {
      get: ctx.get,
      spy: ctx.spy,
      schedule: ctx.schedule,
      run: ctx.run,
      read: ctx.read,
      log: ctx.log,
      subscribe: ctx.subscribe,
      cause: patch,
      [ACTUALIZE]: ctx[ACTUALIZE],
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
    get: ({ __reatom: meta }) =>
      inTr ? actualize(meta).state : ctx.run(() => actualize(meta).state),
    spy: null,
    // FIXME: asserts `inTr`
    schedule(effect = noop, isNearEffect = true) {
      assertFunction(effect)

      throwError(!inTr, `"schedule" is allowed only during transaction`)

      return new Promise<any>((res, rej) => {
        trRollbacks.push(rej)
        ;(isNearEffect ? trNearEffects : trLateEffects).push((ctx) => {
          try {
            res(effect(ctx))
          } catch (error) {
            rej(error)
          }
        })
      })
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
              parentCache.meta.patch ?? addPatch(copyCache(parentCache, cache))
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
          if (isStale(meta.patch!)) pushSpread(nearEffects, meta.onCleanup)
        }

        for (const meta of trLinks) {
          if (!isStale(meta.patch!) && !trUnlinks.has(meta)) {
            pushSpread(nearEffects, meta.onConnect)
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
            patch.listeners.forEach(
              meta.isAction
                ? ((patch.state = []),
                  (cb) => nearEffects.push(() => cb(state)))
                : (cb) => lateEffects.push(() => cb(caches.get(meta)!.state)),
            )
          }
        }

        pushSpread(nearEffects, trNearEffects)
        pushSpread(lateEffects, trLateEffects)

        resetTr()
      } catch (e: any) {
        trError = e = e instanceof Error ? e : new Error(String(e))
        for (const log of logsListeners) log(trLogs, e)
        for (const cb of trRollbacks) cb(e)
        for (const { meta } of trLogs) meta.patch = null

        resetTr()

        throw e
      }

      walkLateEffects()

      return result
    },
    read(meta) {
      return caches.get(meta)
    },
    log(cb) {
      assertFunction(cb)

      logsListeners.add(cb)
      return () => logsListeners.delete(cb)
    },
    subscribe(atom, cb) {
      assertFunction(cb)

      const { __reatom: meta } = atom

      let lastState = impossibleValue
      const fn: typeof cb = (state) =>
        Object.is(lastState, state) || cb((lastState = state))

      let cache = caches.get(meta)

      if (cache === undefined || isStale(cache)) {
        ctx.run(() => {
          trRollbacks.push(() => meta.patch!.listeners.delete(fn))
          actualize(meta, (ctx, patch) =>
            (patch.cause = patch).listeners.add(fn),
          )
        })
      } else {
        cache.listeners.add(fn)
      }

      if (lastState === impossibleValue) fn(caches.get(meta)!.state)

      return () => {
        throwError(inTr, `unsubscribe is not allowed during transaction`)

        if ((cache = caches.get(meta)!).listeners.delete(fn)) {
          if (isStale(cache)) {
            const queue: Array<AtomCache> = [copyCache(cache, cache)]
            for (const patch of queue) {
              caches.set(patch.meta, patch)
              pushSpread(nearEffects, patch.meta.onCleanup)

              for (const parentCache of patch.parents) {
                parentCache.children.delete(patch.meta)
                if (isStale(parentCache)) {
                  queue.push(copyCache(parentCache, patch))
                }
              }
            }
            walkLateEffects()
          }
        }
      }
    },
    cause: null,
    [ACTUALIZE]: (meta, mutator) =>
      inTr ? actualize(meta, mutator) : ctx.run(() => actualize(meta, mutator)),
  }

  return ctx
}

export interface AtomOptions
  extends Merge<Partial<Pick<AtomMeta, `name` | `isInspectable`>>> {}

// TODO
// const sid = ((Math.random() * 999) | 0).toString(36)
let count = 0

// @ts-ignore
export const atom: {
  <State>(
    initState: Fn<[CtxSpy], State>,
    options?: string | AtomOptions,
  ): Atom<State>
  <State>(initState: State, options?: string | AtomOptions): AtomMut<State>
} = (
  initState: Fn<[CtxSpy, any?]> | Exclude<AllTypes, Fn>,
  options: string | AtomOptions = {},
): Atom => {
  let atom: any = (ctx: Ctx, update: any) =>
    ctx[ACTUALIZE](
      meta,
      (patchCtx, patch) =>
        (patch.state =
          typeof update === `function` ? update(patch.state) : update),
    ).state
  let computer = null

  if (typeof initState === `function`) {
    atom = {}
    const userComputer = initState
    initState = undefined
    computer = (ctx: CtxSpy, patch: AtomCache) =>
      (patch.state = userComputer(ctx, patch.state))
  }

  let { name, isInspectable = !!name }: AtomOptions =
    typeof options === `string` ? { name: options } : options

  const meta: AtomMeta = {
    name: `${name ?? `atom`}[${++count}]`,
    isAction: false,
    isInspectable,
    initState,
    computer,
    onCleanup: new Set(),
    onConnect: new Set(),
    onUpdate: new Set(),
    patch: null,
  }

  atom.__reatom = meta

  atom.pipe = (...fns: Array<Fn>) => fns.reduce((acc, fn) => fn(acc), atom)

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
    fn = (ctx: Ctx, v?: any) => v
  }

  assertFunction(fn)

  const meta: AtomMeta = {
    name: `${name ?? `action`}[${++count}]`,
    isInspectable: true,
    isAction: true,
    initState: [],
    computer: null,
    onCleanup: new Set(),
    onConnect: new Set(),
    onUpdate: new Set(),
    patch: null,
  }

  const action: Action = (ctx: Ctx, ...params: any[]) =>
    ctx[ACTUALIZE](meta, (patchCtx, patch) => {
      patch.cause = ctx.cause ?? patch
      patch.state = patch.state.concat([(fn as Fn)(patchCtx, ...params)])
    }).state.at(-1)

  action.__reatom = meta

  action.pipe = (...fns: Array<Fn>) => fns.reduce((acc, fn) => fn(acc), action)

  return action
}
