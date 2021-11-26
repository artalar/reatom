import {
  Action,
  ActionCreator,
  Atom,
  AtomBinded,
  Cache,
  CacheReducer,
  CacheTemplate,
  Cause,
  createReatomError,
  createTemplateCache,
  defaultStore,
  Fn,
  isActionCreator,
  isAtom,
  isFunction,
  isString,
  noop,
  OmitValues,
  pushUnique,
  Store,
  Rec,
  Track,
  TrackReducer,
  Transaction,
} from './internal'

export type AtomSelfBinded<
  State = any,
  Deps extends Rec<PayloadMapper | Atom> = Rec<PayloadMapper | Atom>,
> = AtomBinded<State> & {
  [K in keyof Deps]: Deps[K] extends Atom
    ? K extends `_${string}`
      ? {
          [P in keyof Deps[K]]: Deps[K][P] extends ActionCreator
            ? Deps[K][P]
            : never
        }
      : never
    : Deps[K] extends ActionCreator
    ? never
    : K extends `_${string}`
    ? never
    : ActionCreator<Parameters<Deps[K]>, { payload: ReturnType<Deps[K]> }> & {
        dispatch: (...args: Parameters<Deps[K]>) => Action<ReturnType<Deps[K]>>
      }
}

export type AtomOptions<State = any> =
  | Atom[`id`]
  | {
      id?: Atom[`id`]
      decorators?: Array<AtomDecorator<State>>
      store?: Store
    }

export type AtomDecorator<State> = Fn<
  [cacheReducer: CacheReducer<State>],
  CacheReducer<State>
>

type PayloadMapper = Fn

let atomsCount = 0
export function createAtom<
  State,
  Deps extends Rec<PayloadMapper | Atom | ActionCreator>,
>(
  dependencies: Deps,
  reducer: TrackReducer<State, Deps>,
  options: AtomOptions<State> = {},
): AtomSelfBinded<State, OmitValues<Deps, ActionCreator>> {
  let {
    decorators = [],
    id = `atom${++atomsCount}`,
    store = defaultStore,
  } = isString(options)
    ? ({ id: options } as Exclude<AtomOptions<State>, string>)
    : options
  const trackedTypes: Array<string> = []
  const types: Array<string> = []
  const actionCreators: Rec<ActionCreator | Rec<ActionCreator>> = {}
  const externalActions: Rec<string> = {}

  if (!isFunction(reducer) || !isString(id)) {
    throw createReatomError(`Atom arguments`)
  }

  Object.entries(dependencies).forEach(([name, dep]) => {
    if (!isFunction(dep)) {
      throw createReatomError(
        `Invalid atom dependencies (type ${typeof dep}) at ${name}`,
        dep,
      )
    }

    if (isAtom(dep)) {
      // TODO
      // if (dep.isUnique) {
      //   createReatomError()
      // }
      if (name[0] == `_`) {
        // @ts-expect-error
        atom[name] = actionCreators[name] = dep
      }
      dep.types.forEach((type) => pushUnique(types, type))
    } else {
      let type: string

      if (isActionCreator(dep)) {
        externalActions[name] = type = dep.type
      } else {
        type = `${name}_${id}`

        const actionCreator = (...a: any[]) => ({
          payload: dep(...a),
          type,
          targets: [atom],
        })
        actionCreator.type = type
        actionCreator.dispatch = (...a: any[]) =>
          store.dispatch(actionCreator(...a))

        actionCreators[name] = actionCreator

        if (name[0] != `_`) {
          // @ts-expect-error
          atom[name] = actionCreator
        }
      }

      pushUnique(trackedTypes, type)
      pushUnique(types, type)
    }
  })

  const cacheReducer = decorators.reduce(
    (acc, decorator) => decorator(acc),
    createDynamicallyTrackedCacheReducer<State, Deps>(
      reducer,
      dependencies,
      trackedTypes,
      actionCreators,
      externalActions,
    ),
  )

  function atom(
    transaction: Transaction,
    cache: CacheTemplate<State> = createTemplateCache(atom),
  ): Cache<State> {
    return cacheReducer(transaction, cache)
  }

  atom.id = id

  atom.getState = () => store.getState(atom)

  atom.subscribe = (cb: Fn) => store.subscribe(atom, cb)

  atom.types = types

  // @ts-expect-error
  return atom
}

function createDynamicallyTrackedCacheReducer<
  State,
  Deps extends Rec<PayloadMapper | Atom>,
>(
  reducer: TrackReducer<State, Deps>,
  dependencies: Deps,
  trackedTypes: Array<string>,
  actionCreators: Rec<ActionCreator | Rec<ActionCreator>>,
  externalActions: Rec<string>,
): CacheReducer<State> {
  const create: Track<Deps>[`create`] = (from: string, ...args: any[]) => {
    const [dep, name] = from.split(`.`)

    // @ts-expect-error
    const actionCreator = name ? actionCreators[dep][name] : actionCreators[dep]
    return actionCreator(...args)
  }

  return (
    { actions, process, schedule, transit }: Transaction,
    cache: CacheTemplate<State>,
  ): Cache<State> => {
    let { atom, ctx, state, listeners } = cache
    let tracks: Array<Cache> = []
    let effectCause: undefined | Cause
    let outdatedCall = noop

    const _get = (depAtom: Atom, atomCache?: Cache): Cache => {
      outdatedCall()

      const atomPatch = process(depAtom, atomCache)

      if (effectCause == undefined) {
        if (tracks.every((cache) => cache.atom.id != depAtom.id)) {
          tracks.push(atomPatch)
        }
      }

      return atomPatch
    }

    const get: Track<Deps>[`get`] = (name) =>
      _get(dependencies[name as string] as Atom).state

    const getUnlistedState: Track<Deps>[`getUnlistedState`] = (targetAtom) => {
      outdatedCall()
      return process(targetAtom).state
    }

    const onAction: Track<Deps>[`onAction`] = (from: string, reaction: Fn) => {
      outdatedCall()

      if (effectCause != undefined) {
        throw createReatomError(
          `Can not react to action inside another reaction`,
        )
      }
      let type: string
      let [dep, name] = from.split(`.`)

      if (name) {
        // @ts-expect-error
        type = dependencies[dep][name].type
      } else {
        name = dep
      }

      type =
        externalActions[name as string] ?? actionCreators[name as string]?.type

      if (type == undefined) {
        throw createReatomError(`Unknown action`, { name })
      }

      actions.forEach((action) => {
        if (type == action.type) {
          effectCause = name as string
          if (name != type) effectCause += ` (${type})`
          effectCause += ` handler (${atom.id})`
          reaction(action.payload)
          effectCause = undefined
        }
      })
    }

    const onChange: Track<Deps>[`onChange`] = (name, reaction) => {
      outdatedCall()

      if (effectCause != undefined) {
        throw createReatomError(
          `Can not react to atom changes inside another reaction`,
        )
      }

      const depAtom = dependencies[name] as Atom
      const atomCache = cache.tracks?.find(
        (cache) => cache.atom.id == depAtom.id,
      )
      const atomPatch = _get(depAtom, atomCache)

      if (
        atomCache == undefined ||
        !Object.is(atomCache.state, atomPatch.state)
      ) {
        effectCause = name as string
        if (name != depAtom.id) effectCause += ` (${depAtom.id})`
        effectCause += ` handler (${atom.id})`
        reaction(atomPatch.state, atomCache?.state)
        effectCause = undefined
      }
    }

    const onInit: Track<Deps>[`onInit`] = (cb) => {
      if (cache.tracks == undefined) {
        effectCause = 'init handler'
        cb()
        effectCause = undefined
      }
    }

    const _schedule: Track<Deps>[`schedule`] = (effect) => {
      outdatedCall()

      schedule((dispatch, causes) => effect(dispatch, ctx, causes), effectCause)
    }

    const _transit: Track<Deps>[`transit`] = (where, ...args) => {
      outdatedCall()

      const [depName, actionName] = where.split(`.`)
      const depAtom = dependencies[depName] as Atom
      // @ts-ignore
      const action = depAtom[actionName](...args)

      transit(action)
    }

    const track: Track<Deps> = {
      create,
      get,
      getUnlistedState,
      onAction,
      onChange,
      onInit,
      schedule: _schedule,
      transit: _transit,
    }

    let cause = `init`
    let shouldCallReducer =
      cache.tracks == undefined ||
      actions.some(
        ({ type }) =>
          trackedTypes.includes(type) && ((cause = `HANDLE: ${type}`), true),
      ) ||
      cache.tracks.some(
        (depCache) =>
          !Object.is(depCache.state, _get(depCache.atom, depCache).state) &&
          ((cause = `CHANGED: ${depCache.atom.id}`), true),
      )

    if (shouldCallReducer) {
      tracks.length = 0
      // @ts-expect-error
      state = reducer(track, state)
    }

    outdatedCall = () => {
      throw createReatomError(`Outdated track call`)
    }

    return { atom, cause, ctx, state: state!, tracks, listeners }
  }
}
