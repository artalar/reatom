import {
  ActionCreatorBinded,
  AtomBinded,
  AtomId,
  Cache,
  CacheTemplate,
  createTemplateCache,
  createActionCreator,
  defaultStore,
  Fn,
  invalid,
  isFunction,
  isString,
  memo,
  Rec,
  TrackedReducer,
  Transaction,
  Unsubscribe,
} from './internal'

export type AtomOptions<State = any> = {
  id?: AtomId
  // TODO(?)
  // toSnapshot: Fn
  // fromSnapshot: Fn
}

export type AtomSelfBinded<
  State = any,
  ActionPayloadCreators extends Rec<Fn> = {},
> = AtomBinded<State> &
  {
    [K in keyof ActionPayloadCreators]: ActionCreatorBinded<
      Parameters<ActionPayloadCreators[K]>,
      { payload: ReturnType<ActionPayloadCreators[K]> }
    >
  }

let atomsCount = 0
export function createAtom<State, ActionPayloadCreators extends Rec<Fn> = {}>(
  /**
   * Collection of named action payload creators
   * which will the part of the created atom
   * and always be handled by it.
   */
  actions: ActionPayloadCreators,
  reducer: TrackedReducer<State, ActionPayloadCreators>,
  options: AtomOptions<State> = {},
): AtomSelfBinded<State, ActionPayloadCreators> {
  const { id = `atom [${++atomsCount}]` } = options

  invalid(
    !isFunction(reducer) ||
      !Object.values(actions).every(isFunction) ||
      !isString(id),
    `atom arguments`,
  )

  const targets = [atom]
  const actionCreators = Object.keys(actions).reduce((acc, name) => {
    const payloadCreator = actions[name]

    acc[name] = createActionCreator(
      (...a: any[]) => ({ payload: payloadCreator(...a), targets }),
      `${id} - ${name}`,
    )

    return acc
  }, {} as Rec<Fn>)

  function atom(
    transaction: Transaction,
    cache: CacheTemplate<State> = createTemplateCache(atom),
  ): Cache<State> {
    const patch = memo(transaction, cache as Cache<State>, reducer)

    return patch
  }

  atom.id = id

  atom.getState = (): State => defaultStore.getState(atom)

  atom.subscribe = (cb: Fn<[State]>): Unsubscribe =>
    defaultStore.subscribe(atom, cb)

  return Object.assign(atom, actionCreators) as any
}
