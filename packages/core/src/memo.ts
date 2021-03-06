import {
  AC,
  Atom,
  Cache,
  Effect,
  Fn,
  invalid,
  isActionCreator,
  isAtom,
  isFunction,
  Rec,
  Reducer,
  Track,
  Transaction,
} from './internal'

export function memo<State, Ctx extends Rec = Rec>(
  transaction: Transaction,
  cache: Cache<State>,
  reducer: Reducer<State, Ctx>,
): Cache<State> {
  let { deps, state, types } = cache
  let depsCount = 0
  let typesCount = 0
  let nesting = 0

  function getMutableDeps(to?: number) {
    if (deps == cache.deps) {
      deps = deps.slice(0, to)
    }

    return deps
  }

  function getMutableTypes() {
    if (types == cache.types) types = types.slice(0, typesCount)
    return types
  }

  function calcResult(): Cache<State> {
    return deps == cache.deps &&
      Object.is(state, cache.state) &&
      types == cache.types
      ? cache
      : { ctx: cache.ctx, deps, state, toSnapshot: cache.toSnapshot, types }
  }

  const shouldSkipReducer =
    (deps.length > 0 || types.length > 0) &&
    transaction.actions.every((action) => !types.includes(action.type)) &&
    deps.every(({ atom: depAtom, cache: depCache }, i) => {
      const depPatch = transaction.process(depAtom, depCache)

      if (Object.is(depCache.state, depPatch.state)) {
        if (depPatch != depCache) {
          getMutableDeps()[i] = { atom: depAtom, cache: depPatch }
        }

        return true
      }

      return false
    })

  if (shouldSkipReducer) {
    return calcResult()
  }

  deps = cache.deps

  function scheduleEffect(effect: any) {
    if (isFunction(effect)) {
      transaction.effects.push((store) => effect(store, cache.ctx))
    }
  }

  function trackAtom(depAtom: Atom, cb?: Fn) {
    const dep =
      nesting == 1 && cache.deps.length > depsCount
        ? cache.deps[depsCount]
        : null
    const isDepChange = dep?.atom != depAtom
    const depPatch = transaction.process(
      depAtom,
      isDepChange ? undefined : dep!.cache,
    )

    if (nesting == 1) {
      const isDepPatchChange = isDepChange || dep!.cache != depPatch
      const isDepStateChange =
        isDepChange || !Object.is(dep!.cache.state, depPatch.state)

      if (isDepPatchChange || deps != cache.deps) {
        getMutableDeps(depsCount).push({ atom: depAtom, cache: depPatch })
      }

      depsCount++

      if (isDepStateChange && cb) {
        scheduleEffect(
          cb(depPatch.state, isDepChange ? undefined : dep!.cache.state),
        )
      }
    } else {
      // this is wrong coz we not storing previous value of the atom
      // and can't compare it with the actual value
      // to handle the reaction correctly
      invalid(cb, `atom reaction in nested track`)
    }

    return depPatch.state
  }

  function trackAction({ type }: AC, cb?: Fn) {
    if (nesting == 1) {
      invalid(!cb, `action track without callback`)

      if (
        types.length <= typesCount ||
        types[typesCount] != type ||
        types != cache.types
      ) {
        getMutableTypes().push(type)
      }

      typesCount++

      transaction.actions.forEach((action) => {
        if (action.type == type) {
          scheduleEffect(cb!(action.payload, action))
        }
      })
    } else {
      // this is wrong coz may cause nondeterministic behavior.
      invalid(1, `action handling in nested track`)
    }
  }

  let track: Track<Ctx> = (target: AC | Atom | Effect<Ctx>, cb?: Fn) => {
    // TODO: how to pass the `id` of atom here?
    invalid(
      Number.isNaN(nesting),
      `outdated track call, use \`store.getState\` in an effect.`,
    )

    try {
      nesting++

      if (isAtom(target)) return trackAtom(target, cb)
      if (isActionCreator(target)) return trackAction(target, cb)

      invalid(isFunction(cb), `track arguments`)

      scheduleEffect(target)
    } finally {
      nesting--
    }
  }

  state = reducer(
    track,
    // @ts-expect-error
    state,
  )

  nesting = NaN

  return calcResult()
}
