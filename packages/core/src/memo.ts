import {
  AC,
  Atom,
  Cache,
  Fn,
  invalid,
  isActionCreator,
  isAtom,
  isFunction,
  isObject,
  noop,
  Rec,
  Track,
  TrackedReducer,
  Transaction,
} from './internal'

function getImmutableListRef<T>(list: Array<T>) {
  return {
    count: 0,
    isChanged: false,
    list,
    push(el: T) {
      if (
        !this.isChanged &&
        (this.count >= list.length || list[this.count] != el)
      ) {
        this.isChanged = true
        this.list = list.slice(0, this.count)
      }
      if (this.isChanged) {
        this.list.push(el)
      }
      this.count++
    },
  }
}

export function memo<State, ActionPayloadCreators extends Rec<Fn> = Rec<Fn>>(
  transaction: Transaction,
  cache: Cache<State>,
  reducer: TrackedReducer<State, ActionPayloadCreators>,
): Cache<State> {
  const { actions, stack, process, schedule } = transaction
  let { atom, ctx, deps, state, types } = cache
  let depsRef = getImmutableListRef(deps)
  let typesRef = getImmutableListRef(types)
  let nesting = 0
  let outdatedTrack = noop

  function calcResult(): Cache<State> {
    return !depsRef.isChanged &&
      Object.is(state, cache.state) &&
      !typesRef.isChanged
      ? cache
      : { atom, ctx, deps: depsRef.list, state, types: typesRef.list }
  }

  const shouldSkipReducer =
    (deps.length > 0 || types.length > 0) &&
    !actions.some((action) => types.includes(action.type)) &&
    !deps.some((depCache, i) => {
      const depPatch = process(depCache.atom, depCache)

      depsRef.push(depPatch)

      return !Object.is(depCache.state, depPatch.state)
    })

  if (shouldSkipReducer) {
    return calcResult()
  }

  depsRef = getImmutableListRef(deps)

  function trackAtom(depAtom: Atom, cb?: Fn) {
    const dep =
      nesting == 1 && deps.length > depsRef.count ? deps[depsRef.count] : null
    const isDepChange = dep?.atom != depAtom
    const depPatch = process(depAtom, isDepChange ? undefined : dep!)

    if (nesting == 1) {
      depsRef.push(depPatch)

      if (cb && (isDepChange || !Object.is(dep!.state, depPatch.state))) {
        stack.push([depAtom.id + ` - handler`])
        cb(depPatch.state, isDepChange ? undefined : dep!.state)
        stack.pop()
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

      typesRef.push(type)

      actions.forEach((action) => {
        if (action.type == type) {
          stack.push([type + ` - handler`])
          cb!(action.payload, action)
          stack.pop()
        }
      })
    } else {
      // this is wrong coz may cause nondeterministic behavior.
      invalid(1, `action handling in nested track`)
    }
  }

  // @ts-expect-error
  const track: Track<ActionPayloadCreators> = (
    target: AC | Atom | Rec<Fn>,
    cb?: Fn,
  ) => {
    outdatedTrack()

    try {
      nesting++

      if (isAtom(target)) return trackAtom(target, cb)
      if (isActionCreator(target)) return trackAction(target, cb)

      if (isObject(target)) {
        return Object.keys(target).forEach((name) =>
          trackAction(
            // @ts-expect-error
            { type: atom[name]?.type },
            target[name],
          ),
        )
      }

      invalid(1, `track arguments`)
    } finally {
      nesting--
    }
  }

  track.effect = (effect) => {
    outdatedTrack()
    invalid(!isFunction(effect), `effect, should be a function`)
    schedule((store) => effect(store, cache.ctx))
  }

  // @ts-expect-error
  track.action = (name, ...payload: any[]) => atom[name](...payload)

  state = reducer(
    track,
    // @ts-expect-error
    state,
  )

  outdatedTrack = () => invalid(1, `outdated track call for ${atom.id}.`)

  return calcResult()
}
