import {
  Action,
  ActionCreator,
  Atom,
  Collection,
  F,
  Patch,
  StoreCache,
  Transaction,
} from './internal'

export const noop: F = () => {}

export function callSafety<I extends any[], O, This = any>(
  this: This,
  fn: (this: This, ...a: I) => O,
  ...args: I
): O | Error {
  try {
    return fn.apply(this, args)
  } catch (error) {
    error = error instanceof Error ? error : new Error(error)
    setTimeout(() => {
      throw error
    })
    return error
  }
}

export function addToSetsMap<T>(
  map: Map<string, Set<T>>,
  key: string,
  value: T,
) {
  let set = map.get(key)
  if (set === undefined) map.set(key, (set = new Set()))
  set.add(value)
}
export function delFromSetsMap<T>(
  map: Map<string, Set<T>>,
  key: string,
  value: T,
) {
  const set = map.get(key)

  if (set !== undefined) {
    set.delete(value)
    if (set.size === 0) map.delete(key)
  }
}

export function isFunction(thing: any): thing is Function {
  return typeof thing === 'function'
}

export function safeFunction(thing: any): F {
  invalid(!isFunction(thing), `thing, expected function`)
  return thing
}

export function isAtom(thing: any): thing is Atom<unknown> {
  return isFunction(thing) && isFunction(thing.computer)
}

export function safeAtom(thing: any): Atom {
  invalid(!isAtom(thing), `thing, expected atom`)
  return thing
}

export function isActionCreator(thing: any): thing is ActionCreator {
  return isFunction(thing) && typeof thing.type === 'string'
}

export function safeActionCreator(thing: any): ActionCreator {
  invalid(!isActionCreator(thing), `thing, expected action`)
  return thing
}

export function isAction(thing: any): thing is Action<unknown> {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    typeof thing.type === 'string' &&
    'payload' in thing
  )
}

export function invalid<T extends true>(predicate: T, msg: string): never
export function invalid(predicate: any, msg: string): any
export function invalid(predicate: any, msg: string) {
  if (predicate) throw new Error(`Reatom: invalid ${msg}`)
}

export function createTransaction(
  actions: Array<Action>,
  cache: StoreCache = new WeakMap(),
  patch: Patch = new Map(),
  snapshot: Collection = {},
): Transaction {
  return {
    actions,
    getCache: cache.get.bind(cache),
    patch,
    snapshot,
    effects: [],
  }
}
