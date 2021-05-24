import {
  AC,
  Action,
  ActionCreator,
  Atom,
  Cache,
  CacheAsArgument,
  Computer,
  createTransaction,
  declareAction,
  defaultStore,
  Fn,
  invalid,
  isAction,
  isFunction,
  isString,
  memo,
  Merge,
  NotFn,
  Rec,
  Store,
  Track,
  Transaction,
  Unsubscribe,
} from './internal'

export type AtomOptions<State, Ctx extends Rec> =
  | Atom['id']
  | {
      createCtx?: () => Ctx
      id?: Atom['id']
      onChange?: (
        oldState: State | undefined,
        state: State,
        store: Store,
        ctx: Ctx,
      ) => any
      // TODO: extra options?
      // memo: Memo<State, Ctx>
      // toJSON?: Fn
    }

export type AtomMethod<State = any, Payload = any> = (
  payload: Payload,
  state: State,
) => State

export type ActionCreatorsMethods<Methods extends Rec<AtomMethod<any>>> = {
  [K in keyof Methods]: Methods[K] extends (
    payload: infer Payload,
    state: any,
  ) => any
    ? ActionCreator<[payload: Payload]>
    : never
}

export type DumbAtomMethods<State> = {
  update: AtomMethod<State, State | ((prevState: State) => State)>
}

export type DumbAtom<State> = Atom<State> & DumbAtomMethods<State>

let atomsCount = 0
export function declareAtom<
  State,
  Ctx extends Rec,
  Methods extends Rec<AtomMethod<State>>,
>(
  computer: ($: Track<unknown, Ctx>) => State,
  methods?: Methods,
  options?: AtomOptions<State, Ctx>,
): Atom<State> & Merge<ActionCreatorsMethods<Methods>>
export function declareAtom<
  State,
  Ctx extends Rec,
  Methods extends Rec<AtomMethod<State>> | undefined,
>(
  initState: NotFn<State>,
  methods?: Methods,
  options?: AtomOptions<State, Ctx>,
): Atom<State> &
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
  initialStateOrComputer: NotFn<State> | (($: Track<any, Ctx>) => State),
  methods: Methods = {} as Methods,
  options: AtomOptions<State, Ctx> = {},
): Atom<State> & Merge<ActionCreatorsMethods<Methods>> {
  options = isString(options) ? { id: options } : options

  const {
    createCtx = () => ({} as Ctx),
    id = `atom [${++atomsCount}]`,
    onChange,
  } = options

  let userComputer = initialStateOrComputer as Computer<State, Ctx>
  if (isFunction(initialStateOrComputer)) {
  } else {
    if (/* TODO: `process.env.NODE_ENV === 'development'` */ true) {
      invalid(Object.keys(methods).length > 0, `methods of dumb atom`)
    }

    // @ts-expect-error
    methods.update = (payload: State | Fn<[State], State>, state: State) =>
      isFunction(payload) ? payload(state) : payload

    userComputer = ($, state = initialStateOrComputer) => state
  }

  const methodsKeys = Object.keys(methods)
  const actionCreators: Rec<AC> = {}

  methodsKeys.forEach(
    (k) =>
      // @ts-expect-error
      (atom[k] = actionCreators[k] =
        declareAction(
          (payload: any) => ({
            payload,
            targets: [atom],
          }),
          `${k} of "${id}"`,
        )),
  )

  const computer: Computer<State, Ctx> = ($, state) =>
    methodsKeys.reduce((state, k) => {
      $(actionCreators[k], (payload) => (state = methods[k](payload, state)))
      return state
    }, userComputer($, state))

  if (/* TODO: `process.env.NODE_ENV === 'development'` */ true) {
    invalid(
      initialStateOrComputer === undefined ||
        !isFunction(userComputer) ||
        !isString(id) ||
        !isFunction(createCtx) ||
        !Object.values(methods).every(isFunction),
      `atom arguments`,
    )
  }

  function atom(
    action: Transaction | Array<Action> | Action,
    cache: CacheAsArgument<State> = {
      deps: [],
      ctx: undefined,
      state: undefined,
      types: new Set(),
    },
  ): Cache<State> {
    const transaction = Array.isArray(action)
      ? createTransaction(action)
      : isAction(action)
      ? createTransaction([action])
      : action

    if (cache.ctx === undefined) cache.ctx = createCtx()

    const patch = memo(transaction, cache as Cache<State>, computer)

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

  // @ts-expect-error
  return atom
}
