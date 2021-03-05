import { AtomCache, init, invalid, Memo, Track } from './internal'

export const memo: Memo = (transaction, atom, atomCacheSnapshot?) => {
  const atomPatch = transaction.patch.get(atom)!
  if (atomPatch !== undefined) return atomPatch

  const { actions, cache, patch, snapshot } = transaction
  const patchTypes: AtomCache['types'] = new Set()
  const patchDeps: AtomCache['deps'] = []
  let atomCache = cache.get(atom) || atomCacheSnapshot
  let trackNesting = 0
  let isDepsChange = false
  let result: AtomCache | undefined

  if (atomCache !== undefined) {
    const { types, deps } = atomCache
    if (
      // FIXME: make it more obvious
      actions[0].type === init.type ||
      !actions.some(
        action =>
          types.has(action.type) &&
          deps.some(
            dep =>
              // If parent atoms are not changed recomputation is not needed.
              // Also this test the case when cache was created
              // then all listeners / children was removed
              // then deps change their value
              // then atom returns to active
              // and may been stale.
              dep.cache !== dep.dep(transaction),
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

  const { state, types, deps } = atomCache

  const track: Track = (dep: any) => {
    if (result === undefined) {
      if (
        trackNesting === 0 &&
        deps.length > patchDeps.length &&
        deps[patchDeps.length].dep === dep
      ) {
        var depCacheSnapshot = deps[patchDeps.length].cache
      }

      trackNesting++
      const depPatch = dep(transaction, depCacheSnapshot!)
      trackNesting--

      const { handler = dep } = depPatch

      if (trackNesting === 0) {
        const depIndex = patchDeps.length

        patchDeps.push({ dep: handler, cache: depPatch })

        isDepsChange =
          isDepsChange ||
          deps.length <= depIndex ||
          deps[depIndex].dep !== handler ||
          deps[depIndex].cache!.types !== depPatch.types
      }

      if ('state' in depPatch) return depPatch.state
    } else {
      invalid(true, `outdated track call`)
    }
  }

  const newState = atom.computer(
    track,
    state === undefined ? snapshot[atom.displayName] : state,
  )

  invalid(newState === undefined, `state, can't be undefined`)

  if (isDepsChange || deps.length > patchDeps.length) {
    patchDeps.forEach(dep =>
      dep.cache.types.forEach(type => patchTypes.add(type)),
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
