import {
  Action,
  ActionCreator,
  ActionType,
  addToSetsMap,
  Atom,
  AtomCache,
  callSafety,
  createTransaction,
  delFromSetsMap,
  F,
  Handler,
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
  const atomsCache = new WeakMap<Atom, AtomCache>()
  const atomsListeners = new Map<Atom, Set<F>>()
  const actionsComputers = new Map<ActionType, Set<Atom>>()
  const actionsListeners = new Map<ActionType, Set<F>>()
  const transactionListeners = new Set<F<[Transaction]>>()

  function mergePatch(patch: AtomCache, atom: Atom) {
    const atomCache = atomsCache.get(atom)
    if (atomsListeners.has(atom)) {
      if (atomCache === undefined) {
        patch.types.forEach(type => addToSetsMap(actionsComputers, type, atom))
      } else if (atomCache.types !== patch.types) {
        patch.types.forEach(
          type =>
            atomCache.types.has(type) ||
            addToSetsMap(actionsComputers, type, atom),
        )
        atomCache.types.forEach(
          type =>
            patch.types.has(type) ||
            delFromSetsMap(actionsComputers, type, atom),
        )
      }
    }

    atomsCache.set(atom, patch)

    return Object.is(atomCache?.state, patch.state)
  }

  const dispatch: Store['dispatch'] = (action: Action | Array<Action>) => {
    const actions = Array.isArray(action) ? action : [action]
    invalid(
      actions.length === 0 || actions.every(isAction) === false,
      `dispatch arguments`,
    )

    const patch = new Map<Atom, AtomCache>()
    const transaction = createTransaction(actions, atomsCache, patch, snapshot)
    const changedAtoms = new Array<[Atom, AtomCache]>()

    actions.forEach(action =>
      actionsComputers.get(action.type)?.forEach(atom => atom(transaction)),
    )

    patch.forEach(
      (atomPatch, atom) =>
        mergePatch(atomPatch, atom) || changedAtoms.push([atom, atomPatch]),
    )

    actions.forEach(action =>
      transactionListeners.forEach(cb => callSafety(cb, transaction)),
    )

    changedAtoms.forEach(change =>
      atomsListeners
        .get(change[0])
        ?.forEach(cb => callSafety(cb, change[1].state)),
    )

    actions.forEach(action =>
      actionsListeners.get(action.type)?.forEach(cb => callSafety(cb, action)),
    )

    transaction.effects.forEach(cb => callSafety(cb, store))

    return patch
  }

  function getCache<T>(atom: Atom<T>): AtomCache<T> | undefined {
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

      function collect(handler: Handler<any>) {
        if (isAtom(handler)) {
          const { state, deps } = atomsCache.get(handler)!

          result[handler.displayName] = state
          deps.forEach(dep => collect(dep.handler))
        }
      }

      actionsComputers.forEach(atoms => atoms.forEach(collect))

      return result
    }

    invalid(!isAtom(atom), `"getState" argument`)

    let atomCache = atomsCache.get(atom)

    if (atomCache === undefined) {
      const patch = new Map<Atom, AtomCache>()
      atomCache = atom(
        createTransaction(
          [{ type: `init [${Math.random()}]`, payload: null }],
          atomsCache,
          patch,
          snapshot,
        ),
      )

      patch.forEach(mergePatch)
    }

    return atomCache.state
  }

  function init(...atoms: Array<Atom>) {
    const unsubscribers = atoms.map(atom => subscribeAtom(atom, noop))
    return () => unsubscribers.forEach(un => un())
  }

  function subscribeAtom<T>(atom: Atom<T>, cb: F<[T]>): F<[], void> {
    let listeners = atomsListeners.get(atom)

    if (listeners === undefined) {
      atomsListeners.set(atom, (listeners = new Set()))
    }

    listeners.add(cb)

    getState(atom)

    const atomCache = atomsCache.get(atom)!

    // FIXME: should happen by `getState`
    atomCache.types.forEach(type => addToSetsMap(actionsComputers, type, atom))

    function unsubscribe() {
      listeners!.delete(cb)
      if (listeners!.size === 0) {
        atomsListeners.delete(atom)
        atomsCache
          .get(atom)!
          .types.forEach(type => delFromSetsMap(actionsComputers, type, atom))
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
    cb: F<[T & { type: string }]>,
  ): F {
    addToSetsMap(actionsListeners, actionCreator.type, cb)

    return () => delFromSetsMap(actionsListeners, actionCreator.type, cb)
  }

  function subscribeTransaction(cb: F<[Transaction]>): F<[], void> {
    transactionListeners.add(cb)

    return () => transactionListeners.delete(cb)
  }

  function subscribe(cb: F<[Transaction]>): F<[], void>
  function subscribe<T>(atom: Atom<T>, cb: F<[T]>): F
  function subscribe<T extends { payload: any }>(
    actionCreator: ActionCreator<any[], T>,
    cb: F<[T & { type: string }]>,
  ): F
  function subscribe(
    ...a: [F<[Transaction]>] | [Atom, F] | [ActionCreator, F]
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
  }

  return store
}
