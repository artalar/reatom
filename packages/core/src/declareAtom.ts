import {
  ActionCreatorBinded,
  Atom,
  AtomBinded,
  AtomId,
  Cache,
  createTemplateCache,
  declareAction,
  defaultStore,
  Fn,
  invalid,
  isFunction,
  isString,
  memo,
  Rec,
  Reducer,
  Transaction,
  Unsubscribe,
} from './internal'

export type AtomOptions<State = any, Ctx extends Rec = Rec> = {
  /** Create mutable object for storing effects data. */
  createCtx?: () => Ctx
  id?: AtomId
  toSnapshot?: Cache<State>['toSnapshot']
}

export type DeclaredAtom<
  State,
  ActionPayloadCreators extends Rec<Fn>,
> = AtomBinded<State> &
  {
    [K in keyof ActionPayloadCreators]: ActionCreatorBinded<
      Parameters<ActionPayloadCreators[K]>,
      { payload: ReturnType<ActionPayloadCreators[K]>; targets: [Atom] }
    >
  }

let atomsCount = 0
export function declareAtom<
  State,
  Ctx extends Rec = Rec<unknown>,
  ActionPayloadCreators extends Rec<Fn> = {},
>(
  /**
   * Collection of named action payload creators
   * which will the part of the created atom
   * and always be handled by it.
   */
  actions: ActionPayloadCreators,
  reducer: Reducer<State, Ctx>,
  options: AtomOptions<State, Ctx> = {},
): DeclaredAtom<State, ActionPayloadCreators> {
  const {
    createCtx = () => ({} as Ctx),
    id = `atom [${++atomsCount}]`,
    toSnapshot = function toSnapshot(this: Cache) {
      return this.state
    },
  } = options

  invalid(
    !isFunction(reducer) ||
      !Object.values(actions).every(isFunction) ||
      !isFunction(createCtx) ||
      !isString(id) ||
      !isFunction(toSnapshot),
    `atom arguments`,
  )

  const targets = [atom]
  const actionCreators = Object.keys(actions).reduce((acc, k) => {
    const type = `${k} of "${id}"`
    const payloadCreator = actions[k]

    acc[k] = declareAction(
      (...a: any[]) => ({ payload: payloadCreator(...a), targets }),
      type,
    )

    return acc
  }, {} as Rec<Fn>)

  function atom(
    transaction: Transaction,
    cache = createTemplateCache<State>(),
  ): Cache<State> {
    if (cache.ctx === undefined) {
      cache.ctx = createCtx()
      cache.toSnapshot = toSnapshot
    }

    const patch = memo(transaction, cache as Cache<State>, reducer)

    return patch
  }

  atom.id = id

  atom.getState = (): State => defaultStore.getState(atom)

  atom.subscribe = (cb: Fn<[State]>): Unsubscribe =>
    defaultStore.subscribe(atom, cb)

  return Object.assign(atom, actionCreators) as any
}
