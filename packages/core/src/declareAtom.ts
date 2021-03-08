import {
  ActionCreator,
  Atom,
  AtomCache,
  declareAction,
  isFunction,
  memo as defaultMemo,
  Memo,
  Track,
  Transaction,
} from './internal'

// Don't know how why work
// but it the single fined way to infer type from default value of second argument of an computer
type _Computer<State = any> =
  | (($: Track) => State)
  | ((($: any) => State) & (($: any, state?: State | undefined) => any))

let atomsCount = 0
export function declareAtom<State>(
  computer: _Computer<State>,
  {
    displayName = `atom [${++atomsCount}]`,
    memo = defaultMemo,
  }: { displayName?: string; memo?: Memo } = {},
): Atom<State> {
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

declareAtom.from = <State>(
  defaultState: State,
  options?: { displayName?: string; memo?: Memo },
): Atom<State> & {
  update: ActionCreator<[State | ((prevState: State) => State)]>
} => {
  const update = declareAction<State | ((prevState: State) => State)>()
  return Object.assign(
    declareAtom(function($, state = defaultState) {
      $(
        update.handle(
          value => (state = isFunction(value) ? value(state) : value),
        ),
      )
      return state
    }, options),
    { update },
  )
}
