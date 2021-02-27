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
  safeAtom,
  safeFunction,
} from './internal'

export function createMemo({
  action,
  cache,
  patch,
  snapshot = {},
}: {
  action: IAction
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
    let isTypesChange = false
    let result: IAtomCache | undefined

    if (atomCache === undefined) {
      atomCache = {
        state: undefined,
        types: new Set(),
        deps: [],
      }
    } else if (
      action.type === init.type ||
      atomCache.types.has(action.type) === false ||
      // If parent atoms are not changed recomputation is not needed.
      // Also this test the case when cache was created
      // then all listeners / children was removed
      // then deps change their value
      // then atom returns to active
      // and may been stale.
      atomCache.deps.every(dep =>
        dep[0][KIND] === 'action'
          ? (dep[0] as IActionCreator).type !== action.type
          : dep[1] === memo(dep[0] as IAtom),
      )
    ) {
      patch.set(atom, atomCache)
      return atomCache
    }

    const { state = snapshot[atom.displayName], types, deps } = atomCache

    function track() {
      if (result === undefined) {
        if (arguments.length === 1) {
          const depAtom = safeAtom(arguments[0])
          const depPatch = memo(depAtom)

          if (shouldTrack) {
            const depIndex = patchDeps.length

            patchDeps.push([depAtom, depPatch])

            isDepsChange =
              isDepsChange ||
              deps.length <= depIndex ||
              deps[depIndex][0] !== depAtom

            isTypesChange =
              isTypesChange ||
              isDepsChange ||
              deps[depIndex][1]?.types !== depPatch.types
          }

          return depPatch.state
        } else {
          invalid(!shouldTrack, `access to another action from action handler`)

          const depActionCreator = safeActionCreator(arguments[0])

          patchDeps.push([depActionCreator, null])
          isTypesChange =
            isTypesChange || types.has(depActionCreator.type) === false

          shouldTrack = false
          if (depActionCreator.type === action.type) {
            safeFunction(arguments[1])(action.payload)
          }
          shouldTrack = true
        }
      } else {
        invalid(true, `outdated track call`)
      }
    }

    const newState = atom.computer(track, state)

    invalid(newState === undefined, `state, can't be undefined`)

    if (
      (isTypesChange =
        isTypesChange || isDepsChange || deps.length > patchDeps.length)
    ) {
      patchDeps.forEach(dep =>
        dep[0][KIND] === 'action'
          ? patchTypes.add((dep[0] as IActionCreator).type)
          : dep[1]!.types.forEach(type => patchTypes.add(type)),
      )
    }

    result =
      isTypesChange || Object.is(state, newState) === false
        ? {
            state: newState,
            types: isTypesChange ? patchTypes : types,
            deps: patchDeps,
          }
        : atomCache

    patch.set(atom, result)

    return result
  }
}
