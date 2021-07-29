import {
  Action,
  ActionType,
  addToSetsMap,
  Atom,
  AtomListener,
  Cache,
  callSafety,
  createTransaction,
  delFromSetsMap,
  Effect,
  Fn,
  invalid,
  isAction,
  isAtom,
  isFunction,
  noop,
  Rec,
  Store,
  TransactionResult,
  Unsubscribe,
} from './internal'

type DepsDiff = [depsOld: Cache['deps'], depsNew: Cache['deps']]

function isTypesChange(...diff: DepsDiff): boolean {
  const stack: Array<DepsDiff> = []

  for (; diff != undefined; diff = stack.pop()!) {
    const { 0: depsOld, 1: depsNew } = diff

    if (depsOld.length != depsNew.length) return true

    for (let i = 0; i < depsOld.length; i++) {
      if (depsOld[i].types != depsNew[i].types) return true

      stack.push([depsOld[i].deps, depsNew[i].deps])
    }
  }
  return false
}

export function createStore({
  snapshot = {},
}: { snapshot?: Record<string, any> } = {}): Store {
  const actionsAtoms = new Map<ActionType, Set<Atom>>()
  const atomsCache = new WeakMap<Atom, Cache>()
  const transactionListeners = new Set<Fn<[TransactionResult]>>()

  function addReducer(atom: Atom, cache: Cache) {
    cache.types.forEach((type) => addToSetsMap(actionsAtoms, type, atom))
    cache.deps.forEach((dep) => addReducer(atom, dep))
  }
  function delReducer(atom: Atom, cache: Cache) {
    cache.types.forEach((type) => delFromSetsMap(actionsAtoms, type, atom))
    cache.deps.forEach((dep) => delReducer(atom, dep))
  }

  function collectSnapshot(atom: Atom, result: Rec = {}) {
    const cache = getCache(atom)!

    result[atom.id] = cache.state
    cache.deps.forEach((dep) => collectSnapshot(dep.atom, result))

    return result
  }

  function mergePatch(patch: Cache, atom: Atom) {
    const { listeners } = patch
    if (listeners.size > 0) {
      const atomCache = getCache(atom)!

      if (
        atomCache.types != patch.types ||
        isTypesChange(atomCache.deps, patch.deps)
      ) {
        delReducer(atom, atomCache)
        addReducer(atom, patch)
      }
    }

    atomsCache.set(atom, patch)
  }

  const dispatch: Store['dispatch'] = (
    action: Action | Array<Action>,
    stack,
  ) => {
    const actions = Array.isArray(action) ? action : [action]

    invalid(
      actions.length == 0 || !actions.every(isAction),
      `dispatch arguments`,
    )

    const patch = new Map<Atom, Cache>()
    const effects: Array<Effect> = []
    const transaction = createTransaction(actions, {
      patch,
      getCache,
      effects,
      snapshot,
      stack,
    })
    const { process } = transaction
    let error: Error | null = null

    try {
      actions.forEach(({ type, targets }) => {
        actionsAtoms.get(type)?.forEach((atom) => process(atom))
        targets?.forEach((atom) => process(atom))
      })
      transaction.stack.pop()

      patch.forEach(mergePatch)
    } catch (e) {
      error = e instanceof Error ? e : new Error(e)
    }

    const transactionResult: TransactionResult = {
      actions,
      error,
      patch,
      stack: transaction.stack,
    }

    transactionListeners.forEach((cb) => callSafety(cb, transactionResult))

    if (error) throw error

    const effectsResults = effects.map((cb) =>
      callSafety(cb, dispatch, transactionResult),
    )

    return Promise.allSettled(effectsResults).then(noop, noop)
  }

  function getCache<T>(atom: Atom<T>): Cache<T> | undefined {
    return atomsCache.get(atom)
  }

  function getState<T>(): Record<string, any>
  function getState<T>(atom: Atom<T>): T
  function getState<T>(atom?: Atom<T>) {
    if (atom == undefined) {
      const result: Rec = {}

      actionsAtoms.forEach((atoms) =>
        atoms.forEach((atom) => collectSnapshot(atom, result)),
      )

      return result
    }

    invalid(!isAtom(atom), `getState argument`)

    const atomCache = getCache(atom)

    if (atomCache == undefined || atomCache.listeners.size == 0) {
      dispatch({
        type: `invalidate ${atom.id} [~${Math.random()}]`,
        payload: null,
        targets: [atom],
      })
    }

    return getCache(atom)!.state
  }

  function subscribe<State>(
    atom: Fn<[transactionResult: TransactionResult]> | Atom<State>,
    cb?: AtomListener<State>,
  ): Unsubscribe {
    if (isAtom<State>(atom) && isFunction(cb)) {
      const stateOld = getState(atom)

      const atomCache = getCache(atom)!
      const { listeners, state } = atomCache

      listeners.add(cb)

      if (listeners.size == 1) {
        addReducer(atom, atomCache)
        cb(state)
      } else if (Object.is(state, stateOld)) {
        cb(state)
      }

      return function unsubscribe() {
        listeners.delete(cb!)
        if (listeners.size == 0) {
          delReducer(atom as Atom, getCache(atom as Atom)!)
        }
      }
    }

    invalid(!isFunction(atom), `subscribe arguments`) as never

    transactionListeners.add(atom as Fn)

    return () => transactionListeners.delete(atom as Fn)
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
