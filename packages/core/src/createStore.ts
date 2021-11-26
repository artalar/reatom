import {
  Action,
  addToSetsMap,
  Atom,
  AtomsCache,
  callSafety as originalCallSafety,
  Causes,
  createReatomError,
  createTemplateCache as originalCreateTemplateCache,
  createTransaction,
  delFromSetsMap,
  Effect,
  Fn,
  isAction,
  isAtom,
  isFunction,
  noop,
  Patch,
  Rec,
  Store,
  TransactionResult,
} from './internal'

function isCacheFresh(atom: Atom, getCache: Store['getCache']): boolean {
  const cache = getCache(atom)

  if (cache.tracks === undefined) return false

  // @ts-expect-error
  if (cache.listeners?.size > 0) return true

  const stack = [cache.tracks]
  while (stack.length > 0) {
    const deps = stack.pop()!
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i]
      if (dep != getCache(dep.atom)) return false
      stack.push(dep.tracks)
    }
  }

  return true
}

export type StoreOnPatch = Fn<
  [
    transactionResult: TransactionResult & {
      causes: Causes
      start: number
      end: number
    },
  ]
>

export type StoreOnError = Fn<
  [
    error: unknown,
    transactionData: TransactionResult & {
      causes: Causes
      start: number
      end: number
    },
  ]
>

export function createStore({
  callSafety = originalCallSafety,
  createTemplateCache = originalCreateTemplateCache,
  onError = noop,
  onPatch = noop,
  now = Date.now.bind(Date),
}: {
  callSafety?: typeof originalCallSafety
  createTemplateCache?: typeof originalCreateTemplateCache
  onError?: StoreOnError
  onPatch?: StoreOnPatch
  /** Current time getter. Tip: use `performance.now` to accurate tracking */
  now?: typeof Date.now
  // TODO:
  // createTransaction
} = {}): Store {
  const atomsByAction = new Map<Action['type'], Set<Atom>>()
  const cache: AtomsCache = new WeakMap()

  function invalidateAtomCache(atom: Atom) {
    if (isAtom(atom)) {
      if (!isCacheFresh(atom, store.getCache)) {
        store.dispatch({
          type: `invalidate ${atom.id} [~${Math.random()}]`,
          payload: null,
          targets: [atom],
        })
      }
    } else {
      throw createReatomError(`passed thing is not an atom`)
    }
  }

  const dispatch: Store['dispatch'] = (action, causes) => {
    const start = now()

    const actions = Array.isArray(action) ? action : [action]

    if (actions.length == 0 || !actions.every(isAction)) {
      throw createReatomError(`dispatch arguments`)
    }

    const patch: Patch = new Map()
    const effects: Array<Effect> = []
    const transaction = createTransaction(actions, {
      causes,
      effects,
      getCache,
      patch,
    })
    const getTransactionResult = () => ({
      actions,
      patch,
      causes: causes ?? [],
      start,
      end: now(),
    })

    try {
      actions.forEach(({ type, targets }) => {
        targets?.forEach((atom) => transaction.process(atom))
        atomsByAction.get(type)?.forEach((atom) => transaction.process(atom))
      })

      patch.forEach((atomPatch, atom) => cache.set(atom, atomPatch))
    } catch (error) {
      onError(error, getTransactionResult())
      throw error
    }

    onPatch(getTransactionResult())

    effects.forEach((cb) => callSafety(cb, dispatch))
  }

  const getCache: Store['getCache'] = (atom, fallback) =>
    cache.get(atom) ?? fallback ?? createTemplateCache(atom)

  const getState: Store['getState'] = (atom) => {
    invalidateAtomCache(atom)

    return getCache(atom).state!
  }

  const subscribe: Store['subscribe'] = (atom, cb) => {
    if (!isFunction(cb)) {
      throw createReatomError(`subscribe callback is not a function`)
    }

    invalidateAtomCache(atom)

    const cache = getCache(atom)

    // @ts-expect-error
    const listeners: Set<AtomListener> = (cache.listeners ??= new Set())

    if (listeners.size == 0) {
      atom.types.forEach((type) => addToSetsMap(atomsByAction, type, atom))
    }

    listeners.add(cb)

    callSafety(cb, cache.state!, [])

    return () => {
      listeners.delete(cb)
      if (listeners.size == 0) {
        atom.types.forEach((type) => delFromSetsMap(atomsByAction, type, atom))
      }
    }
  }

  const store = {
    dispatch,
    getCache,
    getState,
    subscribe,
  }

  return store
}

export const defaultStore = createStore()
