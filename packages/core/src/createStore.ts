import {
  Action,
  ActionCreator,
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
  Store,
  Transaction,
} from './internal'

export function createStore(snapshot: Record<string, any> = {}): Store {
  const atomsCache = new WeakMap<Atom, Cache>()
  const atomsListeners = new Map<Atom, Set<Fn>>()
  const actionsComputers = new Map<ActionType, Set<Atom>>()
  const actionsListeners = new Map<ActionType, Set<Fn>>()
  const transactionListeners = new Set<Fn<[Transaction]>>()

  function mergePatch(patch: Cache, atom: Atom) {
    const atomCache = atomsCache.get(atom)
    if (atomsListeners.has(atom)) {
      if (atomCache === undefined) {
        patch.types.forEach((type) =>
          addToSetsMap(actionsComputers, type, atom),
        )
      } else if (atomCache.types !== patch.types) {
        patch.types.forEach(
          (type) =>
            atomCache.types.has(type) ||
            addToSetsMap(actionsComputers, type, atom),
        )
        atomCache.types.forEach(
          (type) =>
            patch.types.has(type) ||
            delFromSetsMap(actionsComputers, type, atom),
        )
      }
    }

    atomsCache.set(atom, patch)

    return Object.is(atomCache?.state, patch.state)
  }

  const dispatch: Store['dispatch'] = (action: Action | Array<Action>) => {
    // TODO: try + catch
    const actions = Array.isArray(action) ? action : [action]
    invalid(
      actions.length === 0 || actions.every(isAction) === false,
      `dispatch arguments`,
    )

    const patch = new Map<Atom, Cache>()
    const transaction = createTransaction(actions, atomsCache, patch, snapshot)
    const changedAtoms = new Array<[Atom, Cache]>()

    actions.forEach((action) =>
      actionsComputers
        .get(action.type)
        ?.forEach((atom) => transaction.process(atom)),
    )

    patch.forEach(
      (atomPatch, atom) =>
        mergePatch(atomPatch, atom) || changedAtoms.push([atom, atomPatch]),
    )

    transactionListeners.forEach((cb) => callSafety(cb, transaction))

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

    return Promise.all(
      transaction.effects.map((cb) =>
        new Promise((res) => res(cb(store))).finally(() => null),
      ),
    ).then(() => {})
  }

  function getCache<T>(atom: Atom<T>): Cache<T> | undefined {
    return atomsCache.get(atom)
  }

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

  function getState<T>(): Record<string, any>
  function getState<T>(atom: Atom<T>): T
  function getState<T>(atom?: Atom<T>) {
    if (atom === undefined) {
      // if (process.env.NODE_ENV !== 'production') {
      //   incrementGetStateOveruse()
      // }

      const result = {} as Record<string, any>

      function collect(atom: Atom) {
        const { state, deps } = atomsCache.get(atom)!

        result[atom.id] = state
        deps.forEach((dep) => !isActionCreator(dep) && collect(dep.atom))
      }

      atomsListeners.forEach((_, atom) => collect(atom))

      return result
    }

    invalid(!isAtom(atom), `"getState" argument`)

    let atomCache = atomsCache.get(atom)

    if (atomCache === undefined) {
      const patch = new Map<Atom, Cache>()
      atomCache = createTransaction(
        [{ type: `init [${Math.random()}]`, payload: null }],
        atomsCache,
        patch,
        snapshot,
      ).process(atom)

      patch.forEach(mergePatch)
    }

    return atomCache.state
  }

  function init(...atoms: Array<Atom>) {
    const unsubscribers = atoms.map((atom) => subscribeAtom(atom, noop))
    return () => unsubscribers.forEach((un) => un())
  }

  function subscribeAtom<T>(atom: Atom<T>, cb: Fn<[T]>): Fn<[], void> {
    let listeners = atomsListeners.get(atom)

    if (listeners === undefined) {
      atomsListeners.set(atom, (listeners = new Set()))
    }

    listeners.add(cb)

    getState(atom)

    const atomCache = atomsCache.get(atom)!

    function unsubscribe() {
      listeners!.delete(cb)
      if (listeners!.size === 0) {
        atomsListeners.delete(atom)
        atomsCache
          .get(atom)!
          .types.forEach((type) => delFromSetsMap(actionsComputers, type, atom))
      }
    }

    try {
      cb(atomCache.state)
      return unsubscribe
    } catch (error) {
      unsubscribe()
      throw error
    }
  }

  function subscribeAction<T extends { payload: any }>(
    actionCreator: ActionCreator<any[], T>,
    cb: Fn<[T & { type: string }]>,
  ): Fn {
    addToSetsMap(actionsListeners, actionCreator.type, cb)

    return () => delFromSetsMap(actionsListeners, actionCreator.type, cb)
  }

  function subscribeTransaction(cb: Fn<[Transaction]>): Fn<[], void> {
    transactionListeners.add(cb)

    return () => transactionListeners.delete(cb)
  }

  function subscribe(cb: Fn<[Transaction]>): Fn<[], void>
  function subscribe<T>(atom: Atom<T>, cb: Fn<[T]>): Fn
  function subscribe<T extends { payload: any }>(
    actionCreator: ActionCreator<any[], T>,
    cb: Fn<[T & { type: string }]>,
  ): Fn
  function subscribe(
    ...a: [Fn<[Transaction]>] | [Atom, Fn] | [ActionCreator, Fn]
  ) {
    return a.length === 1 && isFunction(a[0])
      ? subscribeTransaction(a[0])
      : isAtom(a[0]) && isFunction(a[1]) // @ts-expect-error
      ? subscribeAtom(...a)
      : isActionCreator(a[0]) && isFunction(a[1]) // @ts-expect-error
      ? subscribeAction(...a)
      : (invalid(true, `subscribe arguments`) as never)
  }

  const store = {
    dispatch,
    getState,
    init,
    getCache,
    subscribe,
    __DO_NOT_USE_IT_OR_YOU_WILL_BE_FIRED: {
      atomsCache,
      atomsListeners,
      actionsComputers,
      actionsListeners,
      transactionListeners,
    },
  }

  return store
}

export const defaultStore = createStore()
