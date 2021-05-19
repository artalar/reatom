import {
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
  NotFn,
  Track,
  Transaction,
  Unsubscribe,
} from './internal'
import { Rec } from './types'

export type AtomOptions<State, Ctx extends Rec> =
  | Atom['id']
  | {
      id?: Atom['id']
      ctx?: () => Ctx
      // TODO: extra options?
      // memo: Memo<State, Ctx>
      // onChange: (newState: State, state: State) => Effect<Ctx>
      // toJSON?: Fn
    }

export type DumbAtom<State> = Atom<State> & {
  update: ActionCreator<[State | ((prevState: State) => State)]>
}

let atomsCount = 0
export function declareAtom<State, Ctx extends Rec = Rec>(
  computer: ($: Track<any, Ctx>) => State,
  options?: AtomOptions<State, Ctx>,
): Atom<State, Ctx>
export function declareAtom<State>(
  initState: NotFn<State>,
  id?: string,
): DumbAtom<State>
export function declareAtom<State, Ctx extends Rec = Rec>(
  initialStateOrComputer: NotFn<State> | (($: Track<any, Ctx>) => State),
  options: AtomOptions<State, Ctx> = {},
): Atom<State, Ctx> & DumbAtom<State> {
  options = isString(options) ? { id: options } : options

  const { id = `atom [${++atomsCount}]`, ctx = () => ({} as Ctx) } = options

  let computer = initialStateOrComputer as Computer<State, Ctx>
  if (!isFunction(initialStateOrComputer)) {
    const update = (atom.update = declareAction<State | Fn<[State], State>>(
      `update of "${id}"`,
    ))

    computer = ($, state = initialStateOrComputer) => {
      $(update, (payload: NotFn<State>) => {
        state = isFunction(payload) ? payload(state) : payload
      })

      return state
    }
  }

  if (/* TODO: `process.env.NODE_ENV === 'development'` */ true) {
    invalid(
      initialStateOrComputer === undefined ||
        !isFunction(computer) ||
        !isString(id) ||
        !isFunction(ctx),
      `atom arguments`,
    )
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
