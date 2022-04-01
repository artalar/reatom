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

const memoInitCache: any = Symbol()

export function callSafety<I extends any[], O, This = unknown>(
  this: This,
  fn: (this: This, ...a: I) => O,
  ...args: I
): O | Error {
  try {
    return fn.apply(this, args)
  } catch (err: any) {
    // TODO: error cause
    err = err instanceof Error ? err : new Error(err)
    setTimeout(() => {
      throw err
    })
    return err
  }
}

type QueueNode<T> = null | [T, QueueNode<T>]
class Queue<T = any> {
  async: boolean
  handler: Fn<[T]>
  head: QueueNode<T>
  tail: QueueNode<T>

  constructor(handler: Queue<T>[`handler`], async: Queue<T>['async'] = false) {
    this.async = async
    this.handler = handler
    this.head = null
    this.tail = null
  }

  add(value: T) {
    this.tail =
      this.head === null
        ? (this.head = [value, null])
        : (this.tail![1] = [value, null])
  }

  next(): { done: true } | { done: false; value: T } {
    const next = this.head

    if (next === null) return { done: true }

    this.head = next[1]
    return { done: false, value: next[0] }
  }

  [Symbol.iterator]() {
    return this
  }
}

const walk = (queues: Array<Queue>) => {
  for (let i = 0; i < queues.length; i++) {
    const queue = queues[i]

    if (queue.head !== null) {
      i = 0
      // @ts-expect-error
      if (queue.async) queue.handler(queue.next().value)
      else for (const value of queue) queue.handler(value)
    }
  }
}

// --- SOURCES

const ACTUALIZE = Symbol('REATOM_ACTUALIZE')

/** Context */
export interface Ctx {
  get<T>(atom: Atom<T>): T
  log(cb: Fn<[Patches, null | Error]>): Unsubscribe
  read<T>(atom: Atom<T>): undefined | AtomCache<T>
  run<T>(cb: Fn<[], T>): T
  schedule<T>(fn?: Fn<[], T>): Promise<T>
  subscribe<T>(atom: Atom<T>, cb: Fn<[T, AtomCache<T>]>): Unsubscribe
  top: null | AtomCache
  [ACTUALIZE]<T>(meta: AtomMeta<T>, mutator?: Fn<[AtomCache<T>]>): AtomCache<T>
}

export interface Patches extends Map<AtomMeta, AtomCache> {}

export interface CtxSpy extends Ctx {
  spy<T>(atom: Atom<T>): T
}

export interface Atom<State = any> {
  __reatom: AtomMeta<State>
}

export interface AtomMeta<State = any> {
  readonly name: string
  readonly isAction: boolean
  readonly isInspectable: boolean
  readonly initState: State
  readonly onCleanup: Array<Fn<[Ctx, AtomCache]>>
  readonly onInit: Array<Fn<[Ctx, AtomCache]>>
  readonly onUpdate: Array<Fn<[Ctx, AtomCache]>>
  readonly computer: null | Fn<[CtxSpy, AtomCache]>
  // toJSON
  // fromJSON
}

// The order of properties is sorted by debugging purposes
// (the most interesting properties are at the top)
export interface AtomCache<State = any> {
  state: State
  cause: string
  error: null | Error
  readonly meta: AtomMeta
  // TODO: move to some computation
  wasStale: boolean
  parents: Array<AtomCache>
  readonly children: Set<AtomMeta>
  readonly listeners: Set<Fn>
  actual: boolean
}

export interface Action<Params extends any[] = any[], Res = any>
  extends Atom<Array<Res>> {
  (ctx: Ctx, ...params: Params): Res
}

export type AtomState<T> = T extends Atom<infer State> ? State : never

export interface Unsubscribe {
  (): void
}

export const isAtom = (thing: any): thing is Atom => {
  return Boolean(thing?.__reatom)
}

const isStale = (cache: AtomCache): boolean => {
  // TODO `cache.meta.computer !== null` ?
  return cache.children.size + cache.listeners.size === 0
}

const IS = {
  atom: isAtom,
  boolean: (thing: any): thing is boolean => typeof thing === 'boolean',
  function: (thing: any): thing is Fn => typeof thing === 'function',
  string: (thing: any): thing is string => typeof thing === 'string',
}

const asserts = (thing: any, type: keyof typeof IS) => {
  if (!IS[type](thing)) {
    throw new Error(`Invalid "${typeof thing}", ${type} expected`)
  }
}

export const createCache: Fn<[AtomMeta], AtomCache> = (
  meta: AtomMeta,
): AtomCache => {
  return {
    state: meta.initState,
    cause: 'init',
    error: null,
    meta,
    wasStale: true,
    parents: [],
    children: new Set(),
    listeners: new Set(),
    actual: true,
  }
}

const hasHooks = ({ onInit, onCleanup }: AtomMeta): boolean => {
  return onInit.length > 0 || onCleanup.length > 0
}

const getCause = (cache: AtomCache): string => {
  return `${cache.meta.name} <- ${cache.cause}`
}

export const createContext = (): Ctx => {
  const caches = new WeakMap<AtomMeta, AtomCache>()
  const logs = new Set<Parameters<Ctx[`log`]>[0]>()
  let patches: null | Patches = null
  let error: null | Error = null
  let errorHooks: Array<Fn> = []

  const computersEnqueue = (cache: AtomCache) => {
    for (const childMeta of cache.children) {
      const childCache = patches!.get(childMeta) ?? caches.get(childMeta)!

      if (childCache.actual) {
        patches!.set(childMeta, {
          ...childCache,
          actual: false,
          cause: getCause(cache),
        })

        if (childCache.listeners.size > 0) Q.computers.add(childMeta)
        else computersEnqueue(childCache)
      }
    }
  }

  const actualizeParents = (patch: AtomCache) => {
    let isParentsChanged = false

    if (
      patch.parents.length === 0 ||
      patch.parents.some(
        (parentCache) =>
          !Object.is(
            parentCache.state,
            (parentCache = actualize(parentCache.meta)).state,
          ) && Boolean((patch.cause = getCause(parentCache))),
      )
    ) {
      const { parents } = patch
      let i = 0
      patch.parents = []

      patch.meta.computer!(
        Object.assign({}, ctx, {
          spy: (atom: Atom) => {
            const depPatch = actualize(atom.__reatom)
            patch.parents.push(depPatch)

            isParentsChanged ||=
              patch.parents.length > parents.length ||
              depPatch.meta !== parents[i++].meta

            return depPatch.state
          },
          top: patch,
        }),
        patch,
      )
    }

    return isParentsChanged
  }

  // TODO: accept patches
  const actualize: Ctx[typeof ACTUALIZE] = (meta, mutator) => {
    const cache = patches!.get(meta) ?? caches.get(meta) ?? createCache(meta)
    const wasStale = isStale(cache)
    let patch = cache

    if (cache.error !== null) throw cache.error

    if (cache.actual) {
      if (mutator === undefined && !wasStale) return cache

      patches!.set(meta, (patch = Object.assign({}, cache)))
      patch.actual = false
    }

    const { state } = patch
    let isParentsChanged = false
    patch.wasStale = wasStale

    try {
      mutator?.(patch)
      if (meta.computer !== null) isParentsChanged = actualizeParents(patch)
    } catch (err) {
      patch.error = err instanceof Error ? err : new Error(String(err))
      patch.actual = true

      if (patch.listeners.size > 0) error = patch.error

      throw patch.error
    }

    // if (patch.state === STOP) {
    //   const prevCache = caches.get(meta) ?? createCache(meta)
    //   patches!.set(meta, prevCache)
    //   return prevCache
    // }

    if (!Object.is(state, patch.state)) {
      computersEnqueue(patch)

      for (const hook of meta.onUpdate) hook(ctx, patch)
    }

    if (isParentsChanged) {
      Q.unlinks.add(patch)
      Q.links.add(patch)
    }

    Q.updates.add(patch)

    patch.actual = true

    return patch
  }

  const unlinksHandler = (patch: AtomCache) => {
    const cache = caches.get(patch.meta)

    if (cache !== undefined) {
      for (const parentCache of cache.parents) {
        parentCache.children.delete(cache.meta)

        if (isStale(parentCache)) unlinksHandler(parentCache)
      }
    }

    if (hasHooks(patch.meta)) Q.hooks.add([patch, false])
  }

  const linksHandler = (patch: AtomCache) => {
    patch = patches!.get(patch.meta)!

    for (const parentPatch of patch.parents) {
      if (isStale(parentPatch)) linksHandler(parentPatch)
      parentPatch.children.add(patch.meta)
    }

    if (hasHooks(patch.meta)) Q.hooks.add([patch, patch.wasStale])
  }

  const hooksHandler = ([patch, wasStale]: [AtomCache, boolean]) => {
    if (wasStale !== isStale(patch)) {
      const hooks = wasStale ? patch.meta.onInit : patch.meta.onCleanup
      for (const hook of hooks) {
        Q.effects.add(() => hook(ctx, patch))
      }
    }
  }

  const updatesHandler = (patch: AtomCache) => {
    error = patches = null

    if (patch.error === null) {
      caches.set(patch.meta, patch)

      if (patch.meta.isAction) {
        const payloads = [...patch.state]
        patch.state.length = 0
        for (const l of patch.listeners) {
          Q.effects.add(() => l(payloads))
        }
      } else {
        for (const l of patch.listeners) {
          Q.effects.add(() => {
            const lastCache = caches.get(patch.meta)!
            l(lastCache.state, lastCache)
          })
        }
      }
    }
  }

  const Q = {
    computers: new Queue(actualize),
    unlinks: new Queue(unlinksHandler),
    links: new Queue(linksHandler),
    hooks: new Queue(hooksHandler),
    updates: new Queue(updatesHandler),
    effects: new Queue(callSafety, true),
  }
  const queues = Object.values(Q)

  const ctx: Ctx = {
    get(atom) {
      asserts(atom, 'atom')

      return ctx.run(() => actualize(atom.__reatom).state)
    },
    log(cb) {
      asserts(cb, 'function')

      logs.add(cb)
      return () => logs.delete(cb)
    },
    read(atom) {
      asserts(atom, 'atom')

      return caches.get(atom.__reatom)
    },
    run(cb) {
      if (patches !== null) return cb()
      patches = new Map()

      try {
        var result = cb()
        walk(queues)
      } finally {
        if (patches !== null) {
          for (const log of logs) log(patches, error)
        }
        patches = error = null
      }

      return result
    },
    schedule(effect) {
      asserts(effect ?? noop, 'function')

      return new Promise<any>((res, rej) => {
        errorHooks.push(() => (effect = rej as any))
        Q.effects.add(() => new Promise((r) => r(effect?.())).then(res, rej))
      })
    },
    subscribe(atom, cb) {
      asserts(atom, 'atom')
      asserts(cb, 'function')

      const { __reatom: meta } = atom
      let lastState = memoInitCache
      const fn: typeof cb = (state, cache) =>
        Object.is(lastState, state) || cb((lastState = state), cache)

      let cache = caches.get(meta)

      if (cache === undefined || isStale(cache)) {
        try {
          ctx.run(() => actualize(meta, (patch) => patch.listeners.add(fn)))
        } catch (err) {
          cache?.listeners.delete(fn)
          throw err
        }
      } else {
        cache.listeners.add(fn)
      }

      let subscribed = true
      return () => {
        if (subscribed) {
          subscribed = false

          const { children, listeners } = caches.get(meta)!

          if (listeners.size + children.size > 1) listeners.delete(fn)
          else ctx.run(() => actualize(meta, () => listeners.delete(fn)))
        }
      }
    },
    top: null,
    [ACTUALIZE](meta, mutator) {
      return ctx.run(() => actualize(meta, mutator))
    },
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
  Omit<Partial<AtomMeta>, 'initState' | 'computer'>
>

let atomsCount = 0
// @ts-ignore
export const atom: {
  <State, Actions extends Rec<Fn<[State, ...any[]], State>>>(
    initState: Fn<[CtxSpy], State> | State,
    options: AtomOptions & { reducers: Actions },
  ): Atom<State> & ActionsReducers<State, Actions>
  <State>(
    initState: Fn<[CtxSpy], State>,
    options?: string | AtomOptions,
  ): Atom<State> & ActionsReducers<State, {}>
  <State>(initState: State, options?: string | AtomOptions): Atom<State> &
    ActionsReducers<
      State,
      { change: Fn<[State, State | Fn<[State], State>], State> }
    >
} = (
  initState: Fn<[CtxSpy, any?]> | Exclude<AllTypes, Fn>,
  options: string | (AtomOptions & { reducers?: Rec<Fn> }) = {},
): Atom & ActionsReducers => {
  let computer: AtomMeta['computer'] = null

  if (IS.function(initState)) {
    const userComputer = initState
    computer = (ctx, patch) => (patch.state = userComputer(ctx, patch.state))
    initState = undefined
  }

  let {
    // @ts-ignore
    name = `atom${++atomsCount}`,
    isAction = false,
    isInspectable = !!name,
    onCleanup = [],
    onInit = [],
    onUpdate = [],
    reducers = IS.function(initState)
      ? {}
      : {
          change: (state: any, update: any) =>
            IS.function(update) ? update(state) : update,
        },
  } = IS.string(options) ? { name: options } : options

  asserts(name, 'string')
  asserts(isAction, 'boolean')
  asserts(isInspectable, 'boolean')
  onCleanup.forEach((cb) => asserts(cb, 'function'))
  onInit.forEach((cb) => asserts(cb, 'function'))
  onUpdate.forEach((cb) => asserts(cb, 'function'))

  const meta: AtomMeta = {
    name,
    isAction,
    isInspectable,
    initState,
    onCleanup,
    onInit,
    onUpdate,
    computer,
  }

  const atom: Rec = { ...reducers, __reatom: meta }

  for (const name in reducers) {
    const act = (atom[name] = action((ctx, param) => {
      return ctx[ACTUALIZE](meta, (patch) => {
        patch.cause = getCause(ctx.top!)
        if (
          !Object.is(
            patch.state,
            (patch.state = reducers[name](patch.state, param)),
          )
        )
          patch.cause = act.__reatom.name
      }).state
    }, `${name}__${meta.name}`))
  }

  // @ts-ignore
  return atom
}

export const action: {
  <Params extends any[] = any[], Res = void>(
    fn: (ctx: Ctx, ...params: Params) => Res,
    name?: string,
  ): Action<Params, Res>
} = (fn: Fn, name = `action${++atomsCount}`): Action<any, any> => {
  asserts(fn, 'function')

  const action = Object.assign(
    (ctx: Ctx, ...params: any[]) =>
      ctx.run(() => {
        const patch = ctx[ACTUALIZE](action.__reatom, (patch) => {
          patch.cause = ctx.top === null ? `external call` : getCause(ctx.top)
          patch.state = patch.state.concat([
            fn({ ...ctx, top: patch }, ...params),
          ])
        })

        return patch.state[patch.state.length - 1]
      }),
    atom([] as any[], { reducers: {}, name, isAction: true }),
  ) as Action

  return action
}
