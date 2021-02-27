import {
  Action,
  Atom,
  F,
  IAction,
  IActionCreator,
  IAtom,
  IAtomCache,
  IMemo,
  init,
  invalid,
  IPatch,
  isActionCreator,
  IStoreCache,
  ITrack,
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

    const types: IAtomCache['types'] = new Set()
    const deps: IAtomCache['deps'] = []
    let atomCache = cache.get(atom)
    let shouldTrack = true
    let isDepsChange = false
    let isTypesChange = false
    let result: IAtomCache | undefined

    if (!atomCache) {
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
      atomCache.deps.every((dep, i) =>
        isActionCreator(dep.unit)
          ? dep.unit.type !== action.type
          : dep.cache === memo(dep.unit),
      )
    ) {
      patch.set(atom, atomCache)
      return atomCache
    }

    const track: ITrack = (
      ...args: [IActionCreator, F<[any], any>] | [IAtom]
    ) => {
      if (result === undefined) {
        if (args.length === 1) {
          const depAtom = safeAtom(args[0])
          const depPatch = memo(depAtom)

          if (shouldTrack) {
            const depIndex = deps.length

            deps.push({ unit: depAtom, cache: depPatch })

            isDepsChange =
              isDepsChange ||
              atomCache!.deps.length <= depIndex ||
              atomCache!.deps[depIndex].unit !== depAtom

            isTypesChange =
              isTypesChange ||
              isDepsChange ||
              atomCache!.deps[depIndex].cache?.types !== depPatch.types
          }

          return depPatch.state
        } else {
          invalid(!shouldTrack, `access to another action from action handler`)

          const depActionCreator = safeActionCreator(args[0])
          const reaction = safeFunction(args[1])

          deps.push({ unit: depActionCreator, cache: null })
          types.add(depActionCreator.type)
          isTypesChange =
            isTypesChange ||
            atomCache!.types.has(depActionCreator.type) === false

          shouldTrack = false
          if (depActionCreator.type === action.type) reaction(action.payload)
          shouldTrack = true
        }
      } else {
        invalid(true, `outdated track call`)
      }
    }

    const { state = snapshot[atom.displayName] } = atomCache

    const newState = atom.computer(track, state)

    invalid(newState === undefined, `state, can't be undefined`)

    if (
      (isTypesChange =
        isTypesChange || isDepsChange || atomCache.deps.length > deps.length)
    ) {
      deps.forEach(dep =>
        isActionCreator(dep.unit)
          ? types.add(dep.unit.type)
          : dep.cache!.types.forEach(type => types.add(type)),
      )
    }

    result =
      isTypesChange || Object.is(atomCache.state, newState) === false
        ? {
            state: newState,
            types: isTypesChange ? types : atomCache.types,
            deps,
          }
        : atomCache

    patch.set(atom, result)

    return result
  }
}
