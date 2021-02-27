import {
  Action,
  createMemo,
  F,
  IAction,
  IActionCreator,
  IAtom,
  IAtomCache,
  isFunction,
  ITrack,
  KIND,
} from './internal'

// Don't know how why work
// but it the single fined way to infer type from default value of second argument of an computer
type _IComputer<State = any> =
  | (($: ITrack) => State)
  | ((($: any) => State) & (($: any, a?: State) => any))

let atomsCount = 0
export function Atom<State>(computer: _IComputer<State>): IAtom<State> {
  function atom(action: IAction, state?: State): IAtomCache<State> {
    return (
      action.memo ??
      createMemo({
        actions: [action],
        cache: new WeakMap(),
        patch: new Map(),
      })
    )(atom)
  }
  atom.displayName = `atom [№${++atomsCount}]`
  atom.computer = computer
  atom[KIND] = 'atom' as const

  return atom
}

Atom.from = <State>(
  defaultState: State,
): IAtom<State> & {
  update: IActionCreator<State | ((prevState: State) => State)>
} => {
  const update = Action<State | ((prevState: State) => State)>()
  return Object.assign(
    Atom(($, state = defaultState) => {
      $(
        update,
        value => (state = isFunction(value) ? (value as F)(state) : value),
      )
      return state
    }),
    { update },
  )
}
