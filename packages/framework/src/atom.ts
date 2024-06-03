//#region TYPE UTILS

/** A shorthand to `Record<string, Values>`, useful as `{}` type means any reference and primitive type */
export interface Rec<Values = any> extends Record<string, Values> {}

/** A shorthand to any function `(...a: any[]): any` */
// TODO remove the generic to force using normal function syntax, as this syntax requires to specify params names.
export interface Fn<Args extends any[] = any[], Return = any> {
  (...a: Args): Return
}

export type Shallow<T> = {
  [K in keyof T]: T[K]
} & {}

export interface Compose<This> {
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

export interface Mix<This> {
  /* prettier-ignore */ <T>(extension: T): This & Shallow<T>
  /* prettier-ignore */ <T1>(operator1: (target: This) => T1): This & Shallow<T1>
  /* prettier-ignore */ <T1, T2>(operator1: (target: This) => T1, operator2: (target: This & T1) => T2): This & Shallow<T1 & T2>
  /* prettier-ignore */ <T1, T2, T3>(operator1: (target: This) => T1, operator2: (target: This & T1) => T2, operator3: (target: This & T1 & T2) => T3): This & Shallow<T1 & T2 & T3>
  /* prettier-ignore */ <T1, T2, T3, T4>(operator1: (target: This) => T1, operator2: (target: This & T1) => T2, operator3: (target: This & T1 & T2) => T3, operator4: (target: This & T1 & T2 & T3) => T4): This & Shallow<T1 & T2 & T3 & T4>
  /* prettier-ignore */ <T1, T2, T3, T4, T5>(operator1: (target: This) => T1, operator2: (target: This & T1) => T2, operator3: (target: This & T1 & T2) => T3, operator4: (target: This & T1 & T2 & T3) => T4, operator5: (target: This & T1 & T2 & T3 & T4) => T5): This & Shallow<T1 & T2 & T3 & T4 & T5>
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6>(operator1: (target: This) => T1, operator2: (target: This & T1) => T2, operator3: (target: This & T1 & T2) => T3, operator4: (target: This & T1 & T2 & T3) => T4, operator5: (target: This & T1 & T2 & T3 & T4) => T5, operator6: (target: This & T1 & T2 & T3 & T4 & T5) => T6): This & Shallow<T1 & T2 & T3 & T4 & T5 & T6>
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7>(operator1: (target: This) => T1, operator2: (target: This & T1) => T2, operator3: (target: This & T1 & T2) => T3, operator4: (target: This & T1 & T2 & T3) => T4, operator5: (target: This & T1 & T2 & T3 & T4) => T5, operator6: (target: This & T1 & T2 & T3 & T4 & T5) => T6, operator7: (target: This & T1 & T2 & T3 & T4 & T5 & T6) => T7): This & Shallow<T1 & T2 & T3 & T4 & T5 & T6 & T7>
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7, T8>(operator1: (target: This) => T1, operator2: (target: This & T1) => T2, operator3: (target: This & T1 & T2) => T3, operator4: (target: This & T1 & T2 & T3) => T4, operator5: (target: This & T1 & T2 & T3 & T4) => T5, operator6: (target: This & T1 & T2 & T3 & T4 & T5) => T6, operator7: (target: This & T1 & T2 & T3 & T4 & T5 & T6) => T7, operator8: (target: This & T1 & T2 & T3 & T4 & T5 & T6 & T7) => T8): This & Shallow<T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8>
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7, T8, T9>(operator1: (target: This) => T1, operator2: (target: This & T1) => T2, operator3: (target: This & T1 & T2) => T3, operator4: (target: This & T1 & T2 & T3) => T4, operator5: (target: This & T1 & T2 & T3 & T4) => T5, operator6: (target: This & T1 & T2 & T3 & T4 & T5) => T6, operator7: (target: This & T1 & T2 & T3 & T4 & T5 & T6) => T7, operator8: (target: This & T1 & T2 & T3 & T4 & T5 & T6 & T7) => T8, operator9: (target: This & T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8) => T9): This & Shallow<T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9>
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(operator1: (target: This) => T1, operator2: (target: This & T1) => T2, operator3: (target: This & T1 & T2) => T3, operator4: (target: This & T1 & T2 & T3) => T4, operator5: (target: This & T1 & T2 & T3 & T4) => T5, operator6: (target: This & T1 & T2 & T3 & T4 & T5) => T6, operator7: (target: This & T1 & T2 & T3 & T4 & T5 & T6) => T7, operator8: (target: This & T1 & T2 & T3 & T4 & T5 & T6 & T7) => T8, operator9: (target: This & T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8) => T9, operator10: (target: This & T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9) => T10): This & Shallow<T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9 & T10>
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

export type AtomMaybe<T = unknown> = Atom<T> | T

/** Main context of data storing and effects processing */
export interface Ctx {
  /** Read the atom value.
   * @deprecated just call the atom as a function with one argument - `ctx`, or use separate `read` method.
   */
  get<T>(atom: Atom<T>): T
  /** Batch updates in one transaction.
   * @deprecated a batching is automatic now */
  get<T>(cb: Fn<[], T>): T
  /** Read the atom value and subscribe to it changes.
   * @deprecated just call the atom as a function with one argument - `ctx`, or use separate `track` method.
   */
  spy?: {
    <T>(anAtom: Atom<T>): T
    <Params extends any[] = any[], Payload = any>(
      anAction: Action<Params, Payload>,
      cb: Fn<[call: { params: Params; payload: Payload }]>,
    ): void
    <T>(atom: Atom<T>, cb: Fn<[newState: T, prevState: undefined | T]>): void
  }

  /** Schedule an effect to one of the sequent queues.
   * @deprecated replace the schedule call without `step` parameter with `wrap` or use separate `schedule` method.
   */
  schedule<T = void>(
    cb: Fn<[Ctx], T>,
    step?: -1 | 0 | 1 | 2,
  ): Promise<Awaited<T>>

  /** Subscribe to atom changes and make it "connected".
   * @deprecated use separate `effect` method.
   */
  subscribe<T>(atom: Atom<T>, cb: Fn<[T]>): Unsubscribe
  /** Subscribe to all atoms and actions changes, useful for logging.
   * @deprecated an alternative is not implemented.
   */
  // TODO an alternative?
  subscribe(cb: Fn<[patches: Logs, error?: Error]>): Unsubscribe

  cause: AtomFrame
}

/** Computed atom context.
 * @deprecated just call the atom as a function with one argument - `ctx`, or use separate `track` method.
 */
export interface CtxSpy extends Required<Ctx> {}

export interface Logs extends Array<AtomFrame> {}

/** Base atom interface, any atoms and actions extends from this interface. */
export interface Atom<State = any, Update = State> {
  (ctx: Ctx): State

  mix: Mix<this>

  /** Cold(!) subscription to the atom changes.
   * @deprecated use hot `reaction` method for describing business flows and separate `onChange` method for utility features.
   */
  onChange: (cb: (ctx: Ctx, newState: State) => any) => Unsubscribe

  /** @deprecated use `mix` instead */
  pipe: Compose<this>

  /** @internal The list of applied mixins. */
  __reatomMixins: Array<Fn>
}

export type AtomUpdate<State, Update> = Update | Fn<[State, Ctx], Update>

export interface AtomMut<State = any, Update = State> extends Atom<State> {
  (ctx: Ctx, update: AtomUpdate<State, Update>): State
}

export interface AtomFrame<State = any, Update = State> {
  error: null | NonNullable<unknown>
  state: State
  atom: Atom<State, Update>
  // nullable state mean cache is dirty (has updated pubs, which could produce new state)
  cause: null | AtomFrame
  pubs: Array<AtomFrame>
  subs: Array<Atom>
}

export interface Action<Params extends any[] = any[], Payload = any>
  extends Atom<Array<{ params: Params; payload: Payload }>> {
  (ctx: Ctx, ...params: Params): Payload

  onCall: (
    cb: (ctx: Ctx, payload: Payload, params: Params) => any,
  ) => Unsubscribe
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

export interface Unsubscribe {
  (): void
}

//#endregion

//#region DOMAIN UTILS

// We don't have type literal for NaN but other values are presented here
// https://stackoverflow.com/a/51390763
type Falsy = false | 0 | '' | null | undefined
// Can't be an arrow function due to
//    https://github.com/microsoft/TypeScript/issues/34523
/** Throws `Reatom error: ${message}` */
export function throwReatomError(
  condition: any,
  message: string,
): asserts condition is Falsy {
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

const isConnected = (cache: AtomFrame): boolean => {
  return cache.subs.size + cache.listeners.size > 0
}

function assertFunction(thing: any): asserts thing is Fn {
  throwReatomError(
    typeof thing !== 'function',
    `invalid "${typeof thing}", function expected`,
  )
}

//#endregion

export interface CtxOptions {
  /** Use it to delay or track late effects such as subscriptions notification */
  callLateEffect?: typeof callSafely
  /** Use it to delay or track near effects such as API calls */
  callNearEffect?: typeof callSafely
}

const getRootCause = (cause: AtomFrame): AtomFrame =>
  cause.cause === null ? cause : getRootCause(cause.cause)

let CTX: undefined | Ctx

export const createCtx = ({
  callLateEffect = callSafely,
  callNearEffect = callSafely,
}: CtxOptions = {}): Ctx => {
  let caches = new WeakMap<AtomProto, AtomFrame>()
  let read = (proto: AtomProto): undefined | AtomFrame => caches.get(proto)
  let logsListeners = new Set<Fn<[Logs, Error?]>>()

  let nearEffects: Array<Fn<[Ctx]>> = []
  let lateEffects: Array<Fn<[Ctx]>> = []

  // 'tr' is short for 'transaction'
  let inTr = false
  let trError: null | Error = null
  let trUpdates: Array<Fn<[Ctx]>> = []
  let trRollbacks: Array<Fn> = []
  let trLogs: Array<AtomFrame> = []
  let trNearEffectsStart: typeof nearEffects.length = 0
  let trLateEffectsStart: typeof lateEffects.length = 0
  let effectsProcessing = false

  let walkNearEffects = () => {
    for (let effect of nearEffects) callNearEffect(effect, ctx)

    nearEffects = []
  }
  let walkLateEffects = () => {
    if (effectsProcessing) return
    effectsProcessing = true

    walkNearEffects()
    for (let effect of lateEffects) {
      callLateEffect(effect, ctx)
      if (nearEffects.length > 0) walkNearEffects()
    }

    lateEffects = []

    effectsProcessing = false
  }

  let addPatch = (
    { state, proto, pubs, subs, listeners }: AtomFrame,
    cause: AtomFrame,
  ) => {
    proto.actual = false
    trLogs.push(
      (proto.patch = {
        state: state,
        proto: proto,
        cause,
        pubs: pubs,
        subs: subs,
        listeners: listeners,
      }),
    )
    return proto.patch
  }

  let enqueueComputers = (cache: AtomFrame) => {
    for (let subProto of cache.subs) {
      let subCache = subProto.patch ?? read(subProto)!

      if (!subProto.patch || subProto.actual) {
        if (addPatch(subCache, cache).listeners.size === 0) {
          enqueueComputers(subCache)
        }
      }
    }
  }

  let disconnect = (proto: AtomProto, pubPatch: AtomFrame): void => {
    if (pubPatch.subs.delete(proto)) {
      trRollbacks.push(() => pubPatch.subs.add(proto))

      if (!isConnected(pubPatch)) {
        if (pubPatch.proto.disconnectHooks !== null) {
          nearEffects.push(...pubPatch.proto.disconnectHooks)
        }

        for (let parentParent of pubPatch.pubs) {
          disconnect(pubPatch.proto, parentParent)
        }
      }
    }
  }

  let connect = (proto: AtomProto, pubPatch: AtomFrame) => {
    if (!pubPatch.subs.has(proto)) {
      let wasConnected = isConnected(pubPatch)
      pubPatch.subs.add(proto)
      trRollbacks.push(() => pubPatch.subs.delete(proto))

      if (!wasConnected) {
        if (pubPatch.proto.connectHooks !== null) {
          nearEffects.push(...pubPatch.proto.connectHooks)
        }

        for (let parentParentPatch of pubPatch.pubs) {
          connect(pubPatch.proto, parentParentPatch)
        }
      }
    }
  }

  let actualizePubs = (patchCtx: Ctx, patch: AtomFrame) => {
    let { proto, pubs } = patch
    let isDepsChanged = false

    if (
      pubs.length === 0 ||
      pubs.some(
        ({ proto, state }) =>
          !Object.is(state, (patch.cause = actualize(patchCtx, proto)).state),
      )
    ) {
      let newPubs: typeof pubs = []

      patchCtx.spy = ({ __reatom: depProto }: Atom, cb?: Fn) => {
        // this changed after computer exit
        if (patch.pubs === pubs) {
          let depPatch = actualize(patchCtx, depProto)
          let prevDepPatch =
            newPubs.push(depPatch) <= pubs.length
              ? pubs[newPubs.length - 1]
              : undefined
          let isDepChanged = prevDepPatch?.proto !== depPatch.proto
          isDepsChanged ||= isDepChanged

          let state =
            depProto.isAction && !isDepChanged
              ? depPatch.state.slice(prevDepPatch!.state.length)
              : depPatch.state

          if (cb && (isDepChanged || !Object.is(state, prevDepPatch!.state))) {
            if (depProto.isAction) for (const call of state) cb(call)
            else cb(state, isDepChanged ? undefined : prevDepPatch?.state)
          } else {
            return state
          }
        } else {
          throwReatomError(true, 'async spy')
        }
      }

      patch.state = patch.proto.computer!(patchCtx as CtxSpy, patch.state)
      patch.pubs = newPubs

      if (
        (isDepsChanged || pubs.length > newPubs.length) &&
        isConnected(patch)
      ) {
        for (let { proto: depProto } of pubs) {
          if (newPubs.every((dep) => dep.proto !== depProto)) {
            disconnect(proto, depProto.patch ?? read(depProto)!)
          }
        }
        for (let { proto: depProto } of newPubs) {
          if (pubs.every((dep) => dep.proto !== depProto)) {
            connect(proto, depProto.patch ?? read(depProto)!)
          }
        }
      }
    }
  }

  let actualize = (
    ctx: Ctx,
    proto: AtomProto,
    updater?: Fn<[patchCtx: Ctx, patch: AtomFrame]>,
  ): AtomFrame => {
    let { patch, actual } = proto
    let updating = updater !== undefined

    if (
      !updating &&
      actual &&
      (patch!.pubs.length === 0 || isConnected(patch!))
    )
      return patch!

    let cache = patch ?? read(proto)
    let isInt = !cache
    let cause = updating ? ctx.cause : read(__root)!

    if (isInt) {
      cache = {
        state: proto.initState(ctx),
        proto,
        cause,
        pubs: [],
        subs: new Set(),
        listeners: new Set(),
      }
    } else if (proto.computer === null && !updating) {
      return cache!
    }

    if (!patch || actual) patch = addPatch(cache!, cause)

    let { state } = patch
    let patchCtx: Ctx = {
      get: ctx.get,
      spy: undefined,
      schedule: ctx.schedule,
      subscribe: ctx.subscribe,
      cause: patch,
    }

    try {
      if (proto.computer) actualizePubs(patchCtx, patch)
      if (updating) {
        // updater's cause is a more important, than computer's cause
        patch.cause = ctx.cause
        updater!(patchCtx, patch)
      }
      proto.actual = true
    } catch (error) {
      throw (patch.error = error)
    }

    if (!Object.is(state, patch.state)) {
      if (patch.subs.size > 0 && (updating || patch.listeners.size > 0)) {
        enqueueComputers(patch)
      }

      if (proto.changeHooks) {
        let ctx = {
          get: patchCtx.get,
          spy: undefined,
          schedule: patchCtx.schedule,
          subscribe: patchCtx.subscribe,
          cause: patchCtx.cause,
        }
        proto.changeHooks.forEach((hook) =>
          trUpdates.push(() => hook(ctx, patch!)),
        )
      }
    }

    return patch
  }

  let ctx: Ctx = {
    get(atomOrCb) {
      throwReatomError(
        CTX && getRootCause(CTX.cause) !== read(__root),
        'cause collision',
      )

      if (isAtom(atomOrCb)) {
        let proto = atomOrCb.__reatom
        if (inTr) return actualize(this, proto).state
        let cache = read(proto)

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
      let start = CTX === undefined
      if (start) CTX = this

      try {
        var result = atomOrCb(read, actualize)

        for (let i = 0; i < trLogs.length; i++) {
          let { listeners, proto } = trLogs[i]!
          if (listeners.size > 0) actualize(this, proto)
          if (trUpdates.length > 0 /* TODO `&& trLogs.length === i + 1` */) {
            for (let commit of trUpdates.splice(0)) commit(this)
          }
        }

        if (trLogs.length) for (let log of logsListeners) log(trLogs)

        for (let patch of trLogs) {
          let { proto, state } = patch
          if (proto.isAction) patch.state = []

          if (patch === proto.patch) {
            proto.patch = null
            proto.actual = false

            caches.set(proto, patch)

            if (proto.isAction) {
              if (state.length === 0) continue
              for (let cb of patch.listeners) {
                nearEffects.push(() => cb(state))
              }
            } else {
              for (let cb of patch.listeners) {
                lateEffects.push(() => cb(read(proto)!.state))
              }
            }
          }
        }
      } catch (e: any) {
        trError = e = e instanceof Error ? e : new Error(String(e))
        for (let log of logsListeners) log(trLogs, e)
        for (let cb of trRollbacks) callSafely(cb, e)
        for (let { proto } of trLogs) {
          proto.patch = null
          proto.actual = false
        }

        nearEffects.length = trNearEffectsStart
        lateEffects.length = trLateEffectsStart

        throw e
      } finally {
        inTr = false
        trError = null
        trUpdates = []
        trRollbacks = []
        trLogs = []
        trNearEffectsStart = 0
        trLateEffectsStart = 0
        if (start) CTX = undefined
      }

      walkLateEffects()

      return result
    },
    spy: undefined,
    schedule(cb, step = 1) {
      assertFunction(cb)
      throwReatomError(!this, 'missed context')

      return new Promise<any>((res, rej) => {
        if (step === -1) inTr && trRollbacks.push(cb)
        else if (step === 0) inTr && trUpdates.push(() => cb(this))
        else {
          let target = step === 1 ? nearEffects : lateEffects
          target.push(() => {
            try {
              let result = cb(this)
              result instanceof Promise ? result.then(res, rej) : res(result)
              return result
            } catch (error) {
              rej(error)
              throw error
            }
          })
          inTr || walkLateEffects()
        }
      })
    },
    subscribe(atom: Atom | Fn, cb: Atom | Fn = atom) {
      assertFunction(cb)

      if (atom === cb) {
        logsListeners.add(cb)
        return () => logsListeners.delete(cb)
      }

      let { __reatom: proto } = atom as Atom

      let lastState = impossibleValue
      let listener = (state: any) =>
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
          for (let pubPatch of cache.pubs) connect(proto, pubPatch)
        })
      } else {
        cache.listeners.add(listener)
      }

      if (lastState === impossibleValue) {
        listener((proto.patch ?? read(proto)!).state)
      }

      return () => {
        if (cache!.listeners.delete(listener) && !isConnected(cache!)) {
          proto.disconnectHooks && nearEffects.push(...proto.disconnectHooks)

          for (let pubCache of cache!.pubs) {
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

  ;(ctx.cause = ctx.get(() => actualize(ctx, __root))).cause = null

  return ctx
}

let i = 0
/**
 * @internal
 * @deprecated
 */
export let __count = (name: string) => `${name}#${++i}`

function pipe(this: Atom, ...fns: Array<Fn>) {
  return fns.reduce((acc, fn) => fn(acc), this)
}
function onChange(this: Atom, cb: Fn) {
  const hook = (ctx: Ctx, patch: AtomFrame) => cb(ctx, patch.state)

  ;(this.__reatom.updateHooks ??= new Set()).add(hook)

  return () => this.__reatom.updateHooks!.delete(hook)
}
function onCall(this: Action, cb: Fn): Unsubscribe {
  return this.onChange((ctx, state) => {
    const { params, payload } = state[state.length - 1]!
    cb(ctx, payload, params)
  })
}

export function atom<T>(initState: (ctx: CtxSpy) => T, name?: string): Atom<T>
export function atom<T>(initState: T, name?: string): AtomMut<T>
export function atom<T>(
  initState: T | ((ctx: CtxSpy) => T),
  name = __count('_atom'),
): Atom<T> | AtomMut<T> {
  // TODO: it took much longer than expected in profiling
  let theAtom: any = (ctx: Ctx, update: any) =>
    ctx.get(
      (read, actualize) =>
        actualize!(ctx, theAtom.__reatom, (patchCtx: Ctx, patch: AtomFrame) => {
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
    initState = undefined as T
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
    actual: false,
  }

  theAtom.pipe = pipe
  theAtom.onChange = onChange

  return experimental_PLUGINS.length === 0
    ? theAtom
    : theAtom.pipe(...experimental_PLUGINS)
}

export const action: {
  (name?: string): Action<[], void>

  <T>(name?: string): Action<[T], T>

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

  let actionAtom = atom<Array<any>>([], name ?? __count('_action'))
  actionAtom.__reatom.isAction = true
  // @ts-expect-error
  actionAtom.__reatom.unstable_fn = fn

  return Object.assign(
    (...params: [Ctx, ...any[]]) => {
      let state = actionAtom(params[0], (state, patchCtx) => {
        params[0] = patchCtx
        return [
          ...state,
          {
            params: params.slice(1),
            // @ts-expect-error
            payload: patchCtx.cause.proto.unstable_fn(...params),
          },
        ]
      })
      return state[state.length - 1]!.payload
    },
    actionAtom,
    {
      onCall,
    },
  )
}

export const experimental_PLUGINS: Array<(anAtom: Atom) => Atom> = []

/**
 * @internal
 * @deprecated
 */
export const __root = atom(undefined, 'root').__reatom

export const batch = <T>(ctx: Ctx, cb: Fn<[], T>): T => ctx.get(cb)

const a1 = atom(0).mix(
  (target) => ({ a: 1 }),
  (target) => ({ b: 1 }),
  (target) => ({ c: 1 }),
)
