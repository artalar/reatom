import {
  AC,
  ActionCreator,
  Atom,
  Cache,
  CacheAsArgument,
  Computer,
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

export type AtomMethod<State> = (payload: any, state: State) => State

export type ActionCreatorsMethods<Methods extends Rec<AtomMethod<any>>> = {
  [K in keyof Methods]: Methods[K] extends (
    payload: infer Payload,
    state: any,
  ) => any
    ? AC<Payload>
    : never
}

export type DumbAtom<State> = Atom<State> & {
  update: ActionCreator<[State | ((prevState: State) => State)]>
}

let atomsCount = 0
export function declareAtom<
  State,
  Ctx extends Rec,
  Methods extends Rec<AtomMethod<State>>,
>(
  computer: ($: Track<any, Ctx>) => State,
  options?: AtomOptions<State, Ctx>,
  methods?: Methods,
): Atom<State, Ctx> & Merge<ActionCreatorsMethods<Methods>>
export function declareAtom<State>(
  initState: NotFn<State>,
  id?: string,
): DumbAtom<State>
export function declareAtom<
  State,
  Ctx extends Rec,
  Methods extends Rec<AtomMethod<State>>,
>(
  initialStateOrComputer: NotFn<State> | (($: Track<any, Ctx>) => State),
  options: AtomOptions<State, Ctx> = {},
  methods: Methods = {} as Methods,
): Atom<State, Ctx> & DumbAtom<State> & Merge<ActionCreatorsMethods<Methods>> {
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
    transaction: Transaction,
    cache: CacheAsArgument<State, Ctx> = {
      deps: [],
      ctx: createCtx(),
      state: undefined,
      types: new Set(),
    },
  ): Cache<State, Ctx> {
    if (cache.ctx === undefined) cache.ctx = createCtx()

    const patch = memo(transaction, cache as Cache<State, Ctx>, computer)

    if (onChange !== undefined && !Object.is(patch.state, cache.state)) {
      transaction.effects.push((store) =>
        onChange(cache.state, patch.state, store, patch.ctx),
      )
    }

    return patch
  }

  atom.id = id

  atom.init = (): Unsubscribe => defaultStore.init(atom)

  atom.getState = (): State => defaultStore.getState(atom)

  atom.subscribe = (cb: Fn<[State]>): Unsubscribe =>
    defaultStore.subscribe(atom, cb)

  // FIXME:
  // @ts-expect-error
  return atom
}
