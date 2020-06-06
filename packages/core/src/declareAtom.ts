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

/**
 * Action used to set initial state of atom
 */
export const init = declareAction(['@@Reatom/init'])
export const initAction = init()

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

/**
 * Atoms\* are state**less** instructions to calculate derived state in the right order (without [glitches](https://stackoverflow.com/questions/25139257/terminology-what-is-a-glitch-in-functional-reactive-programming-rx)).
 *
 * > For redux users: **atom - is a thing that works concomitantly like reducer and selector.**
 *
 * Atom reducers may depend on declared action or other atoms and must be pure functions that return new immutable version of the state. If a reducer returns old state – depended atoms and subscribers will not be triggered.
 *
 * > [\*](https://github.com/calmm-js/kefir.atom/blob/master/README.md#related-work) The term "atom" is borrowed from [Clojure](http://clojure.org/reference/atoms) and comes from the idea that one only performs ["atomic"](https://en.wikipedia.org/wiki/Read-modify-write), or [race-condition](https://en.wikipedia.org/wiki/Race_condition) free, operations on individual atoms. Besides that reatoms atoms is stateless and seamlessly like [Futures](https://en.wikipedia.org/wiki/Futures_and_promises) in this case.
 */
export interface Atom<T> extends Unit {
  (state?: State, action?: Action<any>): Record<string, T | any>
  [DEPS]: Set<TreeId>
  [DEPS_SHAPE]?: AtomsMap | TupleOfAtoms
}

/**
 * Added in: v1.0.0
 *
 * ```js
 * import { declareAtom } from '@reatom/core'
 * ```
 *
 * #### Description
 *
 * Function to create an atom Declaration.
 *
 * #### Signature
 *
 * ```typescript
 * // overload 1
 * declareAtom<S>(defaultState: AtomState<S>, depsMatcher: DependcyMatcher<S>): Atom<S>
 *
 * // overload 2
 * declareAtom<S>(name: string | [string], defaultState: AtomState<S>, depsMatcher: DependcyMatcher<S>): Atom<S>
 *
 * ```
 * **Generic Types**
 * - **S** - type of atom state
 *
 * **Arguments**
 * - **name** `string` | `[string]` - optional
 * - **defaultState** `any` - required
 * - **depsMatcher** `Function` - required
 *
 * **Returns** [`Atom`](./Atom)
 *
 * #### Examples
 *
 * Basic
 *
 * ```js
 * const myList = declareAtom([], on => [
 *   on(addItem, (state, payload) => [...state, payload])
 * ])
 * ```
 *
 * With name
 *
 * ```js
 * const myList = declareAtom('products', [], on => [
 *   on(addItem, (state, payload) => [...state, payload])
 * ])
 * ```
 *
 * With static name
 *
 * ```js
 * const myList = declareAtom(['products'], [], on => [
 *   on(addItem, (state, payload) => [...state, payload])
 * ])
 * ```
 */
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

  on(init, (_, { [_id]: state = initialState }: any = {}) => state)
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

/**
 * Added in: v1.0.0
 *
 * ```js
 * import { map } from '@reatom/core'
 * ```
 *
 * #### Description
 *
 * A function to create derived atoms by the required data format.
 *
 * #### Signature
 *
 * ```typescript
 * // overload 1
 * map(atom: Atom, mapper: Function): Atom
 *
 * // overload 2
 * map(name: string | [string], atom: Atom, mapper: Function): Atom
 * ```
 *
 * **Arguments**
 * - **name** `string` | `[string]` - optional
 * - **atom** [`Atom`](./Atom) - required
 * - **mapper** `Function` - required
 *
 * **Returns** [`Atom`](./Atom)
 *
 * #### Examples
 *
 * Basic
 * ```js
 * const newAtom = map(counterAtom, atomState => atomState * 2)
 * ```
 *
 * With name
 * ```js
 * const newAtom = map('newAtom', counterAtom, atomState => atomState * 2)
 * ```
 *
 * With static name
 * ```js
 * const newAtom = map(['newAtom'], counterAtom, atomState => atomState * 2)
 * ```
 */
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

/**
 * Added in: v1.0.0
 *
 * ```js
 * import { combine } from '@reatom/core'
 * ```
 *
 * #### Description
 *
 * A function to combine several atoms into one.
 *
 * #### Signature
 *
 * ```typescript
 * // overload 1
 * combine(shape: AtomsMap | TupleOfAtoms): Atom
 *
 * // overload 2
 * combine(name: string | [string], shape: AtomsMap | TupleOfAtoms): Atom
 * ```
 *
 * **Arguments**
 * - **name** `string` | `[string]` - optional
 * - **shape** `Object` - required
 *
 * **Returns** [`Atom`](./Atom)
 *
 * #### Examples
 *
 * Basic
 * ```js
 * const myCombinedAtom = combine({ myAtom1, myAtom2 })
 * ```
 *
 * With name
 * ```js
 * const myCombinedAtom = combine('myCombinedAtom', [myAtom1, myAtom2])
 * ```
 *
 * With static name
 * ```js
 * const myCombinedAtom = combine(['myCombinedAtom'], [myAtom1, myAtom2])
 * ```
 */
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
