import {
  createPatch,
  F,
  IAction,
  IActionCreator,
  IAtom,
  IAtomCache,
  IAtomPatch,
  identity,
  IMemo,
  invalid,
  isAction,
  ITrack,
  Patch,
  safeAction,
  safeAtom,
} from './internal'

function invalidateDeps<T>(
  cache: IAtomCache<T>,
  patch: IAtomPatch<T>,
  dep: IAtom | IActionCreator,
) {
  const depIndex = patch.deps.length
  patch.deps.push(dep)
  patch.isDepsChange =
    patch.isDepsChange ||
    cache.deps.length <= depIndex ||
    cache.deps[depIndex] !== dep
}

function invalidateTypes<T>(
  cache: IAtomCache<T>,
  patch: IAtomPatch<T>,
  type: string,
) {
  patch.types.add(type)
  patch.isTypesChange =
    patch.isTypesChange ||
    cache.types.size < patch.types.size ||
    !cache.types.has(type)
}

export function createMemo({
  action,
  cache,
  patch,
}: {
  action: IAction
  cache: WeakMap<IAtom, IAtomCache>
  patch: Patch
}): IMemo {
  return function memo<T>(atom: IAtom<T>): IAtomPatch<T> {
    const atomPatch = patch.get(atom)
    if (atomPatch) return atomPatch

    let atomCache = cache.get(atom)
    let shouldInvalidateDeps = false

    if (!atomCache) {
      // shouldInvalidateDeps = true
      atomCache = createPatch()
    } else if (
      !atomCache.types.has(action.type) ||
      atomCache.deps.every(dep => {
        if (isAction(dep)) return dep.type !== action.type
        const { isStateChange, isTypesChange } = memo(dep)
        return !isStateChange && !isTypesChange
      })
    ) {
      const result = createPatch(atomCache /* is*Change: false  */)
      patch.set(atom, result)
      return result
    }

    const result = createPatch<T>({ listeners: atomCache.listeners })
    let shouldTrack = true

    const track: ITrack = (
      ...args:
        | [any, IActionCreator]
        | [any, IActionCreator, F<[any], any>]
        | [IAtom]
    ) => {
      if (args.length === 1) {
        const depAtom = safeAtom(args[0])
        const depPatch = memo(depAtom)

        if (shouldTrack) {
          // TODO: improve
          result.isDepsChange = result.isDepsChange || depPatch.isTypesChange

          invalidateDeps(atomCache!, result, depAtom)
        }

        return depPatch.state
      } else {
        const fallback = args[0]
        const depActionCreator = safeAction(args[1])
        const mapper = args.length === 3 ? args[2] : identity
        const depType = depActionCreator.type

        if (shouldTrack) invalidateDeps(atomCache!, result, depActionCreator)

        shouldTrack = false
        const value =
          depType === action.type ? mapper(action.payload) : fallback
        shouldTrack = true

        return value
      }
    }

    result.state = atom.computer(track, atomCache.state)

    invalid(result.state === undefined, `state, can't be undefined`)

    result.isStateChange = !Object.is(result.state, atomCache.state)

    result.isDepsChange =
      result.isDepsChange || atomCache.deps.length != result.deps.length

    if (result.isDepsChange) {
      result.deps.forEach(dep => {
        if (isAction(dep)) {
          invalidateTypes(atomCache!, result, dep.type)
        } else {
          memo(dep).types.forEach(type =>
            invalidateTypes(atomCache!, result, type),
          )
        }
      })
      result.isTypesChange =
        result.isTypesChange || atomCache.types.size != result.types.size
      result.types = result.isTypesChange ? result.types : atomCache.types
    } else {
      result.deps = atomCache.deps
      result.types = atomCache.types
    }

    patch.set(atom, result)

    return result
  }
}
