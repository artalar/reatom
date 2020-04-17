export type Fn<I extends unknown[] = any[], O = any> = (...a: I) => O
export type FnI<F> = F extends Fn<[infer T]> ? T : never
export type FnO<F> = F extends Fn<any[], infer T> ? T : never
export type Values<T> = T[keyof T]
export type Collection<T = any> = Record<keyof any, T>
export type Await<T> = T extends Promise<infer T> ? T : T
// @ts-ignore

const { assign, is } = Object
const { isArray } = Array

const noop: Fn = () => {}
// @ts-ignore

function getIsString(thing: any): thing is string {
  // @ts-ignore
  return typeof thing === 'string'
  // @ts-ignore
}
function getIsFunction(thing: any): thing is Fn {
  // @ts-ignore
  return typeof thing === 'function'
  // @ts-ignore
}
// @ts-ignore

function callSafety<Args extends any[]>(fn: Fn<Args>, ...args: Args) {
  // @ts-ignore
  try {
    // @ts-ignore
    fn(...args)
    // @ts-ignore
  } catch (e) {
    // @ts-ignore
    console.error(e)
    // @ts-ignore
  }
  // @ts-ignore
}
// @ts-ignore

// @ts-ignore
/** tiny priority set queue for dynamic topological sorting */
export type Queue<T> = {
  // @ts-ignore
  extract: () => T | undefined
  insert: (priority: number, el: T) => void
}
export function Queue<T>(): Queue<T> {
  // @ts-ignore
  const parts = new Map<number, T[]>()
  // @ts-ignore
  let min = 0
  let max = 0
  let next

  // @ts-ignore
  return {
    // @ts-ignore
    insert(priority: number, el: T) {
      // @ts-ignore
      let part = parts.get(priority)
      // @ts-ignore
      if (!part) parts.set(priority, (part = []))
      // @ts-ignore

      // @ts-ignore
      if (!part.includes(el)) {
        // @ts-ignore
        part.push(el)
        // @ts-ignore
        min = Math.min(min, priority) // useful only for cycles
        max = Math.max(max, priority)
        // @ts-ignore
      }
      // @ts-ignore
    },
    // @ts-ignore
    extract() {
      // @ts-ignore
      while (true) {
        // @ts-ignore
        next = (parts.get(min) || []).shift()
        // @ts-ignore
        if (next || min++ >= max) return next
      }
      // @ts-ignore
    },
    // @ts-ignore
  }
  // @ts-ignore
}
// @ts-ignore

function invalid<T extends boolean>(
  // @ts-ignore
  condition: T,
  // @ts-ignore
  msg: string,
  // @ts-ignore
  // FIXME: replace to `asserts`
  // @ts-ignore
  // @ts-ignore
): T extends true ? never : void {
  // @ts-ignore
  if (condition) throw new Error(`Reatom: invalid ${msg}`)
  // @ts-ignore
}
// @ts-ignore

// @ts-ignore
/** Token to stop reactive update propagation.
// @ts-ignore
* (filtered to undefined for executors and subscribers)
// @ts-ignore
 */
export const STOP = 'REATOM_STOP_TOKEN' as const
export type STOP = typeof STOP
export type FilterStopNever<T> = T extends Promise<infer _T> // @ts-ignore
  ? Promise<FilterStopNever<_T>> // @ts-ignore
  : T extends STOP
  ? never
  : T
export type FilterStopUndef<T> = T extends Promise<infer _T> // @ts-ignore
  ? Promise<FilterStopUndef<_T>> // @ts-ignore
  : T extends STOP
  ? undefined
  : T
export const filterStopUndef = <T>(value: T): FilterStopUndef<T> =>
  // @ts-ignore
  value instanceof Promise
    ? value.then(filterStopUndef)
    : // @ts-ignore
    (value as any) === STOP
    ? undefined
    : (value as any)
// @ts-ignore

const INTERNAL = Symbol('REATOM_FUTURE_INTERNAL')
export function getInternal<F extends Future<any, any>>(
  // @ts-ignore
  f: F,
  // @ts-ignore
): F[typeof INTERNAL] {
  // @ts-ignore
  return f[INTERNAL]
  // @ts-ignore
}
export function getIsFuture(thing: any): thing is Future<any, any> {
  // @ts-ignore
  return getIsFunction(thing) && INTERNAL in thing
}
// @ts-ignore

// @ts-ignore
/** Future is a wrapper of an function for subscribing to it calls */
export type Future<I = unknown, O = unknown> = {
  // @ts-ignore
  (input: I, runCtx?: RunCtx): FilterStopUndef<O>
  // @ts-ignore

  // @ts-ignore
  /** @deprecated DO NOT USE IT IN PRODUCT CODE - only for third-party libraries or debugging */
  // @ts-ignore
  [INTERNAL]: {
    // @ts-ignore
    /** user-space name */
    // @ts-ignore
    readonly _name: string
    /** unique key for store and process instance data in Ctx / RunCtx */
    // @ts-ignore
    readonly _key: Key
    /** Depth of dependencies stack */
    // @ts-ignore
    readonly _depth: number
    /** Dependencies list */
    // @ts-ignore
    readonly _deps: Future<any, any>[]
    // @ts-ignore
    /** Init hook */
    // @ts-ignore
    readonly _init?: InitHook<I, O> | undefined
    /** Handler for delivery input to dependencies */
    // @ts-ignore
    readonly _lift: (input: unknown, runCtx: RunCtx) => void
    /** User-space code */
    // @ts-ignore
    readonly _executor: (runCtx: RunCtx) => void
    /** User-space code */
    // @ts-ignore
    readonly _ctx: (runCtx: RunCtx) => void
  }
  // @ts-ignore

  // @ts-ignore
  // TODO:
  // @ts-ignore
  // pipe<T1>(o1: Operator<O, T1>): Future<I, T1>
  // @ts-ignore
  // pipe<T1, T2>(o1: Operator<O, T1>, o2: Operator<T1, T2>): Future<I, T2>
  // @ts-ignore
  // pipe<T1, T2, T3>...
  // @ts-ignore

  // @ts-ignore
  /** Create dependent future */
  // @ts-ignore
  chain<T>(
    // @ts-ignore
    mapper: (input: ChainI<O>, getCache: GetCache) => T,
  ): // @ts-ignore
  Future<I, ChainO<O, T>>
  // @ts-ignore
  /** Create dependent atom */
  // @ts-ignore
  chain<T>(options: AtomOptions<ChainI<O>, T>): Atom<I, ChainO<O, T>>
  // @ts-ignore
  /** Create dependent future */
  // @ts-ignore
  chain<T>(options: FutureOptions<ChainI<O>, T>): Future<I, ChainO<O, T>>
  // @ts-ignore
  /** Clone future with given context as a default */
  // @ts-ignore
  bind(ctx: Ctx): Future<I, O>
  // @ts-ignore
  /** Subscribe to result of future calls */
  // @ts-ignore
  subscribe(cb: Fn<[ChainI<O>]>, ctx?: Ctx): Fn<[], void>
  // @ts-ignore

  // @ts-ignore
  // TODO: `chainCatch`
  // @ts-ignore
}
// @ts-ignore

// @ts-ignore
/** Atom is a wrapper of an function for subscribing to it result invalidate (immutable)
// @ts-ignore
*
// @ts-ignore
 * @description
 * The difference between `cache` and `state` is that
 * a cache is a data instance of an expected type
 * and a state is a semantic variation of it cache
 * (cache may just exist, state is must be relevant to application time slice)
// @ts-ignore
 */
export type Atom<I, O> = Omit<Future<I, O>, 'bind' | 'subscribe'> & {
  // @ts-ignore
  defaultState: ChainI<O>
  // @ts-ignore
  /** Create dependent atom */
  // @ts-ignore
  chainAtom<T>(mapper: (input: ChainI<O>, state: T) => T): Atom<I, ChainO<O, T>>
  // @ts-ignore
  /** Create dependent atom */
  // @ts-ignore
  chainAtom<T>(options: AtomOptions<ChainI<O>, T>): Atom<I, ChainO<O, T>>
  // @ts-ignore
  /** Clone atom with given context as a default */
  // @ts-ignore
  bind(ctx: Ctx): Atom<I, O>
  // @ts-ignore
  /** Subscribe to invalidating of atom cache */
  // @ts-ignore
  subscribe(cb: Fn<[ChainI<O>]>, ctx?: Ctx): Fn<[], void>
  // @ts-ignore
}
export type Key = /* unique */ string
export type InitHook<I, O> = (
  // @ts-ignore
  self: Future<I, O>,
  // @ts-ignore
  getCache: GetCache,
  // @ts-ignore
  context: Ctx,
) => // @ts-ignore
Fn | void
export type ChainI<DepO> = Await<FilterStopNever<DepO>>
export type ChainO<DepO, O> = DepO extends Promise<infer T> // @ts-ignore
  ? Promise<O | (T extends STOP ? STOP : never)> // @ts-ignore
  : O | (DepO extends STOP ? STOP : never)
export type FutureOptions<I, O> = {
  // @ts-ignore
  executor: (input: I, getCache: GetCache) => O | RunCache<O>
  // @ts-ignore
  name?: string
  key?: Key
  init?: InitHook<I, O>
  // @ts-ignore
  ctx?: Ctx
}
export type AtomOptions<I, O> = Omit<FutureOptions<I, O>, 'executor'> & {
  // @ts-ignore
  defaultState: O
  executor: (input: I, state: O) => O
}
export type GetCache = <T>(defaultValue: T) => T

export type Rollback = Fn
export class FutureConfig<T> {
  // @ts-ignore
  value!: T
  rollback!: Rollback
  constructor(config: { value: T; rollback: Rollback }) {
    // @ts-ignore
    assign(this, config)
    // @ts-ignore
  }
  // @ts-ignore
}
// @ts-ignore

export function getIsAtomOptions(
  // @ts-ignore
  options: FutureOptions<any, any> | AtomOptions<any, any>,
  // @ts-ignore
): options is AtomOptions<unknown, unknown> {
  // @ts-ignore
  return 'defaultState' in options
}
// @ts-ignore

export const defaultCtx = Ctx()
export class RunCache<T = unknown> {
  // @ts-ignore
  readonly value!: T
  readonly kind!: 'payload' | 'async' | 'stop' | 'error'
  // @ts-ignore
  readonly rollback?: Rollback
  constructor({
    // @ts-ignore
    value,
    // @ts-ignore
    kind = (value as any) === STOP
      ? 'stop'
      : // @ts-ignore
      value instanceof Promise
      ? 'async'
      : // @ts-ignore
        'payload',
    // @ts-ignore
    rollback,
  }: // @ts-ignore
  {
    // @ts-ignore
    value: T
    kind?: 'payload' | 'async' | 'stop' | 'error'
    // @ts-ignore
    rollback?: Rollback
  }) {
    // @ts-ignore
    assign(this, { value, kind, rollback })
    // @ts-ignore
  }
  // @ts-ignore
}
// @ts-ignore

export class RunCtx {
  // @ts-ignore
  constructor(public ctx: Ctx) {}
  // @ts-ignore
  cache = new Map<Key, RunCache>()
  // @ts-ignore
  queue = Queue<Future<unknown, unknown>>()
  // @ts-ignore
}
// @ts-ignore

let _count = 0
export type SomeFutureOptions = {
  // @ts-ignore
  lift: Fn<[unknown, RunCtx]>
  // @ts-ignore
  executor: Fn<[RunCache[], Ref, RunCtx], RunCache | unknown>
  // @ts-ignore
  deps: Future<unknown, unknown>[]
  // @ts-ignore
  name?: string
  key?: Key
  init?: InitHook<unknown, unknown>
  // @ts-ignore
  ctx?: Ctx
}
export function createSomeFuture(
  // @ts-ignore
  options: SomeFutureOptions,
  // @ts-ignore
): Future<unknown, unknown> {
  // @ts-ignore
  const {
    // @ts-ignore
    lift,
    // @ts-ignore
    executor,
    // @ts-ignore
    deps: _deps,
    // @ts-ignore
    name: _name = 'future',
    // @ts-ignore
    key: _key = `[${++_count}] ${_name}`,
    // @ts-ignore
    init: _init,
    // @ts-ignore
    ctx: _ctx = defaultCtx,
    // @ts-ignore
  } = options
  invalid(!getIsFunction(executor), 'executor - must be a function')
  // @ts-ignore
  invalid(!getIsString(_key), 'key - must be a string (or undefined)')
  // @ts-ignore
  invalid(
    // @ts-ignore
    !(_init === undefined || getIsFunction(_init)),
    // @ts-ignore
    'init hook - must be a function (or undefined)',
    // @ts-ignore
  )
  // @ts-ignore
  // FIXME:
  // @ts-ignore
  // invalid(
  // @ts-ignore
  //   !(_ctx === undefined || _ctx instanceof Ctx),
  // @ts-ignore
  //   'context - must be instance of `Ctx` class (or undefined)',
  // @ts-ignore
  // )
  // @ts-ignore

  // @ts-ignore
  const _depth = _deps.reduce(
    // @ts-ignore
    (acc, f, i) => (
      // @ts-ignore
      invalid(
        // @ts-ignore
        !getIsFuture(f),
        // @ts-ignore
        `future dependency #${i + 1} - must be a future too`,
        // @ts-ignore
      ),
      // @ts-ignore
      Math.max(acc + 1, getInternal(f)._depth)
      // @ts-ignore
    ),
    // @ts-ignore
    0,
    // @ts-ignore
  )
  // @ts-ignore

  // @ts-ignore
  function _lift(input: unknown, runCtx: RunCtx) {
    // @ts-ignore
    runCtx.queue.insert(_depth, me)
    // @ts-ignore
    lift(input, runCtx)
    // @ts-ignore
  }
  // @ts-ignore

  // @ts-ignore
  const _executor = {
    // @ts-ignore
    [_key](runCtx: RunCtx) {
      // @ts-ignore
      invalid(runCtx instanceof RunCtx === false, 'runtime context')
      // @ts-ignore

      // @ts-ignore
      const { ctx, cache, queue } = runCtx

      // @ts-ignore
      const ref = ctx.getRef(_key) || new Ref()
      // @ts-ignore

      // @ts-ignore
      let result!: RunCache

      // @ts-ignore
      try {
        // @ts-ignore
        const value = executor(
          // @ts-ignore
          _deps.map(
            // @ts-ignore
            d =>
              // @ts-ignore
              cache.get(getInternal(d)._key) || new RunCache({ value: STOP }),
            // @ts-ignore
          ),
          // @ts-ignore
          ref,
          // @ts-ignore
          runCtx,
          // @ts-ignore
        )
        // @ts-ignore
        result = value instanceof RunCache ? value : new RunCache({ value })
        // @ts-ignore
      } catch (value) {
        // @ts-ignore
        result = new RunCache({ value, kind: 'error' })
        // @ts-ignore
      }
      // @ts-ignore

      // @ts-ignore
      if (result.kind !== 'stop') {
        // @ts-ignore
        ref.links.forEach(l => queue.insert(getInternal(l)._depth, l))
        // @ts-ignore
      }
      // @ts-ignore

      // @ts-ignore
      cache.set(_key, result)
      // @ts-ignore

      // @ts-ignore
      // iterating over queue may be described outer by a loop
      // but for better debugger inspection we increase call stack
      const next = queue.extract()
      // @ts-ignore
      if (next !== undefined) getInternal(next)._executor(runCtx)
      // @ts-ignore
    },
    // @ts-ignore
  }[_key]
  // @ts-ignore

  // @ts-ignore
  const me: Future<any, any> = assign(
    // @ts-ignore
    (input: unknown, runCtx?: RunCtx): unknown => {
      // @ts-ignore
      if (runCtx === undefined) {
        // @ts-ignore
        runCtx = _ctx.dispatch(me, input)
        // @ts-ignore
      } else {
        // @ts-ignore
        _executor(runCtx)
        // @ts-ignore
      }
      // @ts-ignore
      // FIXME: assemble async output
      return filterStopUndef(runCtx.cache.get(_key)!.value)
      // @ts-ignore
    },
    // @ts-ignore
    {
      // @ts-ignore
      [INTERNAL]: {
        // @ts-ignore
        _name,
        // @ts-ignore
        _key,
        // @ts-ignore
        _deps,
        // @ts-ignore
        _depth,
        // @ts-ignore
        _init,
        // @ts-ignore
        _ctx,
        // @ts-ignore
        _lift,
        // @ts-ignore
        _executor,
        // @ts-ignore
      },
      // @ts-ignore

      // @ts-ignore
      chain: ((options: Fn | FutureOptions<any, any>) =>
        // @ts-ignore
        futureChain(me, options)) as (Future<any, any>)['chain'],
      // @ts-ignore

      // @ts-ignore
      bind: (ctx: Ctx) =>
        // @ts-ignore
        createSomeFuture({ ...options, name: _name, key: _key, ctx }),
      // @ts-ignore

      // @ts-ignore
      subscribe: (cb: Fn, ctx = _ctx): Fn<[], void> => ctx.subscribe(cb, me),
      // @ts-ignore

      // @ts-ignore
      toString() {
        // @ts-ignore
        return _key
      },
      // @ts-ignore
    } as const,
    // @ts-ignore
  )
  // @ts-ignore

  // @ts-ignore
  return me
}
// @ts-ignore

export declare function futureFrom<I, O = I>(
  // @ts-ignore
  executor: Fn<[I, GetCache], O | RunCache<O>>,
): // @ts-ignore
Future<I, O>
// @ts-ignore
export declare function futureFrom<I, O = I>(
  // @ts-ignore
  options: AtomOptions<I, O>,
): // @ts-ignore
Atom<I, O>
// @ts-ignore
export declare function futureFrom<I, O = I>(
  // @ts-ignore
  options: FutureOptions<I, O>,
): // @ts-ignore
Future<I, O>
export function futureFrom<I, O = I>(
  // @ts-ignore
  options: Fn<[I, GetCache], O> | AtomOptions<I, O> | FutureOptions<I, O>,
  // @ts-ignore
): Future<I, O> | Atom<I, O> {
  // @ts-ignore
  options = getIsFunction(options) ? { executor: options } : options
  // @ts-ignore
  const { executor, defaultValue } = options
  const isAtom = getIsAtomOptions(options)
  // @ts-ignore
  const f = createSomeFuture({
    // @ts-ignore
    name: 'futureFrom',
    // @ts-ignore
    ...options,
    // @ts-ignore
    deps: [],
    // @ts-ignore
    lift: (value, runCtx) => runCtx.cache.set(_key, new RunCache({ value })),
    // @ts-ignore
    executor: (_, ref, runCtx) => {
      // @ts-ignore
      const getter: any = isAtom ? ref.getCache(defaultValue) : ref.getCache
      let result = executor(runCtx.cache.get(_key)!.value as I, getter)
      // @ts-ignore
      result =
        // @ts-ignore
        result instanceof RunCache ? result : new RunCache({ value: result })
      // @ts-ignore

      // @ts-ignore
      if (isAtom && result.kind === 'payload') {
        // @ts-ignore
        const { rollback } = result
        ref.box.cache = result.value
        result = new RunCache({
          // @ts-ignore
          value: result.value,
          // @ts-ignore
          rollback: () => ((ref.box.cache = getter), rollback && rollback()),
          // @ts-ignore
        })
        // @ts-ignore
      }
      // @ts-ignore

      // @ts-ignore
      return result
    },
    // @ts-ignore
  }) as Future<I, O> | Atom<I, O>
  // @ts-ignore
  const { _key } = getInternal(f)
  // @ts-ignore

  // @ts-ignore
  return f
}
// @ts-ignore

export declare function futureChain<
  T,
  Dep extends Future<any, any> | Atom<any, any>
>(
  // @ts-ignore
  dep: Dep,
  // @ts-ignore
  executor: Fn<[ChainI<FnO<Dep>>, RefCache], T | RunCache<T>>,
): // @ts-ignore
Future<FnI<Dep>, ChainO<Dep, T>>
// @ts-ignore
export declare function futureChain<
  T,
  Dep extends Future<any, any> | Atom<any, any>
>(
  // @ts-ignore
  dep: Dep,
  // @ts-ignore
  options: AtomOptions<ChainI<FnO<Dep>>, T>,
): // @ts-ignore
Atom<FnI<Dep>, ChainO<Dep, T>>
// @ts-ignore
export declare function futureChain<
  T,
  Dep extends Future<any, any> | Atom<any, any>
>(
  // @ts-ignore
  dep: Dep,
  // @ts-ignore
  options: FutureOptions<ChainI<FnO<Dep>>, T>,
): // @ts-ignore
Future<FnI<Dep>, ChainO<Dep, T>>
export function futureChain<T, Dep extends Future<any, any> | Atom<any, any>>(
  // @ts-ignore
  dep: Dep,
  // @ts-ignore
  executor: // @ts-ignore


    | Fn<[ChainI<FnO<Dep>>, RefCache], T | RunCache<T>>
    // @ts-ignore
    | AtomOptions<ChainI<FnO<Dep>>, T>
    // @ts-ignore
    | FutureOptions<ChainI<FnO<Dep>>, T>,
  // @ts-ignore
): Atom<FnI<Dep>, ChainO<Dep, T>> | Future<FnI<Dep>, ChainO<Dep, T>> {
  // @ts-ignore
  const { executor: _executor, defaultValue, ...restOptions } = getIsFunction(
    // @ts-ignore
    executor,
    // @ts-ignore
  )
    ? // @ts-ignore
      { executor }
    : // @ts-ignore
      executor
  // @ts-ignore
  const isAtom = getIsAtomOptions(executor)
  // @ts-ignore

  // @ts-ignore
  invalid(!getIsFunction(_executor), 'executor - must be a function')
  // @ts-ignore

  // @ts-ignore
  const depInternal = getInternal(dep)
  // @ts-ignore

  // @ts-ignore
  const me = createSomeFuture({
    // @ts-ignore
    name: `-> ${depInternal._key}`,
    // @ts-ignore
    ...restOptions,
    // @ts-ignore
    deps: [dep],
    // @ts-ignore
    lift: (input, runCtx) => depInternal._lift(input, runCtx),
    // @ts-ignore
    executor: (inputs, ref, runCtx) => {
      // @ts-ignore
      const input = inputs[0]
      // @ts-ignore
      const getter: any = isAtom ? ref.getCache(defaultValue) : ref.getCache
      // FIXME:
      // @ts-ignore
      // if (input.kind === 'error') _errorExecutor()
      // @ts-ignore
      let result =
        // @ts-ignore
        input.kind === 'stop'
          ? // @ts-ignore
            STOP
          : input.kind === 'async'
          // @ts-ignore
          ? input.value.then(v => _executor(v as ChainI<FnO<Dep>>, getter))
          // @ts-ignore
          : _executor(input.value as ChainI<FnO<Dep>>, getter)
      // @ts-ignore
      result =
        // @ts-ignore
        result instanceof RunCache ? result : new RunCache({ value: result })
      // @ts-ignore

      // @ts-ignore
      if (isAtom && result.kind === 'payload') {
        // @ts-ignore
        const { rollback } = result
        ref.box.cache = result.value
        result = new RunCache({
          // @ts-ignore
          value: result.value,
          // @ts-ignore
          rollback: () => ((ref.box.cache = getter), rollback && rollback()),
          // @ts-ignore
        })
        // @ts-ignore
      }
      // @ts-ignore

      // @ts-ignore
      return result
    },
    // @ts-ignore
  }) as Future<FnI<Dep>, ChainO<Dep, T>>
  // @ts-ignore

  // @ts-ignore
  return me
}
// @ts-ignore

export type CombineDeps =
  // @ts-ignore
  | Record<string, Future<any, any>>
  // @ts-ignore
  | [Future<any, any>]
  // @ts-ignore
  | Future<any, any>[]
export type CombineDepsI<Deps extends CombineDeps> = {
  // @ts-ignore
  [K in keyof Deps]: FnI<Deps[K]> | STOP
}
export type CombineDepsO<Deps extends CombineDeps> = {
  // @ts-ignore
  [K in keyof Deps]: FnO<Deps[K]> | STOP
}
// @ts-ignore

export function futureCombine<Deps extends CombineDeps>(
  // @ts-ignore
  deps: Deps,
  // @ts-ignore
): Future<CombineDepsI<Deps>, CombineDepsO<Deps>> {
  // @ts-ignore
  const depsNames = Object.keys(deps)
  // @ts-ignore
  const depsCount = depsNames.length
  const isDepsAreArray = Array.isArray(deps)
  // @ts-ignore
  return createSomeFuture({
    // @ts-ignore
    name: JSON.stringify(deps),
    // @ts-ignore
    deps: depsNames.map(name => (deps as any)[name]),
    // @ts-ignore
    lift: (input, runCtx) =>
      // @ts-ignore
      depsNames.map(
        name =>
          // @ts-ignore
          getInternal((deps as any)[name])._lift(input[name], runCtx),
        // @ts-ignore
      ),
    // @ts-ignore
    executor: (inputs, ref, runCtx) => {
      // @ts-ignore
      const result = isDepsAreArray ? new Array(depsCount) : {}
      // @ts-ignore

      // @ts-ignore
      let isError = false
      depsNames.forEach((depName, i) => {
        // @ts-ignore
        const depPayload = inputs[i]
        // @ts-ignore
        isError = isError || depPayload.kind === 'error'
        // @ts-ignore
        result[depName] = depPayload.value
      })
      // @ts-ignore

      // @ts-ignore
      return isError
        ? new RunCache({ value: result, kind: 'error' })
        : // @ts-ignore
          new RunCache({ value: result })
      // @ts-ignore
    },
    // @ts-ignore
  }) as any
}
// @ts-ignore

export type RefCache = Collection
export class Ref {
  // @ts-ignore
  cleanup?: Fn | void
  // `box` need to prevent `this` lacking
  box: { cache?: unknown } = {}
  // @ts-ignore
  links: Future<any, any>[] = []
  // @ts-ignore
  listeners: Fn<[any], void>[] = []
  // @ts-ignore
  getCache: GetCache = <T>(defaultValue: T): T =>
    // @ts-ignore
    ('cache' in this.box
      ? this.box.cache
      : (this.box.cache = defaultValue)) as T
  get isEmpty() {
    // @ts-ignore
    return this.links.length === 0 && this.listeners.length === 0
  }
  // @ts-ignore
}
// @ts-ignore

export type Ctx = ReturnType<typeof Ctx>
export function Ctx() {
  // @ts-ignore
  const _lifeCycleQueue: Fn[] = []
  // @ts-ignore
  const _links = new Map<Key, Ref>()
  // @ts-ignore
  const _listeners: Fn[] = []
  // @ts-ignore

  // @ts-ignore
  function _link(target: Future<any, any>, dependent?: Future<any, any>) {
    // @ts-ignore
    const targetInternal = getInternal(target)
    // @ts-ignore
    let targetRef = getRef(targetInternal._key)
    // @ts-ignore

    // @ts-ignore
    if (targetRef === undefined) {
      // @ts-ignore
      _links.set(targetInternal._key, (targetRef = new Ref()))
      // @ts-ignore
      // init life cycle method must be called starts from parent to child
      targetInternal._deps.forEach(dep => _link(dep, target))
      // @ts-ignore
      if (targetInternal._init !== undefined) {
        // @ts-ignore
        _lifeCycleQueue.push(
          // @ts-ignore
          () =>
            // @ts-ignore
            (targetRef!.cleanup = targetInternal._init!(
              // @ts-ignore
              target,
              // @ts-ignore
              targetRef!.getCache,
              // @ts-ignore
              ctx,
              // @ts-ignore
            )),
          // @ts-ignore
        )
        // @ts-ignore
      }
      // @ts-ignore
    }
    // @ts-ignore

    // @ts-ignore
    if (dependent !== undefined) targetRef.links.push(dependent)
    // @ts-ignore

    // @ts-ignore
    return targetRef
  }
  // @ts-ignore

  // @ts-ignore
  function _unlink(target: Future<any, any>, dependent?: Future<any, any>) {
    // @ts-ignore
    const targetInternal = getInternal(target)
    // @ts-ignore
    const targetRef = getRef(targetInternal._key)
    // @ts-ignore

    // @ts-ignore
    if (targetRef !== undefined) {
      // @ts-ignore
      if (dependent !== undefined) {
        // @ts-ignore
        targetRef.links.splice(targetRef.links.indexOf(dependent), 1)
        // @ts-ignore
      }
      // @ts-ignore

      // @ts-ignore
      if (targetRef.isEmpty) {
        // @ts-ignore
        _links.delete(targetInternal._key)
        // @ts-ignore
        // cleanup life cycle method must be called starts from child to parent
        if (targetRef.cleanup) {
          // @ts-ignore
          _lifeCycleQueue.push(targetRef.cleanup)
          // @ts-ignore
        }
        // @ts-ignore
        targetInternal._deps.forEach(dep => _unlink(dep, target))
        // @ts-ignore
      }
      // @ts-ignore
    }
    // @ts-ignore
  }
  // @ts-ignore

  // @ts-ignore
  function _lifeCycle() {
    // @ts-ignore
    while (_lifeCycleQueue.length !== 0)
      // @ts-ignore
      // it will be good to catch an errors and do rollback of the linking
      // but it not required for all users and implementation code is not tree-shackable
      // so it good for implementing in some extra package by Ctx extending
      callSafety(_lifeCycleQueue.shift()!)
    // @ts-ignore
  }
  // @ts-ignore

  // @ts-ignore
  function subscribe<T>(cb: Fn<any>, target?: Future<any, T>): () => void {
    // @ts-ignore
    invalid(typeof cb !== 'function', 'callback (must be a function)')
    // @ts-ignore

    // @ts-ignore
    let isSubscribed = true

    // @ts-ignore
    if (target === undefined) {
      // @ts-ignore
      _listeners.push(cb)
      // @ts-ignore

      // @ts-ignore
      return function unsubscribe() {
        // @ts-ignore
        if (isSubscribed) {
          // @ts-ignore
          isSubscribed = false
          _listeners.splice(_listeners.indexOf(cb), 1)
          // @ts-ignore
        }
        // @ts-ignore
      }
      // @ts-ignore
    }
    // @ts-ignore

    // @ts-ignore
    invalid(!getIsFuture(target), 'target (must be Future)')
    // @ts-ignore

    // @ts-ignore
    const { listeners } = _link(target)
    // @ts-ignore
    listeners.push(cb)
    // @ts-ignore
    _lifeCycle()
    // @ts-ignore

    // @ts-ignore
    return function unsubscribe() {
      // @ts-ignore
      if (isSubscribed) {
        // @ts-ignore
        isSubscribed = false
        listeners.splice(listeners.indexOf(cb), 1)
        // @ts-ignore
        _unlink(target)
        // @ts-ignore
        _lifeCycle()
        // @ts-ignore
      }
      // @ts-ignore
    }
    // @ts-ignore
  }
  // @ts-ignore

  // @ts-ignore
  function getRef(targetKey: Key): Ref | undefined {
    // @ts-ignore
    return _links.get(targetKey)
    // @ts-ignore
  }
  // @ts-ignore

  // @ts-ignore
  function dispatch<I, O>(fn: Future<I, O>, input: I): RunCtx {
    // @ts-ignore
    const runCtx = new RunCtx(ctx)
    // @ts-ignore

    // @ts-ignore
    const { cache, queue } = runCtx
    getInternal(fn)._lift(input, runCtx)
    // @ts-ignore
    fn(input, runCtx)
    // @ts-ignore

    // @ts-ignore
    cache.forEach((runCache, key) => {
      // @ts-ignore
      const ref = _links.get(key)
      // @ts-ignore
      if (ref) {
        // @ts-ignore
        // FIXME:
        // @ts-ignore
        // if (runCache.kind === 'error' && ref.listeners.length !== 0) doRollbackForAllCache()
        // @ts-ignore
        const { value } = runCache
        ref.listeners.forEach(cb => callSafety(cb, value))
        // @ts-ignore
      }
      // @ts-ignore
    })
    // @ts-ignore

    // @ts-ignore
    _listeners.forEach(cb => callSafety(cb, runCtx.cache))
    // @ts-ignore

    // @ts-ignore
    return runCtx
  }
  // @ts-ignore

  // @ts-ignore
  const ctx = {
    // @ts-ignore
    subscribe,
    // @ts-ignore
    dispatch,
    // @ts-ignore
    getRef,
    // @ts-ignore
    links: _links,
    // @ts-ignore
  }
  // @ts-ignore

  // @ts-ignore
  return ctx
}
// @ts-ignore

type User = {
  // @ts-ignore
  name: string
  logo: string
}
// @ts-ignore

const viewLogo = (data: any) => {
  // @ts-ignore
  console.log(data)
  // @ts-ignore
}
// @ts-ignore

const future = futureFrom

// @ts-ignore
// future
const requestUser = future(
  (id: string) =>
    // @ts-ignore
    // fetch(`/api/user/${id}`).then(v => v.json() as Promise<User>),
    // @ts-ignore
    ({
      // @ts-ignore
      name: 'name',
      // @ts-ignore
      logo: 'logo',
      // @ts-ignore
    }),
  // @ts-ignore
)
// @ts-ignore
// atom
const userLogo = requestUser.chain({
  // @ts-ignore
  defaultState: '/assets/placeholderLogo',
  // @ts-ignore
  executor: user => user.logo,
  // @ts-ignore
})
// @ts-ignore

// @ts-ignore
// subscription
userLogo.subscribe(url => viewLogo(url))
// @ts-ignore

// @ts-ignore
// usage
requestUser('42')
// @ts-ignore
