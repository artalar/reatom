import {
  addToSetsMap,
  callSafety,
  createMemo,
  delFromSetsMap,
  F,
  IAction,
  IActionCreator,
  IActionType,
  IAtom,
  IAtomCache,
  init as createInitAction,
  invalid,
  IPatch,
  isAction,
  isActionCreator,
  isAtom,
  isFunction,
  IStore,
  noop,
} from './internal'

export function createStore(snapshot?: Record<string, any>): IStore {
  const atomsCache = new WeakMap<IAtom, IAtomCache>()
  const atomsListeners = new Map<IAtom, Set<F>>()
  const actionsComputers = new Map<IActionType, Set<IAtom>>()
  const actionsListeners = new Map<IActionType, Set<F>>()
  const patchListeners = new Set<F<[IAction, IPatch]>>()

  function mergePatch(patch: IAtomCache, atom: IAtom) {
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

  const dispatch: IStore['dispatch'] = (action: IAction) => {
    invalid(!isAction(action), `action`)

    const patch = new Map<IAtom, IAtomCache>()
    const memo = createMemo({ action, cache: atomsCache, patch, snapshot })
    const changedAtoms = new Array<[IAtom, IAtomCache]>()

    actionsComputers.get(action.type)?.forEach(memo)

    patch.forEach(
      (atomPatch, atom) =>
        mergePatch(atomPatch, atom) || changedAtoms.push([atom, atomPatch]),
    )

    patchListeners.forEach(cb => callSafety(cb, action, patch))

    changedAtoms.forEach(change =>
      atomsListeners
        .get(change[0])
        ?.forEach(cb => callSafety(cb, change[1].state)),
    )

    actionsListeners
      .get(action.type)
      ?.forEach(cb => callSafety(cb, action.payload))

    return patch
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
  function getState<T>(atom: IAtom<T>): T | undefined
  function getState<T>(atom?: IAtom<T>) {
    if (atom === undefined) {
      // if (process.env.NODE_ENV !== 'production') {
      //   incrementGetStateOveruse()
      // }

      const result = {} as Record<string, any>

      function collect(unit: IAtom | IActionCreator) {
        if (isAtom(unit)) {
          const { state, deps } = atomsCache.get(unit)!

          result[unit.displayName] = state
          deps.forEach(dep => collect(dep[0]))
        }
      }

      actionsComputers.forEach(atoms => atoms.forEach(collect))

      return result
    }

    invalid(!isAtom(atom), `"getState" argument`)

    let atomCache = atomsCache.get(atom)

    if (atomCache === undefined) {
      const patch = new Map<IAtom, IAtomCache>()
      atomCache = createMemo({
        action: createInitAction(),
        cache: atomsCache,
        patch,
        snapshot,
      })(atom)

      patch.forEach(mergePatch)
    }

    return atomCache.state
  }

  function subscribeAtom<T>(atom: IAtom<T>, cb: F<[T]>): F<[], void> {
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

  function subscribeAction<T>(
    actionCreator: IActionCreator<T>,
    cb: (payload: T) => void,
  ): F<[], void> {
    addToSetsMap(actionsListeners, actionCreator.type, cb)

    return () => delFromSetsMap(actionsListeners, actionCreator.type, cb)
  }

  function subscribePatch(cb: F<[IAction, IPatch]>): F<[], void> {
    patchListeners.add(cb)

    return () => patchListeners.delete(cb)
  }

  function subscribe<T>(atom: IAtom<T>, cb: F<[T]>): F<[], void>
  function subscribe<T>(
    actionCreator: IActionCreator<T>,
    cb: (payload: T) => void,
  ): F<[], void>
  function subscribe(cb: F<[IAction, IPatch]>): F<[], void>
  function subscribe<T>(
    ...a:
      | [IAtom<T>, F<[T]>]
      | [IActionCreator<T>, F<[T]>]
      | [F<[IAction, IPatch]>]
  ): F<[], void> {
    return a.length === 1 && isFunction(a[0])
      ? subscribePatch(a[0])
      : isAtom(a[0]) && isFunction(a[1]) // @ts-expect-error
      ? subscribeAtom(...a)
      : isActionCreator(a[0]) && isFunction(a[1]) // @ts-expect-error
      ? subscribeAction(...a)
      : (invalid(true, `subscribe arguments`) as never)
  }

  function init(...atoms: Array<IAtom>) {
    const unsubscribers = atoms.map(atom => subscribeAtom(atom, noop))
    return () => unsubscribers.forEach(un => un())
  }

  return {
    dispatch,
    getState,
    init,
    subscribe,
  }
}
