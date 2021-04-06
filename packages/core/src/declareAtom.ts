import {
  Atom,
  AtomCache,
  AtomUpdate,
  Computer,
  declareAction,
  defaultStore,
  F,
  invalid,
  isFunction,
  memo,
  Store,
  Track,
  Transaction,
} from './internal'

// I don't know why it work,
// but this is the single fined way
// to infer type from default value
type ComputerWithInfer<State> =
  | (($: Track) => State)
  | ((($: any) => State) & (($: any, state?: State | undefined) => any))

type ComputerWithUpdate<State> = {
  ($: Track, state: State, update: AtomUpdate<State>): State
}

let atomsCount = 0
// FIXME: update TS
// @ts-ignore
export function declareAtom<State>(
  computer: ComputerWithInfer<State>,
  id?: string,
): Atom<State>
export function declareAtom<State>(
  initialState: State,
  id?: string,
): Atom<State> & { update: AtomUpdate<State> }
export function declareAtom<State>(
  initialState: State,
  computer: ComputerWithUpdate<State>,
  id?: string,
): Atom<State>
export function declareAtom<State>(
  ...args:
    | [ComputerWithInfer<State>]
    | [ComputerWithInfer<State>, string]
    | [State]
    | [State, string]
    | [State, ComputerWithUpdate<State>]
    | [State, ComputerWithUpdate<State>, string]
): Atom<State> {
  const internalComputer: Computer<State> = ($, state = initialState) => {
    $(
      update.handle(
        value => (state = isFunction(value) ? value(state) : value),
      ),
    )
    return state
  }
  let outerComputer: ComputerWithUpdate<State> = ($, state) => state
  let initialState: State
  let id: string

  invalid(args.length < 1 || args.length > 3, 'atom arguments')

  if (isFunction(args[0])) {
    outerComputer = args[0]
    if (args.length === 2) id = args[1] as string
  } else {
    initialState = args[0]
    if (args.length > 1) {
      if (!isFunction(args[1])) {
        id = args[1] as string
      } else {
        outerComputer = args[1]

        if (args.length === 3) id = args[2]
      }
    }
  }

  const computer: Computer<State> = ($, state) =>
    outerComputer($, internalComputer($, state), update)

  id = id! || `atom [${++atomsCount}]`
  const update = declareAction<State | ((prevState: State) => State)>(
    `update of "${id}"`,
  )

  function atom(
    transaction: Transaction,
    cache?: AtomCache<State>,
  ): AtomCache<State> {
    return memo(transaction, atom, cache)
  }
  atom.computer = computer
  atom.update = update
  atom.id = id
  atom.subscribe = (cb: F<[State]>): F => defaultStore.subscribe(atom, cb)

  return atom
}
