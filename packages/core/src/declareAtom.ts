import { Tree, State, TreeId, Ctx, createCtx, Leaf } from './kernel'
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
  getName,
  equals,
  getOwnKeys,
} from './shared'
import { Action, declareAction, PayloadActionCreator } from './declareAction'

const DEPS = Symbol('@@Reatom/DEPS')
const DEPS_SHAPE = Symbol('@@Reatom/DEPS_SHAPE')

// action for set initialState of each atom to global state
const initActionCreator = declareAction(['@@Reatom/init'])
export const initAction = initActionCreator()

type AtomName = TreeId | [string]
type AtomsMap = { [key: string]: Atom<any> }
type Reducer<TState, TValue> = (state: TState, value: TValue) => TState

/**
 * This interface needed for correct type inference with TypeScript 3.5
 * @see https://github.com/artalar/reatom/issues/301
 */
interface DependencyMatcherOn<TState> {
  <T>(dependency: Atom<T>, reducer: Reducer<TState, T>): void
  <T>(dependency: PayloadActionCreator<T>, reducer: Reducer<TState, T>): void
  <T>(
    dependency: Atom<T> | PayloadActionCreator<T>,
    reducer: Reducer<TState, T>,
  ): void
}
type DependencyMatcher<TState> = (on: DependencyMatcherOn<TState>) => any

export interface Atom<T> extends Unit {
  (state?: State, action?: Action<any>): Record<string, T | any>
  [DEPS]: Set<TreeId>
  [DEPS_SHAPE]?: AtomsMap | TupleOfAtoms
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
  const _name = getName(_id)

  if (initialState === undefined)
    throwError(`Atom "${_name}". Initial state can't be undefined`)

  const _tree = new Tree(_id)
  const _deps = new Set<TreeId>()
  // start from `0` for missing `actionDefault`
  let dependencePosition = 0
  const initialPhase = true

  function on<T>(
    dep: Unit | PayloadActionCreator<T>,
    reducer: Reducer<TState, T>,
  ) {
    if (!initialPhase)
      throwError("Can't define dependencies after atom initialization")

    safetyFunc(reducer, 'reducer')

    const position = dependencePosition++
    const depTree = getTree(dep as Unit)
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
      const atomStateSnapshot = state[_id as string]
      // first `walk` of lazy (dynamically added by subscription) atom
      const isAtomLazy = atomStateSnapshot === undefined

      if (!isAtomLazy && type === initAction.type && !payload) return

      const atomStatePreviousReducer = stateNew[_id as string]
      // it is mean atom has more than one dependencies
      // that depended from dispatched action
      // and one of the atom reducers already processed
      const hasAtomNewState = atomStatePreviousReducer !== undefined
      const atomState = (hasAtomNewState
        ? atomStatePreviousReducer
        : atomStateSnapshot) as TState

      const depStateSnapshot = state[depId as string]
      const depStateNew = stateNew[depId as string]
      const isDepChanged = depStateNew !== undefined
      const depState = isDepChanged ? depStateNew : depStateSnapshot
      const depValue = isDepActionCreator ? payload : depState

      if (isDepActionCreator || isDepChanged || isAtomLazy) {
        const atomStateNew = reducer(atomState, depValue)

        if (atomStateNew === undefined)
          throwError(
            `Invalid state. Reducer number ${position} in "${_name}" atom returns undefined`,
          )

        if (hasAtomNewState && equals(atomStateSnapshot, atomStateNew)) {
          changedIds.splice(changedIds.indexOf(_id), 1)
          delete stateNew[_id as string]

          return
        }

        if (!equals(atomState, atomStateNew)) {
          if (!hasAtomNewState) changedIds.push(_id)

          stateNew[_id as string] = atomStateNew
        }
      }
    }
    update._ownerAtomId = _id

    if (isDepActionCreator) return _tree.addFn(update, depId as Leaf)
    if (_deps.has(depId)) throwError('One of dependencies has the equal id')
    _deps.add(depId)
    depTree.fnsMap.forEach((_, key) => _tree.addFn(update, key))
  }

  on(initActionCreator, (_, { [_id]: state = initialState }: any = {}) => state)
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
  return state[atom[TREE].id as string] as T | undefined
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
    name = Symbol(`${getName(getTree(source).id)} [map]`)
  }
  safetyFunc(mapper, 'mapper')

  return declareAtom<T>(
    name as AtomName,
    // FIXME: initialState for `map` :thinking:
    null as any,
    handle =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      handle(source as Atom<TSource>, (state, payload) => mapper!(payload)),
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
  if (arguments.length === 1) shape = name as T

  const isArray = Array.isArray(shape)

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const keys = getOwnKeys(shape!) as TreeId[]

  if (arguments.length === 1)
    name = isArray
      ? Symbol(
          `[${keys
            .map(k => getName(getTree((shape as TupleOfAtoms)[k as any]).id))
            .join()}]`,
        )
      : Symbol(`{${keys.map(getName).join()}}`)

  const atom = declareAtom(name as AtomName, isArray ? [] : {}, reduce =>
    keys.forEach(key =>
      reduce((shape as any)[key], (state, payload) => {
        const newState: any = isArray
          ? (state as any[]).slice(0)
          : assign({}, state)
        newState[key] = payload
        return newState
      }),
    ),
  )
  atom[DEPS_SHAPE] = shape
  return atom
}

export function getDepsShape(
  thing: Atom<any>,
): AtomsMap | TupleOfAtoms | undefined {
  return thing[DEPS_SHAPE]
}
