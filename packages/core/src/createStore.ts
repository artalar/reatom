import {
  addToSetsMap,
  callSafety,
  createMemo,
  createPatch,
  delFromSetsMap,
  F,
  IAction,
  IActionCreator,
  IAtom,
  IAtomCache,
  IAtomPatch,
  init,
  invalid,
  isAction,
  isAtom,
  onSetsDiff,
  Patch,
} from './internal'

export function createStore() {
  const atomsCache = new WeakMap<IAtom, IAtomCache>()
  const activeAtoms = new Map<string, Set<IAtom>>()
  const patchListeners = new Set<F<[IAction, Patch]>>()
  const actionsListeners = new Map<string, Set<F<[any]>>>()

  function mergePatch(patch: Patch) {
    patch.forEach(
      (
        {
          deps,
          listeners,
          state,
          types,
          isDepsChange,
          isStateChange,
          isTypesChange,
        },
        atom,
      ) => {
        const atomCacheTypes = atomsCache.get(atom)?.types ?? new Set()
        if (isTypesChange && listeners.size) {
          onSetsDiff(atomCacheTypes, types, t =>
            delFromSetsMap(activeAtoms, t, atom),
          )
          onSetsDiff(types, atomCacheTypes, t =>
            addToSetsMap(activeAtoms, t, atom),
          )
        }

        if (isDepsChange || isStateChange || isTypesChange) {
          atomsCache.set(atom, {
            deps,
            listeners,
            state,
            types,
          })
        }
      },
    )
  }

  function dispatch(action: IAction) {
    invalid(
      !(
        typeof action.type == 'string' &&
        'payload' in action &&
        ('memo' in action == false || typeof action.memo == 'function')
      ),
      `dispatch arguments`,
    )
    const activeAtomsSet = activeAtoms.get(action.type)
    const patch = new Map<IAtom, IAtomPatch>()

    if (activeAtomsSet) {
      const memo = createMemo({ action, cache: atomsCache, patch })

      activeAtomsSet.forEach(memo)

      mergePatch(patch)

      patch.forEach(
        cache =>
          cache.isStateChange &&
          cache.listeners.forEach(cb => callSafety(cb, cache.state)),
      )
    }

    patchListeners.forEach(cb => callSafety(cb, action, patch))

    actionsListeners
      .get(action.type)
      ?.forEach(cb => callSafety(cb, action.payload))
  }

  function getState<T>(atom: IAtom<T>): T | undefined {
    invalid(!isAtom(atom), `"getState" argument`)

    return atomsCache.get(atom)?.state
  }

  function subscribeAtom<T>(atom: IAtom<T>, cb: F<[T]>): F<[], void> {
    let atomCache = atomsCache.get(atom)

    if (!atomCache) {
      const patch = new Map()
      atomCache = createMemo({
        action: init(),
        cache: atomsCache,
        patch,
      })(atom)
      atomCache.listeners.add(cb)
      mergePatch(patch)
    }

    atomCache.listeners.add(cb)

    function unsubscribe() {
      atomCache!.listeners.delete(cb)
      if (atomCache!.listeners.size === 0) {
        atomCache!.types.forEach(t => delFromSetsMap(activeAtoms, t, atom))
      }
    }

    try {
      cb(atomCache!.state)
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

  function subscribePatch(cb: F<[IAction, Patch]>): F<[], void> {
    patchListeners.add(cb)

    return () => patchListeners.delete(cb)
  }

  function subscribe<T>(atom: IAtom<T>, cb: F<[T]>): F<[], void>
  function subscribe<T>(
    actionCreator: IActionCreator<T>,
    cb: (payload: T) => void,
  ): F<[], void>
  function subscribe(cb: F<[IAction, Patch]>): F<[], void>
  function subscribe<T>(
    ...a:
      | [IAtom<T>, F<[T]>]
      | [IActionCreator<T>, F<[T]>]
      | [F<[IAction, Patch]>]
  ): F<[], void> {
    return a.length === 1 && typeof a[0] === 'function'
      ? subscribePatch(a[0])
      : isAtom(a[0]) && typeof a[1] === 'function' // @ts-expect-error
      ? subscribeAtom(...a)
      : isAction(a[0]) && typeof a[1] === 'function' // @ts-expect-error
      ? subscribeAction(...a)
      : (invalid(1, `subscribe arguments`) as never)
  }

  return {
    dispatch,
    getState,
    subscribe,
  }
}
