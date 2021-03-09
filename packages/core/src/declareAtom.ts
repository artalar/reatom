import {
  ActionCreator,
  Atom,
  AtomCache,
  Computer,
  declareAction,
  invalid,
  isFunction,
  memo as defaultMemo,
  Memo,
  Track,
  Transaction,
} from './internal'

// Don't know why work
// but it the single fined way to infer type from default value of second argument of an computer
type ComputerWithInfer<State> =
  | (($: Track) => State)
  | ((($: any) => State) & (($: any, state?: State | undefined) => any))

type ComputerWithUpdate<State> = {
  ($: Track, state: State, update: AtomUpdate<State>): State
}

type AtomUpdate<State> = ActionCreator<[State | ((prevState: State) => State)]>

export type AtomOptions = { displayName?: string; memo?: Memo }

let atomsCount = 0
// FIXME:
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
  ...a:
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

  invalid((a.length as number) === 0 || a.length > 3, 'atom arguments')

  if (isFunction(a[0])) {
    computer = a[0]
    if (a.length === 2) options = a[1] as AtomOptions
  } else {
    initialState = a[0]
    computer = ($, state = initialState) => {
      $(
        update.handle(
          value => (state = isFunction(value) ? value(state) : value),
        ),
      )
      return state
    }
    if (a.length > 1 && isFunction(a[1])) {
      const _computer = computer
      const computerWithUpdate = a[1]
      computer = ($, state) =>
        computerWithUpdate($, _computer($, state), update)
    }
    if (a.length === 2 && !isFunction(a[1])) options = a[1] as AtomOptions
    if (a.length === 3) options = a[2]
  }

  const { displayName = `atom [${++atomsCount}]`, memo = defaultMemo } = options
  const update = declareAction<State | ((prevState: State) => State)>()

  function atom(
    transaction: Transaction,
    cache?: AtomCache<State>,
  ): AtomCache<State> {
    return memo(transaction, atom, cache)
  }
  atom.computer = computer
  atom.displayName = displayName

  return atom
}
