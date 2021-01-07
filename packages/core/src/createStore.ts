import {
  addToSetsMap,
  callSafety,
  createMemo,
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
  onDiff,
  Patch,
} from './internal'

export function createStore() {
  const activeAtoms = new Map<string, Set<IAtom>>()
  const patchListeners = new Set<F<[IAction, Patch]>>()
  const actionsListeners = new Map<string, Set<F<[any]>>>()
  const atomsCache = new WeakMap<IAtom, IAtomCache>()

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

    if (!activeAtomsSet) return

    const patch = new Map<IAtom, IAtomPatch>()

    const memo = createMemo({ action, cache: atomsCache, patch })

    activeAtomsSet.forEach(memo)

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
        const atomCache = atomsCache.get(atom)
        if (isTypesChange && atomCache && listeners.size) {
          onDiff(atomCache.types, types, t =>
            delFromSetsMap(activeAtoms, t, atom),
          )
          onDiff(types, atomCache.types, t =>
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
    patch.forEach(
      cache =>
        cache.isStateChange &&
        cache.listeners.forEach(cb => callSafety(cb, cache.state)),
    )
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
      atomsCache.set(
        atom,
        (atomCache = createMemo({
          action: init(),
          cache: atomsCache,
          patch: new Map(),
        })(atom)),
      )!
      atomCache.types.forEach(t => addToSetsMap(activeAtoms, t, atom))
    }

    atomCache.listeners.add(cb)

    return () => {
      atomCache!.listeners.delete(cb)
      if (atomCache!.listeners.size === 0) {
        atomCache!.types.forEach(t => delFromSetsMap(activeAtoms, t, atom))
      }
    }
  }

  function subscribeAction<T>(
    actionCreator: IActionCreator<T>,
    cb: (payload: T) => void,
  ) {
    addToSetsMap(actionsListeners, actionCreator.type, cb)

    return () => delFromSetsMap(actionsListeners, actionCreator.type, cb)
  }

  function subscribePatch(cb: F<[IAction, Patch]>) {
    patchListeners.add(cb)

    return () => patchListeners.delete(cb)
  }

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
