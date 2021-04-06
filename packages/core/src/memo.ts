import { AtomCache, AtomDep, Handler, invalid, Memo, Track } from './internal'

export const memo: Memo = (transaction, atom, atomCacheSnapshot?) => {
  const { actions, getCache, patch, snapshot } = transaction
  const atomPatch = patch.get(atom)!
  if (atomPatch !== undefined) return atomPatch

  let patchDeps: AtomCache['deps'] = []
  let patchTypes: AtomCache['types'] = new Set()
  let atomCache = getCache(atom) || atomCacheSnapshot
  let isDepsHandlerChange = false
  let isDepsCacheChange = false
  let isDepsTypesChange = false
  let trackNesting = 0
  let patchState: any
  let result: AtomCache | undefined

  function calcResult() {
    if (isDepsTypesChange) {
      patchDeps.forEach(dep =>
        dep.cache.types.forEach(type => patchTypes.add(type)),
      )
    } else {
      patchTypes = atomCache!.types
    }
    result =
      isDepsCacheChange || !Object.is(atomCache!.state, patchState)
        ? {
            types: patchTypes,
            state: patchState,
            deps: patchDeps,
          }
        : atomCache!

    patch.set(atom, result)

    return result
  }

  tryToSkipComputer: if (atomCache !== undefined) {
    const { types, deps } = atomCache

    if (actions.some(action => types.has(action.type))) {
      for (let i = 0; i < deps.length; i++) {
        const { handler: depHandler, cache: depCache } = deps[i]
        const depPatch = depHandler(transaction, depCache)
        const { handler = depHandler } = depPatch

        patchDeps.push({ handler, cache: depPatch })

        if (depPatch !== depCache) {
          if (
            handler !== depHandler ||
            !('state' in depPatch) ||
            depPatch.state !== depCache.state
          ) {
            patchDeps = []
            patchTypes = new Set()
            isDepsCacheChange = false
            isDepsTypesChange = false
            break tryToSkipComputer
          }

          isDepsCacheChange = true

          isDepsTypesChange =
            isDepsTypesChange || depPatch.types !== depCache.types
        }
      }
    }

    patchState = atomCache.state

    return calcResult()
  } else {
    atomCache = {
      types: new Set(),
      state: undefined as any,
      deps: [],
    }
  }

  const { state = snapshot[atom.id], deps } = atomCache

  const track: Track = (depHandler: Handler<any>) => {
    if (result === undefined) {
      const depIndex = patchDeps.length
      let dep: undefined | AtomDep
      let depCache: undefined | AtomDep['cache']

      if (trackNesting === 0 && deps.length > depIndex) {
        dep = deps[depIndex]
        if (dep.handler === depHandler) depCache = dep.cache
      }

      trackNesting++
      const depPatch = depHandler(transaction, depCache)
      trackNesting--

      const { handler = depHandler } = depPatch

      if (trackNesting === 0) {
        patchDeps.push({ handler, cache: depPatch })

        isDepsHandlerChange =
          isDepsHandlerChange ||
          deps.length <= depIndex ||
          dep!.handler !== handler

        isDepsCacheChange =
          isDepsCacheChange || isDepsHandlerChange || dep!.cache !== depPatch

        isDepsTypesChange =
          isDepsTypesChange ||
          isDepsHandlerChange ||
          depCache?.types !== depPatch.types
      }

      return depPatch.state
    } else {
      invalid(true, `outdated track call of "${atom.id}"`)
    }
  }

  patchState = atom.computer(track, state)
  invalid(
    patchState === undefined,
    `result of "${atom.id}" computer, state can't be undefined`,
  )

  isDepsHandlerChange = isDepsHandlerChange || deps.length > patchDeps.length
  isDepsCacheChange = isDepsCacheChange || isDepsHandlerChange
  isDepsTypesChange = isDepsTypesChange || isDepsHandlerChange

  return calcResult()
}
