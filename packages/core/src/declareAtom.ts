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
  isFunction,
  isString,
  memo,
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
  | (($: Track) => State)
  | ((($: any) => State) & (($: any, state?: State | undefined) => any))

type ComputerWithUpdate<State> = {
  ($: Track, state: State, update: DumbAtom<State>): State
}

type Reducer<State = any, Payload = any, Ctx extends Rec = Rec> = Fn<
  [Payload, State],
  State | Effect<Ctx>
>

type InferActionsReducers<ActionsReducers extends Rec<Reducer<any, any, any>>> =
  {
    [K in keyof ActionsReducers]: ActionsReducers[K] extends Reducer<
      any,
      infer T,
      any
    >
      ? ActionCreator<[T]>
      : never
  }

export type DumbAtom<State> = Atom<State> & {
  update: ActionCreator<[State | ((prevState: State) => State)]>
}

let atomsCount = 0
// @ts-expect-error
export function declareAtom<State>(
  initialState: NotFn<State>,
  id?: string,
): DumbAtom<State>
export function declareAtom<
  State,
  Ctx extends Rec = {},
  ActionsReducers extends Rec<Reducer<State, any, Ctx>> = {},
>(
  initialStateOrComputer: ComputerWithInfer<State> | NotFn<State>,
  options:
    | string
    | {
        id?: string
        ctx?: () => Ctx
        methods?: ActionsReducers
      } = {},
): Atom<State> & InferActionsReducers<ActionsReducers> {
  const actionCreators: Rec<ActionCreator> = {}

  const {
    id = `atom [${++atomsCount}]`,
    ctx = () => ({} as Ctx),
    methods = {} as Rec<Reducer<State, any, Ctx>>,
  } = isString(options)
    ? ({ id: options } as Exclude<typeof options, string>)
    : options

  const userComputer: Computer<State, Ctx> = isFunction(initialStateOrComputer)
    ? initialStateOrComputer
    : ($, state = initialStateOrComputer) => state

  const computer: Computer<State, Ctx> = ($, state) => {
    state = userComputer($, state)

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
    userComputer !== initialStateOrComputer &&
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
    cache: CacheAsArgument<State, Ctx>,
  ): Cache<State, Ctx> {
    if (cache.ctx === undefined) cache.ctx = ctx()

    return memo(transaction, cache as Cache<State, Ctx>, computer)
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
