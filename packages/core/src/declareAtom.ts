import {
  ActionCreatorBinded,
  AtomBinded,
  AtomId,
  Cache,
  CacheTemplate,
  declareAction,
  defaultStore,
  Fn,
  invalid,
  isFunction,
  isString,
  memo,
  Merge,
  NotFn,
  Rec,
  Reducer,
  Store,
  Track,
  Transaction,
  Unsubscribe,
} from './internal'

export type AtomOptions<State, Ctx extends Rec> =
  | AtomId
  | {
      createCtx?: () => Ctx
      id?: AtomId
      onChange?: (
        oldState: State | undefined,
        state: State,
        store: Store,
        ctx: Ctx,
      ) => any
      // TODO: extra options?
      // memo?: Memo<State, Ctx>
      // toJSON?: Fn
    }

export type AtomMethod<State = any, Payload = any> = (
  payload: Payload,
  state: State,
) => State

export type ActionCreatorsMethods<Methods extends Rec<AtomMethod<any>>> = {
  [K in keyof Methods]: Methods[K] extends Fn<[infer Payload, any]>
    ? ActionCreatorBinded<[payload: Payload]>
    : never
}

export type DumbAtomMethods<State> = {
  update: AtomMethod<State, State | ((prevState: State) => State)>
}

export type DumbAtom<State> = AtomBinded<State> & DumbAtomMethods<State>

let atomsCount = 0
export function declareAtom<
  State,
  Ctx extends Rec,
  Methods extends Rec<AtomMethod<State>>,
>(
  reducer: ($: Track<unknown, Ctx>) => State,
  methods?: Methods,
  options?: AtomOptions<State, Ctx>,
): AtomBinded<State> & Merge<ActionCreatorsMethods<Methods>>
export function declareAtom<
  State,
  Ctx extends Rec,
  Methods extends Rec<AtomMethod<State>> | undefined,
>(
  initState: NotFn<State>,
  methods?: Methods,
  options?: AtomOptions<State, Ctx>,
): AtomBinded<State> &
  Merge<
    ActionCreatorsMethods<
      Methods extends undefined ? DumbAtomMethods<State> : Methods
    >
  >
export function declareAtom<
  State,
  Ctx extends Rec,
  Methods extends Rec<AtomMethod<State>>,
>(
  initialStateOrReducer: NotFn<State> | (($: Track<unknown, Ctx>) => State),
  methods: Methods = {} as Methods,
  options: AtomOptions<State, Ctx> = {},
): AtomBinded<State> {
  options = isString(options) ? { id: options } : options

  const {
    createCtx = () => ({} as Ctx),
    id = `atom [${++atomsCount}]`,
    onChange,
  } = options

  let userReducer = initialStateOrReducer as Reducer<State, Ctx>
  if (!isFunction(initialStateOrReducer)) {
    userReducer = ($, state = initialStateOrReducer) => state

    if (Object.keys(methods).length === 0) {
      // @ts-expect-error
      methods.update = (payload: State | Fn<[State], State>, state: State) =>
        isFunction(payload) ? payload(state) : payload
    }
  }

  const targets = [atom]
  const methodsDecoupled = Object.keys(methods).map((k) => ({
    reducer: methods[k],
    // @ts-expect-error
    actionCreator: (atom[k] = declareAction(
      (payload: any) => ({ payload, targets }),
      `${k} of "${id}"`,
    )),
  }))

  const reducer: Reducer<State, Ctx> = ($, state) =>
    methodsDecoupled.reduce((state, { reducer, actionCreator }) => {
      $(actionCreator, (payload) => (state = reducer(payload, state)))
      return state
    }, userReducer($, state))

  invalid(
    initialStateOrReducer === undefined ||
      !isFunction(userReducer) ||
      !isString(id) ||
      !isFunction(createCtx) ||
      !Object.values(methods).every(isFunction),
    `atom arguments`,
  )

  function atom(
    transaction: Transaction,
    cache: CacheTemplate<State> = {
      deps: [],
      ctx: undefined,
      state: undefined,
      types: [],
    },
  ): Cache<State> {
    if (cache.ctx === undefined) cache.ctx = createCtx()

    const patch = memo(transaction, cache as Cache<State>, reducer)

    if (onChange !== undefined && !Object.is(patch.state, cache.state)) {
      transaction.effects.push((store) =>
        onChange(cache.state, patch.state, store, patch.ctx as Ctx),
      )
    }

    return patch
  }

  atom.id = id

  atom.init = (): Unsubscribe => defaultStore.init(atom)

  atom.getState = (): State => defaultStore.getState(atom)

  atom.subscribe = (cb: Fn<[State]>): Unsubscribe =>
    defaultStore.subscribe(atom, cb)

  return atom
}
