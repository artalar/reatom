import { INTERNAL, STOP } from './constants'
import { RunCache } from './RunCache'
import { RunCtx } from './RunCtx'
import { getIsFunction } from './shared'
import { ChainI, ChainO, Fn, GetCache, Key } from './types'

export type FilterStopUndef<T> = T extends Promise<infer _T>
  ? Promise<FilterStopUndef<_T>>
  : T extends STOP
  ? undefined
  : T

export type Subscribe = <T>(cb: Fn<any>, target?: Future<any, T>) => () => void

export type Dispatch = <I, O>(fn: Future<I, O>, input: I) => RunCtx<Ctx, Future>

export type GetRef = (targetKey: Key) => Ref | undefined

export type Ctx = {
  subscribe: Subscribe
  dispatch: Dispatch
  getRef: GetRef
  links: Map<Key, Ref>
}

export class Ref {
  cleanup?: Fn | void

  // `box` need to prevent `this` lacking
  box: { cache?: unknown } = {}

  links: Future<any, any>[] = []

  listeners: Fn<[any], void>[] = []

  getCache: GetCache = <T>(defaultValue: T): T =>
    ('cache' in this.box
      ? this.box.cache
      : (this.box.cache = defaultValue)) as T

  get isEmpty() {
    return this.links.length === 0 && this.listeners.length === 0
  }
}

export type FutureOptions<I, O> = {
  executor: (input: I, getCache: GetCache) => O | RunCache<O>

  name?: string
  key?: Key
  init?: InitHook<I, O>

  ctx?: Ctx
}

export type InitHook<I, O> = (
  self: Future<I, O>,

  getCache: GetCache,

  context: Ctx,
) => Fn | void

/**
 * Future is a wrapper of an function for subscribing to it calls
 */
export type Future<I = unknown, O = unknown> = {
  (input: I, runCtx?: RunCtx<Ctx, Future>): FilterStopUndef<O>

  /**
   * @deprecated DO NOT USE IT IN PRODUCT CODE - only for third-party libraries or debugging
   */
  [INTERNAL]: {
    /**
     * user-space name
     */
    readonly _name: string

    /**
     * unique key for store and process instance data in Ctx / RunCtx
     */
    readonly _key: Key

    /**
     * Depth of dependencies stack
     */
    readonly _depth: number

    /**
     * Dependencies list
     */
    readonly _deps: Future<any, any>[]

    /**
     * Init hook
     */
    readonly _init?: InitHook<I, O> | undefined

    /**
     * Handler for delivery input to dependencies
     */
    readonly _lift: (input: unknown, runCtx: RunCtx<Ctx, Future>) => void

    /**
     * User-space code
     */
    readonly _executor: (runCtx: RunCtx<Ctx, Future>) => void

    /**
     * User-space code
     */
    readonly _ctx: (runCtx: RunCtx<Ctx, Future>) => void
  }

  // TODO:
  // pipe<T1>(o1: Operator<O, T1>): Future<I, T1>
  // pipe<T1, T2>(o1: Operator<O, T1>, o2: Operator<T1, T2>): Future<I, T2>
  // pipe<T1, T2, T3>...

  /**
   * Create dependent future
   */
  chain<T>(
    mapper: (input: ChainI<O>, getCache: GetCache) => T,
  ): Future<I, ChainO<O, T>>

  /**
   * Create dependent atom
   */
  chain<T>(options: AtomOptions<ChainI<O>, T>): Atom<I, ChainO<O, T>>

  /**
   * Create dependent future
   */
  chain<T>(options: FutureOptions<ChainI<O>, T>): Future<I, ChainO<O, T>>

  /**
   * Clone future with given context as a default
   */
  bind(ctx: Ctx): Future<I, O>

  /**
   * Subscribe to result of future calls
   */
  subscribe(cb: Fn<[ChainI<O>]>, ctx?: Ctx): Fn<[], void>

  // TODO: `chainCatch`
}

export type AtomOptions<I, O> = Omit<FutureOptions<I, O>, 'executor'> & {
  defaultState: O

  executor: (input: I, state: O) => O
}

/**
 * Atom is a wrapper of an function for subscribing to it result invalidate (immutable)
 *
 * @description
 * The difference between `cache` and `state` is that
 * a cache is a data instance of an expected type
 * and a state is a semantic variation of it cache
 * (cache may just exist, state is must be relevant to application time slice)
 */
export type Atom<I, O> = Omit<Future<I, O>, 'bind' | 'subscribe'> & {
  defaultState: ChainI<O>

  /**
   * Create dependent atom
   */
  chainAtom<T>(mapper: (input: ChainI<O>, state: T) => T): Atom<I, ChainO<O, T>>

  /**
   * Create dependent atom
   */
  chainAtom<T>(options: AtomOptions<ChainI<O>, T>): Atom<I, ChainO<O, T>>

  /**
   * Clone atom with given context as a default
   */
  bind(ctx: Ctx): Atom<I, O>

  /**
   * Subscribe to invalidating of atom cache
   */
  subscribe(cb: Fn<[ChainI<O>]>, ctx?: Ctx): Fn<[], void>
}

export function getInternal<F extends Future<any, any>>(f: F): F[INTERNAL] {
  return f[INTERNAL]
}

export function getIsFuture(thing: any): thing is Future<any, any> {
  return getIsFunction(thing) && INTERNAL in thing
}

export function getIsAtomOptions(
  options: FutureOptions<any, any> | AtomOptions<any, any>,
): options is AtomOptions<unknown, unknown> {
  return 'defaultState' in options
}
