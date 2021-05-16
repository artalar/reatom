import {
  ActionCreator,
  Atom,
  Cache,
  CacheAsArgument,
  Computer,
  declareAction,
  defaultStore,
  Effect,
  Fn,
  invalid,
  isFunction,
  isObject,
  isString,
  memo,
  Merge,
  NotFn,
  Track,
  Transaction,
  Unsubscribe,
} from './internal'
import { Rec } from './types'

// I don't know why it work,
// but this is the single fined way
// to infer type from default value
type ComputerWithInfer<State> =
  | (($: Track<any, any>) => State)
  | ((($: any) => State) & (($: any, state?: State | undefined) => any))

type Reducer<State = any, Payload = any, Ctx extends Rec = Rec> = Fn<
  [Payload, State],
  State | Effect<Ctx>
>

type InferMethods<Methods extends Rec<Reducer<any, any, any>>> = {
  [K in keyof Methods]: Methods[K] extends Reducer<any, infer T, any>
    ? ActionCreator<[T]>
    : never
}

export type DumbAtom<State> = Atom<State> & {
  update: ActionCreator<[State | ((prevState: State) => State)]>
}

let atomsCount = 0
export function declareAtom<State>(
  computer: ComputerWithInfer<State>,
  options?: { id?: string },
): Atom<State>
// @ts-expect-error
export function declareAtom<State>(
  initialState: NotFn<State>,
  options?: { id?: string },
): DumbAtom<State>
export function declareAtom<
  State,
  Ctx extends Rec,
  Methods extends Rec<Reducer<State, any, Ctx>>,
>(
  initialState: NotFn<State>,
  options?: {
    id?: string
    ctx?: () => Ctx
    methods?: Methods
    computer?: Computer<State, Ctx>
  },
): Atom<State, Ctx> & Merge<InferMethods<Methods>>
export function declareAtom<
  State,
  Ctx extends Rec,
  Methods extends Rec<Reducer<State, any, Ctx>>,
>(
  initialStateOrComputer: ComputerWithInfer<State> | NotFn<State>,
  options: {
    id?: string
    ctx?: () => Ctx
    methods?: Methods
    computer?: Computer<State, Ctx>
  } = {},
): Atom<State, Ctx> & Merge<InferMethods<Methods>> {
  const actionCreators: Rec<ActionCreator> = {}

  const {
    id = `atom [${++atomsCount}]`,
    ctx = () => ({} as Ctx),
    methods = {} as Rec<Reducer<State, any, Ctx>>,
    computer = isFunction(initialStateOrComputer)
      ? initialStateOrComputer
      : ($, state = initialStateOrComputer) => state,
  } = options

  if (/* TODO: `process.env.NODE_ENV === 'development'` */ true) {
    invalid(
      !isString(id) ||
        !isFunction(ctx) ||
        !isObject(methods) ||
        !Object.keys(methods).every(isFunction) ||
        !isFunction(computer) ||
        (isFunction(initialStateOrComputer) && isFunction(options.computer)),
      `atom arguments`,
    )
  }

  const internalComputer: Computer<State, Ctx> = ($, state) => {
    state = computer($, state)

    for (const k in actionCreators) {
      $(actionCreators[k], (payload) => {
        const effect = methods[k](payload, state)
        if (isFunction(effect)) return effect
        state = effect
      })
    }

    return state
  }

  if (
    !options.computer &&
    computer !== initialStateOrComputer &&
    Object.keys(methods).length === 0
  ) {
    methods.update = (payload: State | ((prevState: State) => State), state) =>
      isFunction(payload) ? payload(state) : payload
  }

  for (const k in methods) {
    // FIXME:
    // @ts-expect-error
    atom[k] = actionCreators[k] = declareAction(`${k} of "${id}"`)
  }

  function atom(
    transaction: Transaction,
    cache: CacheAsArgument<State, Ctx> = {
      deps: [],
      ctx: ctx(),
      state: undefined,
      types: new Set(),
    },
  ): Cache<State, Ctx> {
    if (cache.ctx === undefined) cache.ctx = ctx()

    return memo(transaction, cache as Cache<State, Ctx>, internalComputer)
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
