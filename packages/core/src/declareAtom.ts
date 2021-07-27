import {
  ActionCreatorBinded,
  Atom,
  AtomBinded,
  AtomId,
  Cache,
  CacheTemplate,
  createTemplateCache,
  declareAction,
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
  Values,
} from './internal'

export type AtomOptions<State = any> = {
  id?: AtomId
  // TODO(?)
  // toSnapshot: Fn
  // fromSnapshot: Fn
}

export type DeclaredAtom<
  State = any,
  ActionPayloadCreators extends Rec<Fn> = {},
> = AtomBinded<State> &
  {
    [K in keyof ActionPayloadCreators]: ActionCreatorBinded<
      Parameters<ActionPayloadCreators[K]>,
      {
        // All self actions use the same type literal for performance reasons
        // AND to complicate subscribing to thats actions coz it not preferred codestyle
        // (coz of `targets` behavior and so on)
        payload: Values<
          {
            [K in keyof ActionPayloadCreators]: {
              data: ReturnType<ActionPayloadCreators[K]>
              name: K
            }
          }
        >
        name: K
      }
    >
  }

let atomsCount = 0
export function declareAtom<State, ActionPayloadCreators extends Rec<Fn> = {}>(
  /**
   * Collection of named action payload creators
   * which will the part of the created atom
   * and always be handled by it.
   */
  actions: ActionPayloadCreators,
  reducer: TrackedReducer<State, ActionPayloadCreators>,
  options: AtomOptions<State> = {},
): DeclaredAtom<State, ActionPayloadCreators> {
  const { id = `atom [${++atomsCount}]` } = options

  invalid(
    !isFunction(reducer) ||
      !Object.values(actions).every(isFunction) ||
      !isString(id),
    `atom arguments`,
  )

  const targets = [atom]
  const selfActionType = `"${id}" self action`
  const actionCreators = Object.keys(actions).reduce((acc, name) => {
    const payloadCreator = actions[name]

    acc[name] = declareAction(
      (...a: any[]) => ({
        payload: { data: payloadCreator(...a), name },
        targets,
      }),
      selfActionType,
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
