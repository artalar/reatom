import {
  Atom,
  AtomCache,
  AtomUpdate,
  Computer,
  declareAction,
  invalid,
  isFunction,
  memo as defaultMemo,
  Memo,
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

export type AtomOptions = { displayName?: string; memo?: Memo }

let atomsCount = 0
// FIXME: update TS
// @ts-ignore
export function declareAtom<State>(
  computer: ComputerWithInfer<State>,
  options?: AtomOptions,
): Atom<State>
export function declareAtom<State>(
  initialState: State,
  options?: AtomOptions,
): Atom<State> & { update: AtomUpdate<State> }
export function declareAtom<State>(
  initialState: State,
  computer: ComputerWithUpdate<State>,
  options?: AtomOptions,
): Atom<State>
export function declareAtom<State>(
  ...args:
    | [ComputerWithInfer<State>]
    | [ComputerWithInfer<State>, AtomOptions]
    | [State]
    | [State, AtomOptions]
    | [State, ComputerWithUpdate<State>]
    | [State, ComputerWithUpdate<State>, AtomOptions]
): Atom<State> {
  let initialState: State
  let computer: Computer<State>
  let options: AtomOptions = {}

  invalid(args.length < 1 || args.length > 3, 'atom arguments')

  if (isFunction(args[0])) {
    computer = args[0]
    if (args.length === 2) options = args[1] as AtomOptions
  } else {
    initialState = args[0]
    computer = ($, state = initialState) => {
      $(
        update.handle(
          value => (state = isFunction(value) ? value(state) : value),
        ),
      )
      return state
    }
    if (args.length > 1) {
      if (!isFunction(args[1])) {
        options = args[1] as AtomOptions
      } else {
        const internalComputer = computer
        const outerComputer = args[1]
        computer = ($, state) =>
          outerComputer($, internalComputer($, state), update)

        if (args.length === 3) options = args[2]
      }
    }
  }

  const { displayName = `atom [${++atomsCount}]`, memo = defaultMemo } = options
  const update = declareAction(
    (payload: State | ((prevState: State) => State)) => ({ payload }),
    { type: `update of "${displayName}"` },
  )

  function atom(
    transaction: Transaction,
    cache?: AtomCache<State>,
  ): AtomCache<State> {
    return memo(transaction, atom, cache)
  }
  atom.computer = computer
  atom.update = update
  atom.displayName = displayName

  return atom
}
