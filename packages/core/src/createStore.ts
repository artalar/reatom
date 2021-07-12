import {
  AC,
  Action,
  ActionData,
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
  isActionCreator,
  isAtom,
  isFunction,
  noop,
  Rec,
  Store,
  TransactionResult,
  Unsubscribe,
} from './internal'

// TODO: tsdx
// if (process.env.NODE_ENV !== 'production') {
//   let i = 0

//   var incrementGetStateOveruse = () => {
//     if (i++ < 3) return

//   incrementGetStateOveruse = () => {}

//     console.warn(
//       `Full state requests too often, it may slow down the application`,
//       `Use subscription to patch instead or request partial state by \`getState(atom)\``,
//     )
//   }

//   setInterval(() => (i = 0), 3000)
// }

function isTypesChange(
  depsOld: Cache['deps'],
  depsNew: Cache['deps'],
): boolean {
  return (
    depsOld.length != depsNew.length ||
    depsOld.some(
      ({ cache }, i) =>
        cache.types != depsNew[i].cache.types ||
        isTypesChange(cache.deps, depsNew[i].cache.deps),
    )
  )
}

export function createStore(snapshot: Record<string, any> = {}): Store {
  const actionsComputers = new Map<ActionType, Set<Atom>>()
  const actionsListeners = new Map<ActionType, Set<Fn>>()
  const atomsCache = new WeakMap<Atom, Cache>()
  const atomsListeners = new Map<Atom, Set<Fn>>()
  const transactionListeners = new Set<Fn<[TransactionResult]>>()

  function addComputer(atom: Atom, cache: Cache) {
    cache.types.forEach((type) => addToSetsMap(actionsComputers, type, atom))
    cache.deps.forEach((dep) => addComputer(atom, dep.cache))
  }
  function delComputer(atom: Atom, cache: Cache) {
    cache.types.forEach((type) => delFromSetsMap(actionsComputers, type, atom))
    cache.deps.forEach((dep) => delComputer(atom, dep.cache))
  }

  function collect(atom: Atom, result: Rec = {}) {
    const { state, deps } = getCache(atom)!

    result[atom.id] = state
    deps.forEach((dep) => collect(dep.atom, result))

    return result
  }

  function mergePatch(
    atom: Atom,
    patch: Cache,
    changedAtoms: Array<[Atom, Cache]>,
  ) {
    const atomCache = getCache(atom)
    if (atomsListeners.has(atom)) {
      if (atomCache == undefined) {
        addComputer(atom, patch)
      } else if (
        atomCache.types != patch.types ||
        isTypesChange(atomCache.deps, patch.deps)
      ) {
        delComputer(atom, patch)
        addComputer(atom, patch)
      }
    }

    atomsCache.set(atom, patch)

    if (!Object.is(atomCache?.state, patch.state)) {
      changedAtoms.push([atom, patch])
    }
  }

  const dispatch: Store['dispatch'] = (action: Action | Array<Action>) => {
    const actions = Array.isArray(action) ? action : [action]
    invalid(
      actions.length === 0 || actions.every(isAction) === false,
      `dispatch arguments`,
    )

    const patch = new Map<Atom, Cache>()
    const transaction = createTransaction(actions, patch, getCache, snapshot)
    const changedAtoms = new Array<[Atom, Cache]>()
    let error: Error | null = null

    try {
      actions.forEach(({ targets }) =>
        targets?.forEach((atom) => transaction.process(atom)),
      )
      actions.forEach(({ type }) =>
        actionsComputers
          .get(type)
          ?.forEach((atom) => transaction.process(atom)),
      )

      patch.forEach((atomPatch, atom) =>
        mergePatch(atom, atomPatch, changedAtoms),
      )
    } catch (e) {
      error = e instanceof Error ? e : new Error(e)
    }

    const transactionResult: TransactionResult = { actions, error, patch }

    transactionListeners.forEach((cb) => callSafety(cb, transactionResult))

    changedAtoms.forEach((change) =>
      atomsListeners
        .get(change[0])
        ?.forEach((cb) => callSafety(cb, change[1].state)),
    )

    actions.forEach((action) =>
      actionsListeners
        .get(action.type)
        ?.forEach((cb) => callSafety(cb, action)),
    )

    return Promise.allSettled(
      transaction.effects.map((cb) => new Promise((res) => res(cb(store)))),
    )
  }

  function getCache<T>(atom: Atom<T>): Cache<T> | undefined {
    return atomsCache.get(atom)
  }

  function getState<T>(): Record<string, any>
  function getState<T>(atom: Atom<T>): T
  function getState<T>(atom?: Atom<T>) {
    if (atom === undefined) {
      // if (process.env.NODE_ENV !== 'production') {
      //   incrementGetStateOveruse()
      // }

      const result: Rec = {}

      atomsListeners.forEach((_, atom) => collect(atom, result))

      return result
    }

    invalid(!isAtom(atom), `"getState" argument`)

    let atomCache = getCache(atom)

    if (atomCache === undefined) {
      dispatch({
        type: `init "${atom.id}" ~${Math.random().toString(36)}`,
        payload: null,
        targets: [atom],
      })

      atomCache = getCache(atom)!
    }

    return atomCache.state
  }

  function init(...atoms: Array<Atom>) {
    const unsubscribers = atoms.map((atom) => subscribeAtom(atom, noop))
    return () => unsubscribers.forEach((un) => un())
  }

  function subscribeAtom<T>(atom: Atom<T>, cb: Fn<[T]>): Unsubscribe {
    let listeners = atomsListeners.get(atom)
    let shouldInvalidateTypes = false

    if (listeners === undefined) {
      shouldInvalidateTypes = atomsCache.has(atom)
      atomsListeners.set(atom, (listeners = new Set()))
    }

    listeners.add(cb)

    function unsubscribe() {
      listeners!.delete(cb)
      if (listeners!.size === 0) {
        atomsListeners.delete(atom)
        delComputer(atom, atomsCache.get(atom)!)
      }
    }

    try {
      getState(atom)

      if (shouldInvalidateTypes) {
        addComputer(atom, getCache(atom)!)
      }

      return unsubscribe
    } catch (error) {
      unsubscribe()
      throw error
    }
  }

  function subscribeAction<T extends AC>(
    actionCreator: T,
    cb: Fn<[ActionData<AC>]>,
  ): Unsubscribe {
    addToSetsMap(actionsListeners, actionCreator.type, cb)

    return () => delFromSetsMap(actionsListeners, actionCreator.type, cb)
  }

  function subscribeTransaction(cb: Fn<[TransactionResult]>): Unsubscribe {
    transactionListeners.add(cb)

    return () => transactionListeners.delete(cb)
  }

  function subscribe<T>(
    cb: Fn<[transactionResult: TransactionResult]>,
  ): Unsubscribe
  function subscribe<T>(atom: Atom<T>, cb: Fn<[state: T]>): Unsubscribe
  function subscribe<T extends AC>(
    actionCreator: T,
    cb: Fn<[action: ActionData<AC>]>,
  ): Unsubscribe
  function subscribe(
    ...a: [Fn<[TransactionResult]>] | [Atom, Fn] | [AC, Fn]
  ): Unsubscribe {
    return a.length === 1 && isFunction(a[0])
      ? subscribeTransaction(a[0])
      : isAtom(a[0]) && isFunction(a[1])
      ? subscribeAtom(a[0], a[1])
      : isActionCreator(a[0]) && isFunction(a[1])
      ? subscribeAction(a[0], a[1])
      : invalid(true, `subscribe arguments`)
  }

  const store = {
    dispatch,
    getCache,
    getState,
    init,
    subscribe,
    __DO_NOT_USE_IT_OR_YOU_WILL_BE_FIRED: {
      actionsComputers,
      actionsListeners,
      atomsCache,
      atomsListeners,
      transactionListeners,
    },
  }

  return store
}

export const defaultStore = createStore()
