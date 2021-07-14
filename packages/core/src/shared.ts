import {
  Action,
  ActionCreator,
  Atom,
  AtomsCache,
  Fn,
  Patch,
  Rec,
  Transaction,
} from './internal'

export const noop: Fn = () => {}

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

export function isString(thing: any): thing is string {
  return typeof thing === 'string'
}

export function isObject(thing: any): thing is Record<keyof any, any> {
  return typeof thing === 'object' && thing !== null
}

export function isFunction(thing: any): thing is Function {
  return typeof thing === 'function'
}

export function isAtom(thing: any): thing is Atom<unknown> {
  return isFunction(thing) && `id` in thing
}

export function isActionCreator(thing: any): thing is ActionCreator {
  return isFunction(thing) && `type` in thing
}

export function isAction(thing: any): thing is Action {
  return isObject(thing) && isString(thing.type) && 'payload' in thing
}

export function invalid(predicate: any, msg: string) {
  if (predicate) throw new Error(`Reatom: invalid ${msg}`)
}

export function createTransaction(
  actions: Array<Action>,
  patch: Patch = new Map(),
  getCache: AtomsCache['get'] = () => undefined,
  snapshot: Rec = {},
): Transaction {
  const transaction: Transaction = {
    actions,
    effects: [],
    process(atom, cache) {
      let atomPatch = patch.get(atom)

      if (!atomPatch) {
        const atomCache = getCache(atom) ??
          cache ?? {
            ctx: undefined,
            deps: [],
            state: snapshot[atom.id],
            types: [],
          }

        atomPatch = atom(transaction, atomCache)

        patch.set(atom, atomPatch)
      }

      return atomPatch
    },
  }

  return transaction
}
