import {
  Action,
  Atom,
  AtomCache,
  ComputerReducer,
  createActionCreator,
  createMemo,
  createPatch,
  KIND,
} from './internal'

export function declareAtom<State>(
  computer: ComputerReducer<State>,
): Atom<State> {
  function atom(action: Action, state?: State): AtomCache<State> {
    return (
      action.memo ??
      createMemo({
        action,
        cache: new WeakMap().set(
          atom,
          createPatch({
            deps: [createActionCreator(action.type)],
            state,
            types: new Set<string>().add(action.type),
          }),
        ),
        patch: new Map(),
      })
    )(atom)
  }
  atom[KIND] = 'atom' as const
  atom.computer = computer

  return atom
}
