import {
  Action,
  ActionType,
  addToSetsMap,
  Atom,
  Cache,
  callSafety,
  createTransaction,
  delFromSetsMap,
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
  const actionsReducers = new Map<ActionType, Set<Atom>>()
  const atomsCache = new WeakMap<Atom, Cache>()
  const atomsListeners = new Map<Atom, Set<Fn>>()
  const transactionListeners = new Set<Fn<[TransactionResult]>>()

  function addReducer(atom: Atom, cache: Cache) {
    cache.types.forEach((type) => addToSetsMap(actionsReducers, type, atom))
    cache.deps.forEach((dep) => addReducer(atom, dep))
  }
  function delReducer(atom: Atom, cache: Cache) {
    cache.types.forEach((type) => delFromSetsMap(actionsReducers, type, atom))
    cache.deps.forEach((dep) => delReducer(atom, dep))
  }

  function collectSnapshot(atom: Atom, result: Rec = {}) {
    const cache = getCache(atom)!

    result[atom.id] = cache.state
    cache.deps.forEach((dep) => collectSnapshot(dep.atom, result))

    return result
  }

  function mergePatch(atom: Atom, patch: Cache, effect: Array<Fn<[Store]>>) {
    const atomCache = getCache(atom)
    const atomListeners = atomsListeners.get(atom)

    if (atomListeners != undefined) {
      if (atomCache == undefined) {
        addReducer(atom, patch)
      } else if (
        atomCache.types != patch.types ||
        isTypesChange(atomCache.deps, patch.deps)
      ) {
        delReducer(atom, atomCache)
        addReducer(atom, patch)
      }

      if (!Object.is(atomCache?.state, patch.state)) {
        effect.push(() =>
          atomListeners.forEach((cb) => callSafety(cb, patch.state)),
        )
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
    const effects: Array<Fn<[store: Store]>> = []
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
        actionsReducers.get(type)?.forEach((atom) => process(atom))
        targets?.forEach((atom) => process(atom))
      })

      patch.forEach((atomPatch, atom) => mergePatch(atom, atomPatch, effects))
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

    const effectsResults = effects.map((cb) => callSafety(cb, store))

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

      atomsListeners.forEach((_, atom) => collectSnapshot(atom, result))

      return result
    }

    invalid(!isAtom(atom), `'getState' argument`)

    if (getCache(atom) == undefined || !atomsListeners.has(atom)) {
      dispatch({
        type: `invalidate ${atom.id} [~${Math.random().toString(36)}]`,
        payload: null,
        targets: [atom],
      })
    }

    return getCache(atom)!.state
  }

  function subscribe<State>(
    atom: Fn<[transactionResult: TransactionResult]> | Atom<State>,
    cb?: Fn<[state: State]>,
  ): Unsubscribe {
    if (isAtom<State>(atom) && isFunction(cb)) {
      let listeners = atomsListeners.get(atom)

      if (listeners == undefined) {
        atomsListeners.set(atom, (listeners = new Set()))
      }

      listeners.add(cb)

      function unsubscribe() {
        listeners!.delete(cb as Fn)
        if (listeners!.size == 0) {
          atomsListeners.delete(atom as Atom)
          delReducer(atom as Atom, atomsCache.get(atom as Atom)!)
        }
      }

      const atomCache = getCache(atom)

      try {
        const state = getState(atom)

        if (Object.is(atomCache?.state, state)) {
          cb(state)
        }
      } catch (error) {
        unsubscribe()
        throw error
      }

      return unsubscribe
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
