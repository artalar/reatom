import {
  Action,
  addToSetsMap,
  Atom,
  AtomsCache,
  callSafety as callSafetyDefault,
  createReatomError,
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

  if (cache == undefined) return false

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

export function createStore({
  callSafety = callSafetyDefault,
  onError = noop,
  onPatch = noop,
  now = Date.now.bind(Date),
}: {
  callSafety?: typeof callSafetyDefault
  onError?: Fn<
    [
      error: unknown,
      transactionData: TransactionResult & { start: number; end: number },
    ]
  >
  onPatch?: Fn<
    [transactionResult: TransactionResult & { start: number; end: number }]
  >
  /** Current time getter. Tip: use `performance.now` to accurate tracking */
  now?: typeof Date.now
  // TODO:
  // createTransaction
} = {}): Store {
  const atomsByAction = new Map<Action['type'], Set<Atom>>()
  const cache: AtomsCache = new WeakMap()

  const dispatch: Store['dispatch'] = (action, causes) => {
    const start = now()

    const actions = Array.isArray(action) ? action : [action]

    if (actions.length == 0 || !actions.every(isAction)) {
      throw createReatomError(`dispatch arguments`)
    }

    const patch: Patch = new Map()
    const effects: Array<Effect> = []
    const transaction = createTransaction(actions, {
      patch,
      getCache,
      effects,
      causes,
    })
    const getTransactionResult = () => ({ actions, patch, start, end: now() })

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

  const getCache: Store['getCache'] = (atom) => cache.get(atom)

  const subscribe: Store['subscribe'] = (atom, cb) => {
    if (!isAtom(atom) || !isFunction(cb)) {
      throw createReatomError(`subscribe argument`)
    }

    if (!isCacheFresh(atom, store.getCache)) {
      store.dispatch({
        type: `invalidate ${atom.id} [~${Math.random()}]`,
        payload: null,
        targets: [atom],
      })
    }

    const cache = getCache(atom)!

    // @ts-expect-error
    const listeners: Set<AtomListener> = (cache.listeners ??= new Set())

    if (listeners.size == 0) {
      atom.types.forEach((type) => addToSetsMap(atomsByAction, type, atom))
    }

    listeners.add(cb)

    callSafety(cb, cache.state, [])

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
    subscribe,
  }

  return store
}

export const defaultStore = createStore()
