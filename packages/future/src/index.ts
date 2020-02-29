/**
 * TODO:
 * - error handling
 */

export type Fn<I extends unknown[] = unknown[], O = unknown> = (...a: I) => O
export type FnAny = Fn<any, any>
export type FnI<F> = F extends Fn<[infer T], any> ? T : never
export type FnO<F> = F extends Fn<any, infer T> ? T : never
export type Values<T> = T[keyof T]
export type Collection<T = unknown> = Record<keyof any, T>
export type Thened<T> = T extends Promise<infer T> ? T : T

export const noop: FnAny = () => {}

export const { assign } = Object

export function callSafety<Args extends any[]>(fn: Fn<Args>, ...args: Args) {
  try {
    fn(...args)
  } catch (e) {
    console.error(e)
  }
}

/** priority set queue for dynamic topological sorting */
export type Queue<T> = {
  extract: () => T | undefined
  insert: (priority: number, el: T) => void
}
export function Queue<T>(): Queue<T> {
  const parts = new Map<number, T[]>()
  let min = 0
  let max = 0

  return {
    insert(priority: number, el: T) {
      let part = parts.get(priority)
      if (part === undefined) parts.set(priority, (part = []))

      if (part.includes(el) === false) {
        part.push(el)
        min = Math.min(min, priority) // useful only for cycles
        max = Math.max(max, priority)
      }
    },
    extract() {
      let part = parts.get(min)
      while (min !== max && (part === undefined || part.length === 0))
        part = parts.get(++min)

      return part && part.shift()
    },
  }
}

function Invalid<T extends boolean>(
  condition: T,
  msg: string,
  // @ts-ignore
): T extends false ? never : void {
  if (condition === false) throw new Error(`Reatom: invalid ${msg}`)
}

/** Token to stop reactive update propagation.
 * Filtered to undefined
 */
export const STOP = 'REATOM_STOP_TOKEN'
export type STOP = typeof STOP
export type Filtered<T> = Exclude<T, STOP>
export const clearTag = <T>(
  value: T,
): T extends STOP
  ? undefined
  : T extends Promise<infer _T>
  ? _T extends STOP
    ? Promise<undefined>
    : Promise<_T>
  : T =>
  // @ts-ignore
  value === STOP
    ? undefined
    : value instanceof Promise
    ? value.then(clearTag)
    : value

const IS_FUTURE = Symbol('REATOM_IS_FUTURE')
export function isFuture(thing: any): thing is Future<any, any> {
  return typeof thing === 'function' && thing[IS_FUTURE] === true
}

export type Future<I = unknown, O = unknown> = {
  (input: I, runCtx?: RunCtx): O

  readonly [IS_FUTURE]: true
  readonly _name: string
  readonly _key: Key
  readonly _kind: string
  readonly _depth: number
  readonly _deps: Future<any, any>[]
  readonly _init: InitHook<I, O> | undefined
  readonly _ctx: Ctx

  chain<T>(
    mapper: Fn<[ChainI<O>, RunCtx, RefCache], T>,
    options?: FutureOptions<ChainI<O>, T>,
  ): Future<I, ChainO<O, T>>
  reduce<T>(reducer: Fn<[T, ChainI<O>], T>): FutureReducer<T, ChainI<O>>
  bind(ctx: Ctx): Future<I, O>
  subscribe(cb: Fn<[ChainI<O>, RunCtx, RefCache]>, ctx?: Ctx): Fn<[], void>
}
export type Key = string
export type Kind = 'entry' | 'map' | 'combine'
export type InitHook<I, O> = Fn<[Future<I, O>, RefCache, Ctx], Fn | void>
export type ChainI<DepO> = Filtered<Thened<DepO>>
export type ChainO<DepO, O> = DepO extends Promise<infer T>
  ? Promise<T extends STOP ? O | STOP : O>
  : DepO extends STOP
  ? O | STOP
  : O
export type FutureOptions<I, O> = {
  name?: string
  key?: Key
  init?: InitHook<I, O>
  ctx?: Ctx
}
export const REDUCER_PARENT: unique symbol = Symbol('REATOM_REDUCER_PARENT')
export type FutureReducer<State, T> = Fn<[State, T], State> & {
  [REDUCER_PARENT]: Atom<State, any>
}

export type PossibleDeps =
  | Record<string, Future<any, any>>
  | [Future<any, any>]
  | Future<any, any>[]
export type DepsInput<Deps extends PossibleDeps> = {
  [K in keyof Deps]: FnI<Deps[K]>
}
export type DepsOutput<Deps extends PossibleDeps> = {
  [K in keyof Deps]: FnO<Deps[K]>
}
// export type DepsOutput<Deps extends PossibleDeps> = Values<
//   _DepsOutput<Deps>
// > extends Promise<any>
//   ? Promise<{
//     [K in keyof Deps]: Deps[K] extends Promise<infer T> ? T : Deps[K]
//   }>
//   : _DepsOutput<Deps>

export const defaultCtx = Ctx()
export class RunCtx {
  constructor(public ctx = defaultCtx) {}
  /** describe what type of travers is happened
   * - 'false' for calling directly dispatched future
   * - 'true' for traversing over `links`
   */
  reactive = false
  cache: Record<Key, unknown> = {}
  queue = Queue<Future<any, any>>()
}

let _count = 0

export function createFuture(
  options: FutureOptions<unknown, unknown> & {
    executor: Fn<[any, RunCtx, RefCache], any>
    deps: Future<unknown, unknown>[]
  },
): Future<unknown, unknown> {
  const {
    executor: _executor,
    deps: _deps,
    name: _name = 'future',
    key: _key = `${_name} [${++_count}]`,
    init: _init,
    ctx: _defaultCtx = defaultCtx,
  } = options
  const _depth = _deps.reduce((acc, f) => Math.max(acc + 1, f._depth), 0)
  const me = assign(
    {
      [_key](input: any, runCtx?: RunCtx): any {
        if (runCtx === undefined)
          return clearTag(_defaultCtx.dispatch(me, input).cache[_key])

        Invalid(runCtx instanceof RunCtx, 'future runtime context')

        const { cache, queue } = runCtx

        if (_key in cache) return cache[_key]

        const ref = runCtx.ctx.getRef(_key) || new Ref()

        const result = _executor(input, runCtx, ref.cache)
        cache[_key] =
          result instanceof Promise
            ? (result as Promise<any>).then(v =>
                (cache[_key] = v) === STOP
                  ? undefined
                  : (ref.listeners.forEach(cb => callSafety(cb, v, runCtx)), v),
              )
            : result

        if (result !== STOP) ref.links.forEach(f => queue.insert(f._depth, f))

        return result
      },
    }[_key],
    {
      [IS_FUTURE]: true,
      _name,
      _key,
      _kind: 'future',
      _deps,
      _depth,
      _init,
      _ctx: _defaultCtx,
      chain(mapper: FnAny): Future<any, any> {
        return futureMap(me, mapper)
      },
      bind(ctx: Ctx): Future<any, any> {
        return createFuture({ ...options, key: _key, ctx })
      },
      subscribe(
        cb: Fn<[any, RunCtx, RefCache]>,
        ctx = _defaultCtx,
      ): Fn<[], void> {
        return ctx.subscribe(cb, me)
      },
      reduce(reducer: FnAny) {
        return assign((...a: any[]) => reducer(...a), {
          [REDUCER_PARENT]: me,
        }) as FutureReducer<any, any>
      },
    } as const,
  )

  return me
}

export function futureOf<I, O = I>(
  executor: Fn<[I, RunCtx, RefCache], O>,
  options: FutureOptions<I, O> = {},
): Future<I, O> {
  return createFuture({
    name: 'futureOf',
    ...options,
    deps: [],
    executor,
  } as any) as Future<I, O>
}

export function futureMap<T, Dep extends Future<any, any>>(
  dep: Dep,
  executor: Fn<[ChainI<FnO<Dep>>, RunCtx, RefCache], T>,
  options: FutureOptions<FnI<Dep>, ChainO<Dep, T>> = {},
): Future<FnI<Dep>, ChainO<Dep, T>> {
  return createFuture({
    name: 'futureMap',
    ...options,
    deps: [dep],
    executor: (input: any, runCtx: RunCtx, cache: RefCache) => (
      (input = runCtx.reactive ? runCtx.cache[dep._key] : dep(input, runCtx)),
      input === STOP
        ? STOP
        : input instanceof Promise
        ? input.then(
            v => (
              // `createFuture` clear tag for outer thens
              // so we must to read it from cache
              (v = runCtx.cache[dep._key]),
              v === STOP ? STOP : executor(v, runCtx, cache)
            ),
          )
        : executor(input, runCtx, cache)
    ),
  } as any) as Future<FnI<Dep>, ChainO<Dep, T>>
}

// @ts-ignore
export declare function futureCombine<Deps extends PossibleDeps>(
  deps: Deps,
): Future<DepsInput<Deps>, /* ChainO<FnO<Values<Deps>>, T> */ DepsInput<Deps>>
// @ts-ignore
export declare function futureCombine<T, Deps extends PossibleDeps>(
  deps: Deps,
  executor: Fn<[DepsOutput<Deps>, RunCtx, RefCache], T>,
  options?: FutureOptions<
    DepsInput<Deps>,
    /* ChainO<FnO<Values<Deps>>, T> */ T
  >,
): Future<DepsInput<Deps>, /* ChainO<FnO<Values<Deps>>, T> */ T>
export function futureCombine(
  deps: PossibleDeps,
  executor: Fn<[any, RunCtx, RefCache], unknown> = (v: any) => v,
  options: FutureOptions<unknown, unknown> = {},
): Future<any, any> {
  const depsKeys = Object.keys(deps)
  const depsCount = depsKeys.length
  const isDepsAreArray = Array.isArray(deps)
  return createFuture({
    name: 'futureCombine',
    ...options,
    deps: depsKeys.map(k => (deps as any)[k]),
    executor: (input: any, runCtx: RunCtx) => {
      const { cache, reactive } = runCtx
      const payload: any = isDepsAreArray ? new Array(depsCount) : {}
      let isAsync = false

      for (let i = 0; i < depsCount; i++) {
        const key = depsKeys[i]
        const dep = (deps as any)[key]
        const depValue = (payload[key] = reactive
          ? dep._key in cache
            ? cache[dep._key]
            : STOP
          : dep(input[key], runCtx))

        if (depValue === STOP) return STOP
        isAsync = isAsync || depValue instanceof Promise
      }

      return isAsync
        ? Promise.all(Object.values(payload)).then(() => {
            const payload: any = isDepsAreArray ? new Array(depsCount) : {}
            for (let i = 0; i < depsCount; i++) {
              const key = depsKeys[i]
              const dep = (deps as any)[key]
              const depValue = (payload[key] = cache[dep._key])

              if (depValue === STOP) return STOP
            }
            return executor(payload, runCtx, cache)
          })
        : executor(payload, runCtx, cache)
    },
  } as any)
}

export type Atom<State, Actions> = Future<State, State> & {
  defaultState: State
  actions: {
    [K in keyof Actions]: Actions[K] extends Fn<[State, infer T], State>
      ? Future<T, State>
      : never
  }
  getState(ctx?: Ctx): State
}

export function atomOf<
  State,
  Actions extends Record<string, Fn<[State, any], State>> = {}
>(
  initState: State,
  options: FutureOptions<any, any> & {
    reducers?: [(FutureReducer<State, any>)] | (FutureReducer<State, any>)[]
    actions?: Actions
  } = {},
): Atom<State, Actions> {
  let { name = 'atom', reducers = [], actions = {}, ...restOptions } = options
  const update = futureOf<State>(v => v, { name: `update of ${name}` })
  const _actions = Object.entries(actions as Actions).reduce(
    (acc, [actionName, reducer], i) => {
      acc.names.push(actionName)
      const future = futureOf(v => v, {
        name: `action "${actionName}" of ${name}`,
      })
      acc.futures.push(future)
      acc.reducers.push(future.reduce(reducer))
      acc.futuresMap[actionName] = future

      return acc
    },
    {
      names: [] as string[],
      reducers: [] as FutureReducer<State, any>[],
      futures: [] as Future<any, any>[],
      futuresMap: {} as Record<string, Future<any, any>>,
    },
  )
  reducers = [
    update.reduce((state, payload) => payload as State),
    ...reducers,
    ..._actions.reducers,
  ]
  const deps = reducers.map(r => r[REDUCER_PARENT])

  const atom = assign(
    createFuture({
      name,
      ...restOptions,
      deps,
      executor(input: any, runCtx: RunCtx, myCache: RefCache) {
        if ('state' in myCache === false) myCache.state = initState
        const { cache } = runCtx
        let { [atom._key]: state = myCache.state } = cache

        if (deps.length === 1 || runCtx.reactive === false) {
          state = input
        } else {
          deps.forEach(({ _key }, i) => {
            if (_key in cache) {
              let payload: any = cache[_key]

              if (payload !== STOP) {
                if (payload instanceof Promise) {
                  payload.then(() => {
                    payload = cache[_key]
                    if (payload !== STOP) runCtx.ctx.dispatch(update, payload)
                  })
                } else {
                  const result: any = reducers[i](state as State, cache[_key])
                  state =
                    result === STOP || result === undefined ? state : result
                }
              }
            }
          })
        }

        return Object.is(myCache.state, state) ? STOP : (myCache.state = state)
      },
    } as any),
    {
      _kind: 'atom',
      defaultState: initState,
      actions: _actions.futuresMap,
      // FIXME: atom._ctx
      getState(ctx = defaultCtx) {
        const {
          cache: { state = initState },
        } = ctx.getRef(atom._key) || new Ref()
        return state
      },
    },
  )

  return atom as any
}

export type RefCache = Collection<unknown>
export class Ref {
  cache: RefCache = {}
  cleanup?: Fn | void
  links: Future<any, any>[] = []
  listeners: FnAny[] = []
  get isEmpty() {
    return this.links.length === 0 && this.listeners.length === 0
  }
}

export type Ctx = ReturnType<typeof Ctx>
export function Ctx() {
  const _lifeCycleQueue: Fn[] = []
  const _links = new Map<Key, Ref>()
  const _listeners: FnAny[] = []

  function _link(target: Future<any, any>, dependent?: Future<any, any>) {
    let targetRef = getRef(target._key)

    if (targetRef === undefined) {
      _links.set(target._key, (targetRef = new Ref()))
      // init life cycle method must be called starts from parent to child
      target._deps.forEach(dep => _link(dep, target))
      if (target._init !== undefined) {
        _lifeCycleQueue.push(
          () =>
            (targetRef!.cleanup = target._init!(target, targetRef!.cache, ctx)),
        )
      }
    }

    if (dependent !== undefined) targetRef.links.push(dependent)

    return targetRef
  }

  function _unlink(target: Future<any, any>, dependent?: Future<any, any>) {
    const targetRef = getRef(target._key)

    if (targetRef !== undefined) {
      if (dependent !== undefined) {
        targetRef.links.splice(targetRef.links.indexOf(dependent), 1)
      }

      if (targetRef.isEmpty) {
        _links.delete(target._key)
        // cleanup life cycle method must be called starts from child to parent
        if (targetRef.cleanup) {
          _lifeCycleQueue.push(targetRef.cleanup)
        }
        target._deps.forEach(dep => _unlink(dep, target))
      }
    }
  }

  function _lifeCycle() {
    while (_lifeCycleQueue.length !== 0)
      // it will be good to catch an errors and do rollback of the linking
      // but it not required for all users and implementation code is not tree-shackable
      // so it good for implementing in some extra package by Ctx extending
      callSafety(_lifeCycleQueue.shift()!)
  }

  function subscribe<T>(cb: Fn<any>, target?: Future<any, T>): () => void {
    Invalid(typeof cb === 'function', 'callback (must be Function)')

    let isSubscribed = true

    if (target === undefined) {
      _listeners.push(cb)

      return function unsubscribe() {
        if (isSubscribed) {
          isSubscribed = false
          _listeners.splice(_listeners.indexOf(cb), 1)
        }
      }
    }

    Invalid(isFuture(target), 'target (must be Future)')

    const { listeners } = _link(target)
    listeners.push(cb)
    _lifeCycle()

    const unsubscribe = () => {
      if (isSubscribed) {
        isSubscribed = false
        listeners.splice(listeners.indexOf(cb), 1)
        _unlink(target)
        _lifeCycle()
      }
    }
    return unsubscribe
  }

  function getRef(targetKey: Key): Ref | undefined {
    return _links.get(targetKey)
  }

  function dispatch<I, O>(
    fn: Fn<[I, RunCtx], O>,
    input?: I,
    runCtx = new RunCtx(ctx),
  ): RunCtx {
    Invalid(runCtx.ctx === ctx, 'context')

    const { cache, queue } = runCtx
    fn(input!, runCtx)
    runCtx.reactive = true

    let next = queue.extract()
    while (next !== undefined) {
      next(undefined, runCtx)
      next = queue.extract()
    }

    for (const k in cache) {
      const ref = getRef(k)
      const payload = cache[k]
      if (
        ref !== undefined &&
        payload !== STOP &&
        payload instanceof Promise === false
      )
        ref.listeners.forEach(cb => callSafety(cb, payload, runCtx))
    }

    _listeners.forEach(cb => cb(runCtx.cache))

    return runCtx
  }

  const ctx = {
    subscribe,
    dispatch,
    getRef,
    get links() {
      return _links
    },
  }

  return ctx
}
