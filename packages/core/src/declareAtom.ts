import { Tree, State, TreeId, Ctx, createCtx } from './kernel'
import {
  TREE,
  nameToId,
  NonUndefined,
  Unit,
  throwError,
  getTree,
  safetyFunc,
  getIsAction,
  assign,
} from './shared'
import { Action, declareAction, PayloadActionCreator } from './declareAction'

const DEPS = Symbol('@@Reatom/DEPS')

// action for set initialState of each atom to global state
const initActionCreator = declareAction(['@@Reatom/init'])
export const initAction = initActionCreator()

type AtomName = string | [TreeId] | symbol
type AtomsMap = { [key: string]: Atom<any> }
type Reducer<TState, TValue> = (state: TState, value: TValue) => TState
type DependencyMatcher<TState> = (
  on: <T>(
    dependency: Atom<T> | PayloadActionCreator<T>,
    reducer: Reducer<TState, T>,
  ) => void,
) => any

export interface Atom<T> extends Unit {
  (state?: State, action?: Action<any>): Record<string, T | any>
  [DEPS]: Set<TreeId>
}

export function declareAtom<TState>(
  initialState: TState,
  dependencyMatcher: DependencyMatcher<TState>,
): Atom<TState>
export function declareAtom<TState>(
  name: AtomName,
  initialState: TState,
  dependencyMatcher: DependencyMatcher<TState>,
): Atom<TState>
export function declareAtom<TState>(
  name: AtomName | TState,
  initialState: TState | DependencyMatcher<TState>,
  dependencyMatcher?: DependencyMatcher<TState>,
): Atom<TState> {
  if (!dependencyMatcher) {
    dependencyMatcher = initialState as DependencyMatcher<TState>
    initialState = name as TState
    name = 'atom'
  }

  const _id = nameToId(name as AtomName)

  if (initialState === undefined)
    throwError(`Atom "${_id}". Initial state can't be undefined`)

  const _tree = new Tree(_id)
  const _deps = new Set<TreeId>()
  // start from `0` for missing `actionDefault`
  let dependencePosition = 0
  let initialPhase = true

  function on<T>(
    dep: Unit | PayloadActionCreator<T>,
    reducer: Reducer<TState, T>,
  ) {
    if (!initialPhase)
      throwError("Can't define dependencies after atom initialization")

    safetyFunc(reducer, 'reducer')

    const position = dependencePosition++
    const depTree = getTree(dep as Unit)!
    if (!depTree) throwError('Invalid dependency')
    const depId = depTree.id

    const isDepActionCreator = getIsAction(dep)

    _tree.union(depTree)

    const update = function update({
      state,
      stateNew,
      payload,
      changedIds,
      type,
    }: Ctx) {
      const atomStateSnapshot = state[_id]
      // first `walk` of lazy (dynamically added by subscription) atom
      const isAtomLazy = atomStateSnapshot === undefined

      if (!isAtomLazy && type === initAction.type && !payload) return

      const atomStatePreviousReducer = stateNew[_id]
      // it is mean atom has more than one dependencies
      // that depended from dispatched action
      // and one of the atom reducers already processed
      const hasAtomNewState = atomStatePreviousReducer !== undefined
      const atomState = (hasAtomNewState
        ? atomStatePreviousReducer
        : atomStateSnapshot) as TState

      const depStateSnapshot = state[depId]
      const depStateNew = stateNew[depId]
      const isDepChanged = depStateNew !== undefined
      const depState = isDepChanged ? depStateNew : depStateSnapshot
      const depValue = isDepActionCreator ? payload : depState

      if (isDepActionCreator || isDepChanged || isAtomLazy) {
        const atomStateNew = reducer(atomState, depValue)

        if (atomStateNew === undefined)
          throwError(
            `Invalid state. Reducer № ${position} in "${_id}" atom returns undefined`,
          )

        if (atomStateNew !== atomState && !hasAtomNewState) changedIds.push(_id)
        stateNew[_id] = atomStateNew
      }
    }
    update._ownerAtomId = _id

    if (isDepActionCreator) return _tree.addFn(update, depId)
    if (_deps.has(depId)) throwError('One of dependencies has the equal id')
    _deps.add(depId)
    depTree.fnsMap.forEach((_, key) => _tree.addFn(update, key))
  }

  // @ts-ignore
  on(initActionCreator, (_, { [_id]: state = initialState } = {}) => state)
  dependencyMatcher(on)

  const atom = function atom(
    state: State = {},
    action: Action<any> = initAction,
  ) {
    const ctx = createCtx(state, action)
    _tree.forEach(action.type, ctx)

    const { changedIds, stateNew } = ctx

    return changedIds.length > 0 ? assign({}, state, stateNew) : state
  } as Atom<TState>

  atom[TREE] = _tree
  atom[DEPS] = _deps

  return atom
}

export function getState<T>(state: State, atom: Atom<T>): T | undefined {
  return state[atom[TREE].id] as T | undefined
}

export function map<T, TSource = unknown>(
  source: Atom<TSource>,
  mapper: (dependedAtomState: TSource) => NonUndefined<T>,
): Atom<T>
export function map<T, TSource = unknown>(
  name: AtomName,
  source: Atom<TSource>,
  mapper: (dependedAtomState: TSource) => NonUndefined<T>,
): Atom<T>
export function map<T, TSource = unknown>(
  name: AtomName | Atom<TSource>,
  source: ((dependedAtomState: TSource) => T) | Atom<TSource>,
  mapper?: (dependedAtomState: TSource) => NonUndefined<T>,
) {
  if (!mapper) {
    mapper = source as (dependedAtomState: TSource) => NonUndefined<T>
    source = name as Atom<TSource>
    name = getTree(source).id.toString() + ' [map]'
  }
  safetyFunc(mapper, 'mapper')

  return declareAtom<T>(
    name as AtomName,
    // FIXME: initialState for `map` :thinking:
    null as any,
    handle =>
      //@ts-ignore
      handle(source as Atom<TSource>, (state, payload) => mapper(payload)),
  )
}

type TupleOfAtoms = [Atom<unknown>] | Atom<unknown>[]

export function combine<T extends AtomsMap | TupleOfAtoms>(
  shape: T,
): Atom<{ [key in keyof T]: T[key] extends Atom<infer S> ? S : never }>
export function combine<T extends AtomsMap | TupleOfAtoms>(
  name: AtomName,
  shape: T,
): Atom<{ [key in keyof T]: T[key] extends Atom<infer S> ? S : never }>
export function combine<T extends AtomsMap | TupleOfAtoms>(
  name: AtomName | T,
  shape?: T,
) {
  let keys: (string | number)[]
  if (!shape) {
    shape = name as T
    name = Symbol('{' + (keys = Object.keys(shape)).join() + '}')
  }

  keys = keys! || Object.keys(shape)

  const isArray = Array.isArray(shape)

  return declareAtom(name as string | [TreeId], isArray ? [] : {}, reduce =>
    keys.forEach(key =>
      //@ts-ignore
      reduce(shape[key], (state, payload) => {
        const newState: any = isArray
          ? (state as any[]).slice(0)
          : assign({}, state)
        newState[key] = payload
        return newState
      }),
    ),
  )
}
