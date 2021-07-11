import {
  AC,
  ActionPayload,
  Atom,
  Cache,
  Effect,
  Fn,
  invalid,
  isActionCreator,
  isAtom,
  isFunction,
  Rec,
  Transaction,
} from './internal'

export type Computer<State = any, Ctx extends Rec = Rec> = {
  ($: Track<State, Ctx>, state: State): State
}

export type Track<State, Ctx extends Rec> = {
  <T>(atom: Atom<T>): T
  <T>(atom: Atom<T>, cb: Fn<[T], Effect<Ctx>>): void
  <T>(atom: Atom<T>, cb: Fn<[T], any>): void
  <T extends AC>(
    actionCreator: T,
    cb: Fn<[ActionPayload<T>, ReturnType<T>], Effect<Ctx>>,
  ): void
  <T extends AC>(
    actionCreator: T,
    cb: Fn<[ActionPayload<T>, ReturnType<T>], any>,
  ): void
}

export function memo<State, Ctx extends Rec = Rec>(
  transaction: Transaction,
  cache: Cache<State>,
  computer: Computer<State, Ctx>,
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
    return deps == cache.deps && Object.is(state, cache.state) && types == cache.types
      ? cache
      : { ctx: cache.ctx, deps, state, types }
  }

  const shouldSkipComputer =
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

  if (shouldSkipComputer) {
    return calcResult()
  }

  deps = cache.deps


  function scheduleEffect(effect: any) {
    if (isFunction(effect)) {
      transaction.effects.push((store) => effect(store, cache.ctx))
    }
  }

  function trackAtom(depAtom: Atom, cb?: Fn) {
    const dep = nesting == 1 && cache.deps.length > depsCount ? cache.deps[depsCount] : null
    const isDepChange = dep?.atom != depAtom
    const depPatch = transaction.process(depAtom, isDepChange ? undefined : dep!.cache)

    if (nesting == 1) {
      const isDepPatchChange = isDepChange || dep!.cache != depPatch
      const isDepStateChange = isDepChange || !Object.is(dep!.cache.state, depPatch.state)

      if (isDepPatchChange || deps != cache.deps) {
        getMutableDeps(depsCount).push({ atom: depAtom, cache: depPatch })
      }

      depsCount++

      if (isDepStateChange && cb) {
        scheduleEffect(cb(depPatch.state))
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

      if (types.length <= typesCount || types[typesCount] != type || types != cache.types) {
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

  let track: Track<State, Ctx> = (atomOrAction: Atom | AC, cb?: Fn) => {
    // TODO: how to pass the `id` of atom here?
    invalid(Number.isNaN(nesting), `outdated track call, use \`store.getState\` in an effect.`)

    try {
      nesting++

      if (isAtom(atomOrAction)) return trackAtom(atomOrAction, cb)
      if (isActionCreator(atomOrAction)) return trackAction(atomOrAction, cb)

      invalid(1, `track arguments`)
    } finally {
      nesting--
    }
  }

  state = computer(track, cache.state)

  nesting = NaN

  return calcResult()
}
