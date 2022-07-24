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

export interface Pipe<This> {
  <T1>(operator1: Fn<[This], T1>): T1
  <T1, T2>(operator1: Fn<[This], T1>, operator2: Fn<[T1], T2>): T2
  /* prettier-ignore */ <T1, T2, T3>(operator1: Fn<[This], T1>, operator2: Fn<[T1], T2>, operator3: Fn<[T2], T3>): T3
  /* prettier-ignore */ <T1, T2, T3, T4>(operator1: Fn<[This], T1>, operator2: Fn<[T1], T2>, operator3: Fn<[T2], T3>, operator4: Fn<[T3], T4>): T4
  /* prettier-ignore */ <T1, T2, T3, T4, T5>(operator1: Fn<[This], T1>, operator2: Fn<[T1], T2>, operator3: Fn<[T2], T3>, operator4: Fn<[T3], T4>, operator5: Fn<[T4], T5>): T5
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6>(operator1: Fn<[This], T1>, operator2: Fn<[T1], T2>, operator3: Fn<[T2], T3>, operator4: Fn<[T3], T4>, operator5: Fn<[T4], T5>, operator6: Fn<[T5], T6>): T6
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7>(operator1: Fn<[This], T1>, operator2: Fn<[T1], T2>, operator3: Fn<[T2], T3>, operator4: Fn<[T3], T4>, operator5: Fn<[T4], T5>, operator6: Fn<[T5], T6>, operator7: Fn<[T6], T7>): T7
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7, T8>(operator1: Fn<[This], T1>, operator2: Fn<[T1], T2>, operator3: Fn<[T2], T3>, operator4: Fn<[T3], T4>, operator5: Fn<[T4], T5>, operator6: Fn<[T5], T6>, operator7: Fn<[T6], T7>, operator8: Fn<[T7], T8>): T8
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7, T8, T9>(operator1: Fn<[This], T1>, operator2: Fn<[T1], T2>, operator3: Fn<[T2], T3>, operator4: Fn<[T3], T4>, operator5: Fn<[T4], T5>, operator6: Fn<[T5], T6>, operator7: Fn<[T6], T7>, operator8: Fn<[T7], T8>, operator9: Fn<[T8], T9>): T9
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(operator1: Fn<[This], T1>, operator2: Fn<[T1], T2>, operator3: Fn<[T2], T3>, operator4: Fn<[T3], T4>, operator5: Fn<[T4], T5>, operator6: Fn<[T5], T6>, operator7: Fn<[T6], T7>, operator8: Fn<[T7], T8>, operator9: Fn<[T8], T9>, operator10: Fn<[T9], T10>): T10
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(operator1: Fn<[This], T1>, operator2: Fn<[T1], T2>, operator3: Fn<[T2], T3>, operator4: Fn<[T3], T4>, operator5: Fn<[T4], T5>, operator6: Fn<[T5], T6>, operator7: Fn<[T6], T7>, operator8: Fn<[T7], T8>, operator9: Fn<[T8], T9>, operator10: Fn<[T9], T10>, operator11: Fn<[T10], T11>): T11
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12>(operator1: Fn<[This], T1>, operator2: Fn<[T1], T2>, operator3: Fn<[T2], T3>, operator4: Fn<[T3], T4>, operator5: Fn<[T4], T5>, operator6: Fn<[T5], T6>, operator7: Fn<[T6], T7>, operator8: Fn<[T7], T8>, operator9: Fn<[T8], T9>, operator10: Fn<[T9], T10>, operator11: Fn<[T10], T11>, operator12: Fn<[T11], T12>): T12
}

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

/** Main context of data storing and effects processing */
export interface Ctx {
  get<T>(atom: Atom<T>): T
  get<T>(
    cb: Fn<
      [read: Fn<[meta: AtomMeta], AtomCache<any> | undefined>, fn?: Fn],
      T
    >,
  ): T
  spy?: <T>(atom: Atom<T>) => T
  schedule<T = void>(cb: Fn<[Ctx], T>, isNearEffect?: boolean): Promise<T>

  subscribe<T>(atom: Atom<T>, cb: Fn<[T]>): Unsubscribe
  subscribe(cb: Fn<[patches: Logs, error?: Error]>): Unsubscribe
  cause: null | AtomCache
  // [ACTUALIZE](
  //   meta: AtomMeta,
  //   mutator?: Fn<[patchCtx: Ctx, patch: AtomCache]>,
  // ): AtomCache
}

export interface CtxSpy extends Required<Ctx> {}

export interface Logs extends Array<AtomCache> {}

export interface Atom<State = any> {
  __reatom: AtomMeta<State>
  pipe: Pipe<this>
}

type Update<State> = State | Fn<[State, Ctx], State>
export interface AtomMut<State = any, U = Update<State>> extends Atom<State> {
  (ctx: Ctx, update: U): State
}

export interface AtomMeta<State = any> {
  name: undefined | string
  isAction: boolean
  // temporal cache of the last patch during transaction
  patch: null | AtomCache
  initState: Fn<[Ctx], State>
  computer: null | Fn<[CtxSpy, AtomCache]>
  onCleanup: null | Set<Fn<[Ctx]>>
  onConnect: null | Set<Fn<[Ctx]>>
  onUpdate: null | Set<Fn<[Ctx, AtomCache]>>
}

// The order of properties is sorted by debugging purposes
// (the most interesting properties are at the top)
export interface AtomCache<State = any> {
  state: State
  isConnected: boolean
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
  return thing?.__reatom?.isAction === true
}

export const isConnected = (cache: AtomCache): boolean => {
  return cache.children.size + cache.listeners.size > 0
}

const assertFunction = (thing: any) =>
  throwReatomError(
    typeof thing !== `function`,
    `invalid "${typeof thing}", function expected`,
  )

const copyCache = (
  cache: AtomCache,
  cause: AtomCache[`cause`] = null,
): AtomCache => ({
  state: cache.state,
  isConnected: cache.isConnected,
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
  const read = (meta: AtomMeta): undefined | AtomCache => caches.get(meta)
  let logsListeners = new Set<Fn<[Logs, Error?]>>()

  let nearEffects: Array<Fn<[Ctx]>> = []
  let lateEffects: Array<Fn<[Ctx]>> = []

  // `tr` is short for `transaction`
  let inTr = false
  let trError: null | Error = null
  let trNearEffectsStart: typeof nearEffects.length = 0
  let trLateEffectsStart: typeof lateEffects.length = 0
  let trLogs: Array<AtomCache> = []
  let trRollbacks: Array<Fn> = []

  const walkNearEffects = () => {
    for (const effect of nearEffects) callNearEffect(effect, ctx)

    nearEffects = []
  }
  const walkLateEffects = () => {
    if (trNearEffectsStart + trLateEffectsStart > 0) return

    walkNearEffects()
    for (const effect of lateEffects) {
      callLateEffect(effect, ctx)
      if (nearEffects.length > 0) walkNearEffects()
    }

    lateEffects = []

    trNearEffectsStart = trLateEffectsStart = 0
  }

  const addPatch = (patch: AtomCache) => {
    trLogs.push((patch.meta.patch = patch))
    return patch
  }

  const enqueueComputers = (cache: AtomCache) => {
    for (let i = 0, queue = [cache.children]; i < queue.length; ) {
      for (const childMeta of queue[i++]!) {
        const childCache = childMeta.patch ?? caches.get(childMeta)!

        if (
          childCache.cause !== null &&
          addPatch(copyCache(childCache)).listeners.size === 0 &&
          childCache.children.size > 0
        )
          queue.push(childCache.children)
      }
    }
  }

  const actualizeParents = (patchCtx: Ctx, patch: AtomCache) => {
    let { cause, meta, parents } = patch

    if (
      parents.length === 0 ||
      parents.some(
        ({ meta, state }) =>
          !Object.is(state, (cause = actualize(patchCtx, meta)).state),
      )
    ) {
      const newParents: typeof parents = []

      patchCtx.spy = (atom: Atom) => {
        throwReatomError(patch.parents !== parents, `async spy`)

        const depPatch = actualize(patchCtx, atom.__reatom)
        const prevDepPatch = parents.at(newParents.push(depPatch) - 1)

        // TODO tests!
        if (prevDepPatch?.meta !== depPatch.meta) {
          if (prevDepPatch !== undefined) {
            prevDepPatch.children.delete(meta)
            trRollbacks.push(() => prevDepPatch.children.add(meta))
            // stale branch
            const prevDepPatchDirty = prevDepPatch.meta.patch
            if (prevDepPatchDirty !== null) prevDepPatchDirty.cause ??= patch
          }
          if (!depPatch.children.has(meta)) {
            depPatch.children.add(meta)
            trRollbacks.push(() => depPatch.children.delete(meta))
          }
        }

        return depPatch.state
      }

      patch.meta.computer!(patchCtx as CtxSpy, patch)

      patch.cause = cause

      // TODO try to made optimized version of tracking for huge collection (ListAtom)
      /* if (patch.parents === parents) */
      patch.parents = newParents
    }
  }

  const actualize = (
    ctx: Ctx,
    meta: AtomMeta,
    mutator?: Fn<[patchCtx: Ctx, patch: AtomCache]>,
  ): AtomCache => {
    let { patch } = meta
    let hasPatch = patch !== null
    let isActual = hasPatch && patch!.cause !== null
    let isMutating = mutator !== undefined
    let isComputed = meta.computer !== null
    let isInit = false
    let cache = hasPatch
      ? patch!
      : caches.get(meta) ??
        ((isInit = true),
        {
          state: meta.initState(ctx),
          isConnected: false,
          meta,
          cause: null,
          parents: [],
          children: new Set(),
          listeners: new Set(),
        })

    if (isActual && !isMutating) return patch!

    patch = !hasPatch || isActual ? addPatch(copyCache(cache)) : patch!

    if (isComputed || isMutating || isInit) {
      const { state } = patch
      const patchCtx: Ctx = {
        get: ctx.get,
        spy: undefined,
        schedule: ctx.schedule,
        subscribe: ctx.subscribe,
        cause: patch,
        // [ACTUALIZE]: ctx[ACTUALIZE],
      }

      if (isMutating) mutator!(patchCtx, patch)

      if (isComputed) actualizeParents(patchCtx, patch)

      if (!Object.is(state, patch.state)) {
        if (patch.children.size > 0) enqueueComputers(patch)

        meta.onUpdate?.forEach((hook) => hook(ctx, patch!))
      }
    }

    // TODO patch.cause ??= ctx.cause ?? patch
    patch.cause ??= patch

    return patch
  }

  const ctx: Ctx = {
    spy: undefined,
    schedule(effect, isNearEffect = true) {
      throwReatomError(!inTr, `async schedule`)
      assertFunction(effect)
      throwReatomError(this === undefined, `missed context`)

      return new Promise<any>((res, rej) => {
        trRollbacks.push(rej)
        ;(isNearEffect ? nearEffects : lateEffects).push(() => {
          try {
            res(effect(this))
          } catch (error) {
            rej(error)
          }
        })
      })
    },
    get(atomOrCb) {
      if (isAtom(atomOrCb)) {
        const meta = atomOrCb.__reatom
        return inTr
          ? actualize(this, meta).state
          : meta.computer === null && caches.has(meta)
          ? caches.get(meta)!.state
          : this.get(() => actualize(this, meta).state)
      }

      throwReatomError(trError !== null, `tr failed`)

      if (inTr) return atomOrCb(read, actualize)

      inTr = true
      trNearEffectsStart = nearEffects.length
      trLateEffectsStart = lateEffects.length

      try {
        var result = atomOrCb(read, actualize)

        if (trLogs.length === 0) return result

        for (let patch of trLogs) {
          if (patch.listeners.size > 0) actualize(this, patch.meta)
        }

        for (const log of logsListeners) log(trLogs)

        for (const {
          meta,
          meta: { patch },
        } of trLogs) {
          if (patch !== null) {
            meta.patch = null
            if (
              patch.isConnected !== (patch.isConnected = isConnected(patch))
            ) {
              const testParent = (parentPatch: AtomCache) =>
                !isConnected(parentPatch) &&
                parentPatch.meta.patch === null &&
                addPatch(copyCache(parentPatch, patch))

              if (patch.isConnected) {
                pushIterable(nearEffects, meta.onConnect)
                for (const parentPatch of patch.parents) {
                  testParent(parentPatch)
                  parentPatch.children.add(meta)
                }
              } else {
                pushIterable(nearEffects, meta.onCleanup)
                for (const parentPatch of patch.parents) {
                  parentPatch.children.delete(meta)
                  testParent(parentPatch)
                }
              }
            }

            if (patch.cause !== null) {
              caches.set(meta, patch!)
              const { state } = patch
              patch.listeners.forEach(
                meta.isAction
                  ? ((patch.state = []),
                    (cb) => nearEffects.push(() => cb(state)))
                  : (cb) => lateEffects.push(() => cb(caches.get(meta)!.state)),
              )
            }
          }
        }
      } catch (e: any) {
        trError = e = e instanceof Error ? e : new Error(String(e))
        for (const log of logsListeners) log(trLogs, e)
        for (const cb of trRollbacks) callSafety(cb, e)
        for (const { meta } of trLogs) meta.patch = null

        nearEffects.length = trNearEffectsStart
        lateEffects.length = trLateEffectsStart

        throw e
      } finally {
        inTr = false
        trError = null
        trLogs = []
        trRollbacks = []
      }

      walkLateEffects()

      return result
    },
    // @ts-ignore
    subscribe(atom, cb = atom) {
      assertFunction(cb)

      if (atom === cb) {
        logsListeners.add(cb)
        return () => logsListeners.delete(cb)
      }

      const { __reatom: meta } = atom

      let lastState = impossibleValue
      const fn = (state: any) =>
        Object.is(lastState, state) || cb((lastState = state))

      let cache = caches.get(meta)

      if (cache === undefined || !isConnected(cache)) {
        this.get(() => {
          trRollbacks.push(() => meta.patch!.listeners.delete(fn))
          actualize(this, meta).listeners.add(fn)
        })
      } else {
        cache.listeners.add(fn)
      }

      if (lastState === impossibleValue) fn(caches.get(meta)!.state)

      return () => {
        if (
          (cache = caches.get(meta)!).listeners.delete(fn) &&
          !isConnected(cache)
        ) {
          this.get(() => actualize(this, meta))
        }
      }
    },
    cause: null,
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
    ctx.get(
      (read, actualize) =>
        actualize!(ctx, atom.__reatom, (patchCtx: CtxSpy, patch: AtomCache) => {
          patch.cause = ctx.cause
          patch.state =
            typeof update === `function`
              ? update(patch.state, patchCtx)
              : update
        }).state,
    )
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
    patch: null,
    initState: () => initState,
    computer,
    onCleanup: null,
    onConnect: null,
    onUpdate: null,
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

  const action: Action = Object.assign((ctx: Ctx, ...params: any[]) => {
    actionAtom(
      ctx,
      (state, patchCtx) => (
        (patchCtx.spy = undefined),
        // @ts-ignore
        state.concat([(params = (fn as Fn)(patchCtx, ...params))])
      ),
    )
    return params
  }, actionAtom)
  action.__reatom.isAction = true

  return action
}
