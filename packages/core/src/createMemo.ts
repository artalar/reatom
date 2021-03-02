import {
  IAction,
  IActionCreator,
  IAtom,
  IAtomCache,
  IMemo,
  init,
  invalid,
  IPatch,
  IStoreCache,
  KIND,
  safeActionCreator,
  safeFunction,
} from './internal'

export function createMemo({
  actions,
  cache,
  patch,
  snapshot = {},
}: {
  actions: Array<IAction>
  cache: IStoreCache
  patch: IPatch
  snapshot?: Record<string, any>
}): IMemo {
  return function memo<T>(atom: IAtom<T>): IAtomCache<T> {
    const atomPatch = patch.get(atom)!
    if (atomPatch !== undefined) return atomPatch

    const patchTypes: IAtomCache['types'] = new Set()
    const patchDeps: IAtomCache['deps'] = []
    let atomCache = cache.get(atom)
    let shouldTrack = true
    let isDepsChange = false
    let result: IAtomCache | undefined

    if (atomCache !== undefined) {
      const { types, deps } = atomCache
      if (
        actions[0].type === init.type ||
        !actions.some(
          action =>
            types.has(action.type) &&
            deps.some(({ dep, cache: depCache }) =>
              dep[KIND] === 'action'
                ? (dep as IActionCreator).type == action.type
                : // If parent atoms are not changed recomputation is not needed.
                  // Also this test the case when cache was created
                  // then all listeners / children was removed
                  // then deps change their value
                  // then atom returns to active
                  // and may been stale.
                  depCache !== memo(dep as IAtom),
            ),
        )
      ) {
        patch.set(atom, atomCache)
        return atomCache
      }
    } else {
      atomCache = {
        state: undefined,
        types: new Set(),
        deps: [],
      }
    }

    const { state = snapshot[atom.displayName], types, deps } = atomCache

    function invalidateDeps(dep: IActionCreator | IAtom) {
      const depIndex = patchDeps.length - 1

      isDepsChange =
        isDepsChange || deps.length <= depIndex || deps[depIndex].dep !== dep
    }

    function track() {
      if (result === undefined) {
        if (arguments.length === 1) {
          const depAtom = arguments[0]
          const depPatch = memo(depAtom)

          if (shouldTrack) {
            const depIndex = patchDeps.length

            patchDeps.push({ dep: depAtom, cache: depPatch })

            invalidateDeps(depAtom)

            isDepsChange =
              isDepsChange || deps[depIndex].cache!.types !== depPatch.types
          }

          return depPatch.state
        } else {
          invalid(!shouldTrack, `access to another action from action handler`)

          const depActionCreator = safeActionCreator(arguments[0])

          patchDeps.push({ dep: depActionCreator })

          invalidateDeps(depActionCreator)

          actions.forEach(action => {
            if (action.type === depActionCreator.type) {
              shouldTrack = false
              safeFunction(arguments[1])(action.payload)
              shouldTrack = true
            }
          })
        }
      } else {
        invalid(true, `outdated track call`)
      }
    }

    const newState = atom.computer(track, state)

    invalid(newState === undefined, `state, can't be undefined`)

    if (isDepsChange || deps.length > patchDeps.length) {
      patchDeps.forEach(dep =>
        dep.dep[KIND] === 'action'
          ? patchTypes.add((dep.dep as IActionCreator).type)
          : dep.cache!.types.forEach(type => patchTypes.add(type)),
      )
    }

    result =
      isDepsChange || Object.is(state, newState) === false
        ? {
            state: newState,
            types: isDepsChange ? patchTypes : types,
            deps: patchDeps,
          }
        : atomCache

    patch.set(atom, result)

    return result
  }
}
