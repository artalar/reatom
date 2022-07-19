// --- UTILS

export interface Rec<Values = any> extends Record<string, Values> {}

export interface Fn<Args extends any[] = any[], Return = any> {
  (...a: Args): Return
}

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

export const throwReatomError = (condition: any, message: string) => {
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
  pipe: Pipe<this>
}
export interface Pipe<This> {
  <T1>(operator1: Fn<[This], T1>): T1
  <T1, T2>(operator1: Fn<[This], T1>, operator2: Fn<[T1], T2>): T2
  <T1, T2, T3>(
    operator1: Fn<[This], T1>,
    operator2: Fn<[T1], T2>,
    operator3: Fn<[T2], T3>,
  ): T3
  <T1, T2, T3, T4>(
    operator1: Fn<[This], T1>,
    operator2: Fn<[T1], T2>,
    operator3: Fn<[T2], T3>,
    operator4: Fn<[T3], T4>,
  ): T4
  <T1, T2, T3, T4, T5>(
    operator1: Fn<[This], T1>,
    operator2: Fn<[T1], T2>,
    operator3: Fn<[T2], T3>,
    operator4: Fn<[T3], T4>,
    operator5: Fn<[T4], T5>,
  ): T5
}

export interface AtomMut<State = any> extends Atom<State> {
  (ctx: Ctx, update: State | Fn<[State, Ctx], State>): State
}

export interface AtomMeta<State = any> {
  name: undefined | string
  isAction: boolean
  // temporal cache of the last patch during transaction
  patch: null | AtomCache
  computer: null | Fn<[CtxSpy, AtomCache]>
  initState: Fn<[Ctx], State>
  onCleanup: null | Set<Fn<[Ctx]>>
  onConnect: null | Set<Fn<[Ctx]>>
  onUpdate: null | Set<Fn<[Ctx, AtomCache]>>
}

// The order of properties is sorted by debugging purposes
// (the most interesting properties are at the top)
export interface AtomCache<State = any> {
  state: State
  readonly meta: AtomMeta
  // nullable state mean cache is dirty (has updated parents, which could produce new state)
  cause: null | AtomCache
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
  return isAtom(thing) && thing.__reatom.isAction
}

export const isStale = (cache: AtomCache): boolean => {
  return cache.children.size + cache.listeners.size === 0
}

const assertFunction = (thing: any) =>
  throwReatomError(
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
}

const pushIterable = <T>(arr: Array<T>, iterable: null | Set<T> | Array<T>) => {
  if (iterable !== null) for (const el of iterable) arr.push(el)
}

export const createContext = ({
  callLateEffect = callSafety,
  callNearEffect = callSafety,
}: ContextOptions = {}): Ctx => {
  let caches = new WeakMap<AtomMeta, AtomCache>()
  let logsListeners = new Set<Fn<[Logs, null | Error]>>()

  let inEffects = false
  let nearEffects: Array<Fn<[Ctx]>> = []
  let lateEffects: Array<Fn<[Ctx]>> = []

  // `tr` is short for `transaction`
  let inTr: boolean
  let trNearEffects: Array<Fn>
  let trError: Error | null
  let trLateEffects: Array<Fn>
  let trLinks: Set<AtomMeta>
  let trLogs: Array<AtomCache>
  let trRollbacks: Array<Fn>
  let trUnlinks: Set<AtomMeta>
  let resetTr = () =>
    ([
      inTr,
      trNearEffects,
      trError,
      trLateEffects,
      trLinks,
      trLogs,
      trRollbacks,
      trUnlinks,
    ] = [false, [], null, [], new Set(), [], [], new Set()])

  resetTr()

  const walkNearEffects = () => {
    for (const effect of nearEffects) callNearEffect(effect, ctx)

    nearEffects = []
  }
  const walkLateEffects = () => {
    if (inEffects) return
    inEffects = true

    walkNearEffects()
    for (const effect of lateEffects) {
      callLateEffect(effect, ctx)
      if (nearEffects.length > 0) walkNearEffects()
    }

    lateEffects = []

    inEffects = false
  }

  const addPatch = (patch: AtomCache) => {
    trLogs.push((patch.meta.patch = patch))
    return patch
  }

  const enqueueComputers = (cache: AtomCache) => {
    for (let i = 0, queue = [cache.children]; i < queue.length; ) {
      queue[i++]!.forEach((childMeta) => {
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
    let { cause, parents } = patch
    let isParentsChanged = parents.length === 0

    if (
      isParentsChanged ||
      parents.some(
        ({ meta, state }) => !Object.is(state, (cause = actualize(meta)).state),
      )
    ) {
      const newParents: typeof parents = []

      ctx.spy = (atom: Atom) => {
        throwReatomError(patch.parents === newParents, `async spy`)

        const depPatch = actualize(atom.__reatom)
        const length = newParents.push(depPatch)

        isParentsChanged ||=
          length > parents.length || depPatch.meta !== parents[length - 1]!.meta

        return depPatch.state
      }

      patch.meta.computer!(ctx as CtxSpy, patch)

      patch.cause = cause

      patch.parents = newParents
    }

    return isParentsChanged
  }

  const actualize: Ctx[ACTUALIZE] = (meta, mutator) => {
    let { patch } = meta
    let hasPatch = patch !== null
    let isActual = hasPatch && patch!.cause !== null
    let isMutating = mutator !== undefined

    if (isActual && !isMutating) return patch!

    let isComputed = meta.computer !== null

    // TODO ?
    // throwReatomError(isMutating && isComputed, `cannot mutate computed atom`)

    let cache = hasPatch ? patch! : caches.get(meta)
    let isInit = cache === undefined

    if (isInit) {
      cache = {
        state: meta.initState(ctx),
        meta,
        cause: null,
        parents: [],
        children: new Set(),
        listeners: new Set(),
      }
    } else if (!isComputed && !isMutating) {
      ;(meta.patch = cache!).cause // FIXME write tests /* ??= ctx.cause ?? meta.patch */
      return meta.patch
    }

    // FIXME reassigned for right none nullable type inference
    patch =
      !hasPatch || isActual
        ? addPatch(isInit ? cache! : copyCache(cache!, cache!))
        : patch!

    let { state } = patch

    const patchCtx: Ctx = {
      get: ctx.get,
      spy: null,
      schedule: ctx.schedule,
      run: ctx.run,
      read: ctx.read,
      log: ctx.log,
      subscribe: ctx.subscribe,
      cause: patch,
      [ACTUALIZE]: ctx[ACTUALIZE],
    }

    if (isMutating) mutator!(patchCtx, patch)

    if (isComputed && actualizeParents(patchCtx, patch)) {
      if (!isStale(patch)) trUnlinks.add(meta)
      trLinks.add(meta)
    }

    if (!Object.is(state, patch.state)) {
      if (patch.children.size > 0) enqueueComputers(patch)

      meta.onUpdate?.forEach((hook) => hook(ctx, patch!))
    }

    patch.cause ??= ctx.cause ?? patch

    return patch
  }

  const ctx: Ctx = {
    get: ({ __reatom: meta }) =>
      inTr
        ? actualize(meta).state
        : meta.computer === null && caches.has(meta)
        ? caches.get(meta)!.state
        : ctx.run(() => actualize(meta).state),
    spy: null,
    // FIXME: asserts `inTr`
    schedule(
      // @ts-expect-error
      effect = () => {},
      isNearEffect = true,
    ) {
      assertFunction(effect)

      throwReatomError(!inTr, `"schedule" is allowed only during transaction`)

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
          if (isStale(meta.patch!)) pushIterable(nearEffects, meta.onCleanup)
        }

        for (const meta of trLinks) {
          if (!isStale(meta.patch!) && !trUnlinks.has(meta)) {
            pushIterable(nearEffects, meta.onConnect)
          }
        }

        for (const log of logsListeners) log(trLogs, trError)

        for (const {
          meta,
          meta: { patch },
        } of trLogs) {
          if (patch !== null && patch.cause !== null) {
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

        pushIterable(nearEffects, trNearEffects)
        pushIterable(lateEffects, trLateEffects)

        resetTr()
      } catch (e: any) {
        trError = e = e instanceof Error ? e : new Error(String(e))
        for (const log of logsListeners) log(trLogs, e)
        for (const cb of trRollbacks) callSafety(cb, e)
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
          actualize(meta).listeners.add(fn)
        })
      } else {
        cache.listeners.add(fn)
      }

      if (lastState === impossibleValue) fn(caches.get(meta)!.state)

      return () => {
        throwReatomError(inTr, `unsubscribe is not allowed during transaction`)

        if ((cache = caches.get(meta)!).listeners.delete(fn)) {
          if (isStale(cache)) {
            const queue: Array<AtomCache> = [copyCache(cache, cache)]
            for (const patch of queue) {
              caches.set(patch.meta, patch)
              pushIterable(nearEffects, patch.meta.onCleanup)

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

// @ts-ignore
export const atom: {
  <State>(initState: Fn<[CtxSpy], State>, name?: string): Atom<State>
  <State>(initState: State, name?: string): AtomMut<State>
} = (
  initState: Fn<[CtxSpy, any?]> | Exclude<AllTypes, Fn>,
  name?: string,
): Atom => {
  let atom: any = (ctx: Ctx, update: any) =>
    ctx[ACTUALIZE](atom.__reatom, (patchCtx, patch) => {
      patch.cause = ctx.cause
      patch.state =
        typeof update === `function` ? update(patch.state, patchCtx) : update
    }).state
  let computer = null

  if (typeof initState === `function`) {
    atom = {}
    const userComputer = initState
    initState = undefined
    computer = (ctx: CtxSpy, patch: AtomCache) =>
      (patch.state = userComputer(ctx, patch.state))
  }

  atom.__reatom = {
    name,
    isAction: false,
    initState: () => initState,
    computer,
    onCleanup: null,
    onConnect: null,
    onUpdate: null,
    patch: null,
  }

  atom.pipe = function (...fns: Array<Fn>) {
    return fns.reduce((acc, fn) => fn(acc), this)
  }

  // @ts-ignore
  return atom
}

let actionsCount = 0
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

  const actionAtom = atom([], `${name ?? ``}[${++actionsCount}]action`)

  const action: Action = Object.assign(
    (ctx: Ctx, ...params: any[]) => {
      actionAtom(ctx, (state, patchCtx) =>
        // @ts-ignore
        state.concat([(params = (fn as Fn)(patchCtx, ...params))]),
      )
      return params
    }, //?
    actionAtom,
  )
  action.__reatom.isAction = true

  return action
}
