import {
  Action,
  ActionCreator,
  Atom,
  AtomCache,
  AtomPatch,
  createPatch,
  F,
  identity,
  isAction,
  Memo,
  safeAction,
  safeAtom,
  Track,
} from './internal'

function invalidateDeps<T>(
  cache: AtomCache<T>,
  patch: AtomPatch<T>,
  dep: Atom | ActionCreator,
) {
  const depIndex = patch.deps.length
  patch.deps.push(dep)
  patch.isDepsChange =
    patch.isDepsChange ||
    cache.deps.length === depIndex ||
    cache.deps[depIndex] !== dep
}

function invalidateTypes<T>(
  cache: AtomCache<T>,
  patch: AtomPatch<T>,
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
  action: Action
  cache: WeakMap<Atom, AtomCache>
  patch: Map<Atom, AtomPatch>
}): Memo {
  return function memo<T>(atom: Atom<T>): AtomPatch<T> {
    const atomPatch = patch.get(atom)
    if (atomPatch) return atomPatch

    let atomCache = cache.get(atom)

    if (!atomCache) atomCache = createPatch()
    else if (
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

    const track: Track = (
      ...args:
        | [any, ActionCreator]
        | [any, ActionCreator, F<[any], any>]
        | [Atom]
    ) => {
      if (args.length === 1) {
        const depAtom = safeAtom(args[0])
        const depPatch = memo(depAtom)

        invalidateDeps(atomCache!, result, depAtom)

        return depPatch.state
      } else {
        const fallback = args[0]
        const depActionCreator = safeAction(args[1])
        const mapper = args.length === 3 ? args[2] : identity
        const depType = depActionCreator.type

        invalidateDeps(atomCache!, result, depActionCreator)

        return depType === action.type ? mapper(action.payload) : fallback
      }
    }

    result.state = atom.computer(track, atomCache.state)

    if (result.state === undefined) throw new Error(`State can't be undefined`)

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
    }

    patch.set(atom, result)

    return result
  }
}
