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
  IAtomPatch,
  init,
  invalid,
  IPatch,
  isAction,
  isAtom,
  IStore,
  onSetsDiff,
} from './internal'

export function createStore(snapshot?: Record<string, any>): IStore {
  const atomsCache = new WeakMap<IAtom, IAtomCache>()
  const activeAtoms = new Map<IActionType, Set<IAtom>>()
  const patchListeners = new Set<F<[Array<IAction>, IPatch]>>()
  const actionsListeners = new Map<IActionType, Set<F<[any]>>>()

  function mergePatch(patch: IPatch) {
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

  const dispatch = (action: IAction | Array<IAction>) => {
    const actions = Array.isArray(action) ? action : [action]
    const finalPatch = new Map<IAtom, IAtomPatch>()
    let cache = atomsCache

    actions.forEach((action, i) => {
      invalid(
        !(
          typeof action.type == 'string' &&
          'payload' in action &&
          ('memo' in action == false || typeof action.memo == 'function')
        ),
        `dispatch arguments`,
      )
      const activeAtomsSet = activeAtoms.get(action.type)

      if (activeAtomsSet) {
        if (finalPatch.size > 0 && cache === atomsCache) {
          cache = Object.assign(Object.create(atomsCache), {
            get(key: any) {
              return finalPatch.get(key) || atomsCache.get(key)
            },
          })
        }
        const patch: typeof finalPatch =
          i === 0 || finalPatch.size === 0 ? finalPatch : new Map()
        const memo = createMemo({ action, cache, patch, snapshot })

        activeAtomsSet.forEach(memo)

        if (patch !== finalPatch)
          patch.forEach((atomPatch, atom) => {
            const atomFinalPatch = finalPatch.get(atom)
            if (atomFinalPatch) {
              atomFinalPatch.deps = atomPatch.deps
              atomFinalPatch.listeners = atomPatch.listeners
              atomFinalPatch.state = atomPatch.state
              atomFinalPatch.types = atomPatch.types

              atomFinalPatch.isDepsChange =
                atomFinalPatch.isDepsChange || atomPatch.isDepsChange
              atomFinalPatch.isStateChange =
                atomFinalPatch.isStateChange || atomPatch.isStateChange
              atomFinalPatch.isTypesChange =
                atomFinalPatch.isTypesChange || atomPatch.isTypesChange
            } else finalPatch.set(atom, atomPatch)
          })
      }
    })

    mergePatch(finalPatch)

    patchListeners.forEach(cb => callSafety(cb, actions, finalPatch))

    finalPatch.forEach(
      atomCache =>
        atomCache.isStateChange &&
        atomCache.listeners.forEach(cb => callSafety(cb, atomCache.state)),
    )

    actions.forEach(action =>
      actionsListeners
        .get(action.type)
        ?.forEach(cb => callSafety(cb, action.payload)),
    )
  }

  function getState<T>(): Record<string, any>
  function getState<T>(atom: IAtom<T>): T | undefined
  function getState<T>(atom?: IAtom<T>) {
    if (atom === undefined) {
      const result = {} as Record<string, any>

      activeAtoms.forEach((atoms, type) =>
        atoms.forEach(
          atom => (result[atom.displayName] = atomsCache.get(atom)!.state),
        ),
      )

      return result
    }

    invalid(!isAtom(atom), `"getState" argument`)

    return (
      atomsCache.get(atom) ||
      createMemo({
        action: init(),
        cache: atomsCache,
        patch: new Map(),
        snapshot,
      })(atom)
    ).state
  }

  function subscribeAtom<T>(atom: IAtom<T>, cb: F<[T]>): F<[], void> {
    let atomCache = atomsCache.get(atom)

    if (!atomCache) {
      const patch = new Map()
      atomCache = createMemo({
        action: init(),
        cache: atomsCache,
        patch,
        snapshot,
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

  function subscribePatch(cb: F<[Array<IAction>, IPatch]>): F<[], void> {
    patchListeners.add(cb)

    return () => patchListeners.delete(cb)
  }

  function subscribe<T>(atom: IAtom<T>, cb: F<[T]>): F<[], void>
  function subscribe<T>(
    actionCreator: IActionCreator<T>,
    cb: (payload: T) => void,
  ): F<[], void>
  function subscribe(cb: F<[Array<IAction>, IPatch]>): F<[], void>
  function subscribe<T>(
    ...a:
      | [IAtom<T>, F<[T]>]
      | [IActionCreator<T>, F<[T]>]
      | [F<[Array<IAction>, IPatch]>]
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
