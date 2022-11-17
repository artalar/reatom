//#region TYPE UTILS

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

//#endregion

//#region UTILS

const impossibleValue: any = Symbol()

export const callSafely = <I extends any[], O>(
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

//#endregion

//#region DOMAIN TYPES

/** Main context of data storing and effects processing */
export interface Ctx {
  get<T>(atom: Atom<T>): T
  get<T>(
    cb: Fn<
      [
        read: Fn<[proto: AtomProto], AtomCache<any> | undefined>,
        // this is `actualize` function and
        // the types intentionally awkward
        // coz it only for internal usage
        fn?: Fn,
      ],
      T
    >,
  ): T
  spy?: <T>(atom: Atom<T>) => T

  schedule<T = void>(
    cb: Fn<[Ctx], T>,
    step?: -1 | 0 | 1 | 2,
  ): Promise<Awaited<T>>

  subscribe<T>(atom: Atom<T>, cb: Fn<[T]>): Unsubscribe
  subscribe(cb: Fn<[patches: Logs, error?: Error]>): Unsubscribe

  cause: AtomCache
}

export interface CtxSpy extends Required<Ctx> {}

export interface Logs extends Array<AtomCache> {}

export interface Atom<State = any> {
  __reatom: AtomProto<State>
  pipe: Pipe<this>
}

type Update<State> = State | Fn<[State, Ctx], State>
export interface AtomMut<State = any> extends Atom<State> {
  (ctx: Ctx, update: Update<State>): State
}

export interface AtomProto<State = any> {
  name: undefined | string
  isAction: boolean
  /** temporal cache of the last patch during transaction */
  patch: null | AtomCache
  initState: Fn<[Ctx], State>
  computer: null | Fn<[CtxSpy, unknown], unknown>
  connectHooks: null | Set<Fn<[Ctx]>>
  disconnectHooks: null | Set<Fn<[Ctx]>>
  updateHooks: null | Set<Fn<[Ctx, AtomCache]>>
}

export interface AtomCache<State = any> {
  state: State
  readonly proto: AtomProto
  // nullable state mean cache is dirty (has updated pubs, which could produce new state)
  cause: null | AtomCache
  pubs: Array<AtomCache>
  readonly subs: Set<AtomProto>
  readonly listeners: Set<Fn>
}

export interface Action<Params extends any[] = any[], Payload = any>
  extends Atom<Array<{ params: Params; payload: Payload }>> {
  (ctx: Ctx, ...params: Params): Payload
}

export type AtomState<T> = T extends Atom<infer State> ? State : never

export type ActionParams<T> = T extends Action<infer Params, any>
  ? Params
  : never
export type ActionPayload<T> = T extends Action<any, infer Payload>
  ? Payload
  : never

type DefinitelyReturnType<T> = T extends Fn<any[], infer T> ? T : never
export type IsAction<T> = T extends Fn &
  Atom<infer State extends Array<{ payload: DefinitelyReturnType<T> }>>
  ? true
  : false

export type AtomReturn<T extends Atom> = T extends Fn
  ? ReturnType<T>
  : AtomState<T>

export type CtxParams<T, Else = never> = T extends Fn<[Ctx, ...infer Params]>
  ? Params
  : T extends [Ctx, ...infer Params]
  ? Params
  : Else

type AtomProperties<T> = keyof Omit<T, '__reatom' | 'pipe'>

export interface Unsubscribe {
  (): void
}

//#endregion

//#region DOMAIN UTILS

/** Throws `Reatom error: ${message}` */
export const throwReatomError = (condition: any, message: string) => {
  if (condition) throw new Error(`Reatom error: ${message}`)
}

export const isAtom = (thing: any): thing is Atom => {
  return thing?.__reatom !== undefined
}

export const isAction = (thing: any): thing is Action => {
  return thing?.__reatom?.isAction === true
}

// export const getCache = <T>(ctx: Ctx, anAtom: Atom<T>): AtomCache<T> =>
//   ctx.get((read) => (ctx.get(anAtom), read(anAtom.__reatom)!))

const isConnected = (cache: AtomCache): boolean => {
  return cache.subs.size + cache.listeners.size > 0
}

const assertFunction = (thing: any) =>
  throwReatomError(
    typeof thing !== 'function',
    `invalid "${typeof thing}", function expected`,
  )

//#endregion

export interface CtxOptions {
  /** Use it to delay or track late effects such as subscriptions notification */
  callLateEffect?: typeof callSafely
  /** Use it to delay or track near effects such as API calls */
  callNearEffect?: typeof callSafely
}

export const createCtx = ({
  callLateEffect = callSafely,
  callNearEffect = callSafely,
}: CtxOptions = {}): Ctx => {
  const caches = new WeakMap<AtomProto, AtomCache>()
  const read = (proto: AtomProto): undefined | AtomCache => caches.get(proto)
  const logsListeners = new Set<Fn<[Logs, Error?]>>()

  let commits: Array<Fn<[Ctx]>> = []
  let nearEffects: Array<Fn<[Ctx]>> = []
  let lateEffects: Array<Fn<[Ctx]>> = []

  // 'tr' is short for 'transaction'
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

  const addPatch = (cache: AtomCache) => {
    trLogs.push(
      (cache.proto.patch = {
        state: cache.state,
        proto: cache.proto,
        cause: null,
        pubs: cache.pubs,
        subs: cache.subs,
        listeners: cache.listeners,
      }),
    )
    return cache.proto.patch
  }

  const enqueueComputers = (subs: AtomCache['subs']) => {
    for (const subProto of subs.keys()) {
      const subCache = subProto.patch ?? read(subProto)!

      if (subCache.cause !== null) {
        if (addPatch(subCache).listeners.size === 0) {
          enqueueComputers(subCache.subs)
        }
      }
    }
  }

  const disconnect = (proto: AtomProto, pubPatch: AtomCache): void => {
    if (pubPatch.subs.delete(proto)) {
      trRollbacks.push(() => pubPatch.subs.add(proto))

      if (!isConnected(pubPatch)) {
        if (pubPatch.proto.disconnectHooks !== null) {
          nearEffects.push(...pubPatch.proto.disconnectHooks)
        }

        for (const parentParent of pubPatch.pubs) {
          disconnect(pubPatch.proto, parentParent)
        }
      }
    }
  }

  const connect = (proto: AtomProto, pubPatch: AtomCache) => {
    if (!pubPatch.subs.has(proto)) {
      const wasConnected = isConnected(pubPatch)
      pubPatch.subs.add(proto)
      trRollbacks.push(() => pubPatch.subs.delete(proto))

      if (!wasConnected) {
        if (pubPatch.proto.connectHooks !== null) {
          nearEffects.push(...pubPatch.proto.connectHooks)
        }

        for (const parentParentPatch of pubPatch.pubs) {
          connect(pubPatch.proto, parentParentPatch)
        }
      }
    }
  }

  const actualizePubs = (patchCtx: Ctx, patch: AtomCache) => {
    let { cause, proto, pubs } = patch
    let connected = false
    let toDisconnect = new Set<AtomProto>()
    let toConnect = new Set<AtomProto>()

    if (
      pubs.length === 0 ||
      pubs.some(
        ({ proto, state }) =>
          !Object.is(state, (cause = actualize(patchCtx, proto)).state),
      )
    ) {
      const newPubs: typeof pubs = []

      patchCtx.spy = ({ __reatom: depProto }: Atom) => {
        if (patch.pubs === pubs) {
          const depPatch = actualize(patchCtx, depProto)
          const prevDepPatch =
            newPubs.push(depPatch) <= pubs.length
              ? pubs[newPubs.length - 1]
              : undefined
          const isDepChanged = prevDepPatch?.proto !== depPatch.proto

          if (isDepChanged && (connected ||= isConnected(patch))) {
            if (prevDepPatch) toDisconnect.add(prevDepPatch.proto)
            toConnect.add(depProto)
          }

          return depProto.isAction && !isDepChanged
            ? depPatch.state.slice(prevDepPatch.state.length)
            : depPatch.state
        } else {
          throwReatomError(1, 'async spy')
        }
      }

      patch.state = patch.proto.computer!(patchCtx as CtxSpy, patch.state)
      patch.cause = cause
      patch.pubs = newPubs

      for (let i = newPubs.length; i < pubs.length; i++) {
        toDisconnect.add(pubs[i]!.proto)
      }

      if (connected) {
        for (const depProto of toDisconnect) {
          toConnect.has(depProto) ||
            disconnect(proto, depProto.patch ?? read(depProto)!)
        }

        for (const depProto of toConnect) {
          connect(proto, depProto.patch!)
        }
      }
    }
  }

  const actualize = (
    ctx: Ctx,
    proto: AtomProto,
    mutator?: Fn<[patchCtx: Ctx, patch: AtomCache]>,
  ): AtomCache => {
    let { patch } = proto
    let hasPatch = patch !== null
    let isActual = hasPatch && patch!.cause !== null
    let isMutating = mutator !== undefined

    if (!isActual || isMutating) {
      let isComputed = proto.computer !== null
      let isInit = false
      let cache = hasPatch
        ? patch!
        : read(proto) ??
          ((isInit = true),
          {
            state: proto.initState(ctx),
            proto,
            cause: null,
            pubs: [],
            subs: new Set(),
            listeners: new Set(),
          })

      patch = !hasPatch || isActual ? addPatch(cache) : patch!

      if (isComputed || isMutating || isInit) {
        const { state } = patch
        const patchCtx: Ctx = {
          get: ctx.get,
          spy: undefined,
          schedule: ctx.schedule,
          subscribe: ctx.subscribe,
          cause: patch,
        }

        if (isMutating) mutator!(patchCtx, patch)

        if (isComputed) actualizePubs(patchCtx, patch)

        if (!Object.is(state, patch.state)) {
          if (patch.subs.size > 0 && (isMutating || patch.listeners.size > 0)) {
            enqueueComputers(patch.subs)
          }

          proto.updateHooks?.forEach((hook) => hook(ctx, patch!))
        }
      }

      patch.cause ??= ctx.cause
    }

    return patch!
  }

  const ctx: Ctx = {
    get(atomOrCb) {
      if (isAtom(atomOrCb)) {
        const proto = atomOrCb.__reatom
        if (inTr) return actualize(this, proto).state
        const cache = read(proto)

        return cache !== undefined &&
          (proto.computer === null || isConnected(cache))
          ? cache.state
          : this.get(() => actualize(this, proto).state)
      }

      throwReatomError(trError !== null, 'tr failed')

      if (inTr) return atomOrCb(read, actualize)

      inTr = true
      trNearEffectsStart = nearEffects.length
      trLateEffectsStart = lateEffects.length

      try {
        var result = atomOrCb(read, actualize)

        if (trLogs.length === 0) return result

        for (let i = 0; i < trLogs.length; ) {
          const patch = trLogs[i]!
          if (patch.listeners.size > 0) {
            actualize(this, patch.proto)
          }
          if (++i === trLogs.length) {
            for (const commit of commits) commit(this)
          }
        }

        for (const log of logsListeners) log(trLogs)

        for (let patch of trLogs) {
          const { proto, state } = patch
          if (proto.isAction) patch.state = []

          if (patch === proto.patch) {
            proto.patch = null

            if (patch.cause !== null) {
              caches.set(proto, patch)

              if (proto.isAction) {
                if (state.length === 0) continue
                for (const cb of patch.listeners) {
                  nearEffects.push(() => cb(state))
                }
              } else {
                for (const cb of patch.listeners) {
                  lateEffects.push(() => cb(read(proto)!.state))
                }
              }
            }
          }
        }
      } catch (e: any) {
        trError = e = e instanceof Error ? e : new Error(String(e))
        for (const log of logsListeners) log(trLogs, e)
        for (const cb of trRollbacks) callSafely(cb, e)
        for (const { proto } of trLogs) proto.patch = null

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
    spy: undefined,
    schedule(effect, step = 1) {
      assertFunction(effect)
      throwReatomError(this === undefined, 'missed context')

      const promise = new Promise<any>((res, rej) => {
        if (!inTr) return res(effect(this))

        if (step === -1) {
          rej = effect
        } else {
          ;([commits, nearEffects, lateEffects] as const)[step].push(() => {
            try {
              res(effect(this))
            } catch (error) {
              rej(error)
            }
          })
        }

        trRollbacks.push(rej)
      })

      // prevent uncaught error
      // when schedule promise is unused
      promise.catch(() => {})

      return promise
    },
    // @ts-ignore
    subscribe(atom, cb = atom) {
      assertFunction(cb)

      if (atom === cb) {
        logsListeners.add(cb)
        return () => logsListeners.delete(cb)
      }

      const { __reatom: proto } = atom as Atom

      let lastState = impossibleValue
      const listener = (state: any) =>
        Object.is(lastState, state) || cb((lastState = state))

      let cache = read(proto)

      if (cache === undefined || !isConnected(cache)) {
        this.get(() => {
          cache = actualize(this, proto, (patchCtx, patch) => {})
          cache.listeners.add(listener)
          trRollbacks.push(() => proto.patch!.listeners.delete(listener))
          if (proto.connectHooks !== null) {
            nearEffects.push(...proto.connectHooks)
          }
          for (const pubPatch of cache.pubs) connect(proto, pubPatch)
        })
      } else {
        cache.listeners.add(listener)
      }

      if (lastState === impossibleValue) {
        listener((proto.patch ?? read(proto)!).state)
      }

      return () => {
        if (cache!.listeners.delete(listener) && !isConnected(cache!)) {
          if (!inTr) {
            trNearEffectsStart = nearEffects.length
            trLateEffectsStart = lateEffects.length
          }
          proto.disconnectHooks && nearEffects.push(...proto.disconnectHooks)

          for (const pubCache of cache!.pubs) {
            disconnect(proto, pubCache)
          }

          if (!inTr) {
            trRollbacks.length = 0
            walkLateEffects()
          }
        }
      }
    },
    cause: undefined as any,
  }

  ctx.cause = ctx.get(() => actualize(ctx, __root))
  ctx.cause.cause = null

  return ctx
}

// @ts-ignore
export const atom: {
  <T extends (ctx: CtxSpy) => any>(initState: T, name?: string): Atom<
    ReturnType<T>
  >
  <State>(initState: State, name?: string): AtomMut<State>
} = (
  initState: Fn<[CtxSpy, any?]> | Exclude<AllTypes, Fn>,
  name?: string,
): Atom => {
  // TODO: it took much longer than expected in profiling
  let theAtom: any = (ctx: Ctx, update: any) =>
    ctx.get(
      (read, actualize) =>
        actualize!(ctx, theAtom.__reatom, (patchCtx: Ctx, patch: AtomCache) => {
          patch.cause = ctx.cause
          patch.state =
            typeof update === 'function'
              ? update(patch.state, patchCtx)
              : update
        }).state,
    )
  let computer = null

  if (typeof initState === 'function') {
    theAtom = {}
    computer = initState
    initState = undefined
  }

  theAtom.__reatom = {
    name,
    isAction: false,
    patch: null,
    initState: () => initState,
    computer,
    connectHooks: null,
    disconnectHooks: null,
    updateHooks: null,
  }

  theAtom.pipe = function (...fns: Array<Fn>) {
    return fns.reduce((acc, fn) => fn(acc), this)
  }

  // @ts-ignore
  return theAtom
}

export const action: {
  <T = void>(name?: string): Action<[T], T>

  <Params extends any[] = any[], Res = void>(
    fn: (ctx: Ctx, ...params: Params) => Res,
    name?: string,
  ): Action<Params, Res>
} = (fn?: string | Fn, name?: string): any => {
  if (fn === undefined || typeof fn === 'string') {
    name = fn
    fn = (ctx: Ctx, v?: any) => v
  }

  assertFunction(fn)

  const actionAtom = atom<Array<any>>([], name)
  actionAtom.__reatom.isAction = true

  return Object.assign((ctx: Ctx, ...params: any) => {
    const state = actionAtom(ctx, (state, patchCtx) => [
      ...state,
      { params, payload: (fn as Fn)(patchCtx, ...params) },
    ])
    // @ts-ignore
    return state[state.length - 1]!.payload
  }, actionAtom)
}

/**
 * @internal
 * @deprecated
 */
export const __root = atom(undefined, 'root').__reatom
