import {
  Action,
  ActionCreator,
  ActionCreatorBindings,
  Atom,
  AtomBindings,
  AtomsCache,
  AtomState,
  CacheTemplate,
  defaultStore,
  Fn,
  Patch,
  Rec,
  Stack,
  Store,
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

export function addToSetsMap<K, V>(map: Map<K, Set<V>>, key: K, value: V) {
  let set = map.get(key)

  if (set === undefined) map.set(key, (set = new Set()))

  set.add(value)
}
export function delFromSetsMap<K, V>(map: Map<K, Set<V>>, key: K, value: V) {
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

export function isAtom<State>(thing: any): thing is Atom<State> {
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

export function createTemplateCache<State>(
  atom: Atom<State>,
  state?: State,
): CacheTemplate<State> {
  return {
    atom,
    ctx: {},
    deps: [],
    state,
    types: [],
  }
}

export function createTransaction(
  actions: Array<Action>,
  {
    patch = new Map(),
    getCache = () => undefined,
    effects = [],
    snapshot = {},
    stack = [],
  }: {
    patch?: Patch
    getCache?: AtomsCache['get']
    effects?: Array<Fn<[store: Store]>>
    snapshot?: Rec
    stack?: Stack
  } = {},
): Transaction {
  stack = stack.concat([['DISPATCH'], actions.map((action) => action.type)])

  const transaction: Transaction = {
    actions,
    stack,
    process(atom, cache) {
      let atomPatch = patch.get(atom)

      if (!atomPatch) {
        const atomCache =
          getCache(atom) ??
          cache ??
          createTemplateCache(atom, snapshot[atom.id])

        stack.push([atom.id])
        atomPatch = atom(transaction, atomCache)
        stack.pop()

        patch.set(atom, atomPatch)
      }

      return atomPatch
    },
    schedule(cb: Fn<[store: Store]>) {
      const _stack = stack.slice(0)
      effects.push((store) => {
        const dispatch: Store['dispatch'] = (actions, s?) =>
          store.dispatch(
            actions,
            s ? _stack.concat([[JSON.stringify(s)]]) : _stack,
          )

        return cb(Object.assign({}, store, { dispatch }))
      })
    },
  }

  return transaction
}
