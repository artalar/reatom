import {
  Id,
  Unit,
  StateCtx,
  NODE_KEY,
  KIND_KEY,
  KIND,
  Ctx,
  Node,
  nameToId,
  throwError,
  getNode,
  safetyFunc,
  safetyStr,
  getIsAction,
  assign,
  getIsAtom,
  getIsName,
  Name,
  getIsFn,
} from './shared'
import { ActionBase, ActionCreator, declareAction } from './declareAction'

// action for set initialState of each atom to global context state
const _initAction = declareAction(['@@Reatom/init'])
export const initAction = _initAction()

type Reducer<TState, TValue> = (state: TState, value: TValue) => TState
type DependencyMatcher<TState> = (
  on: <Dep extends Unit<any>>(
    dependency: Dep,
    reducer: Dep extends ActionCreator<infer T> | Atom<infer T>
      ? Reducer<TState, T>
      : never,
  ) => void,
) => void[]

export type Atom<TState> = Unit<'atom'> & {
  (state?: StateCtx, action?: ActionBase<any>): Record<string, TState | unknown>
  getState<T = TState>(
    dependedAtom?: Atom<T>,
    state?: StateCtx,
    action?: ActionBase,
  ): T | undefined
}

export function declareAtom<TState>(
  initialState: TState,
  dependencyMatcher: DependencyMatcher<TState>,
): Atom<TState>
export function declareAtom<TState>(
  name: string | [Id],
  initialState: TState,
  dependencyMatcher: DependencyMatcher<TState>,
): Atom<TState>
/**
 * Atoms is stateless reducer function that my used as selector in an store.
 * Atom may depend from action or from other atom - with that you can scale it how you want.
 * @param name(string | [id]) optional name or id (string) for predictable snapshots and debugging
 * @param initialState can not be undefined
 * @param dependencyMatcher callback for describe dependencies handlers
 * @example
 * const valueAtom = declareAtom(0, on => [
 *   on(addAction, (state, payload) => state + payload),
 *   on(dependedAtom, (state, dependedValue) => state * dependedValue),
 * ])
 */
export function declareAtom<TState>(
  name: string | [Id] | TState,
  initialState: TState | DependencyMatcher<TState>,
  dependencyMatcher?: DependencyMatcher<TState>,
): Atom<TState> {
  if (!dependencyMatcher) {
    dependencyMatcher = initialState as DependencyMatcher<TState>
    initialState = name as TState
    name = 'atom'
  }

  const selfId = nameToId(name as string | [Id])

  if (initialState === undefined)
    throwError(`initial state (undefined) in atom "${selfId}"`)

  const selfNode = new Node(selfId)
  const selfDeps = selfNode.deps
  const selfDepsAll = selfNode.depsAll
  const selfUpdates = selfNode.updates
  let dependencePosition = 0
  let initialPhase = true

  function on<T>(dep: Unit<any>, reducer: Reducer<TState, T>) {
    if (!initialPhase)
      throwError(`"on" handler calls after initialization in atom "${selfId}"`)

    const position = dependencePosition++

    safetyFunc(reducer, 'atom reducer №' + position)

    const depNode = getNode(dep)
    if (!depNode) throwError('atom dependency №' + position)
    const { id: depId, depsAll: depDepsAll } = depNode
    const isDepActionCreator = getIsAction(dep)

    depDepsAll.forEach(id => !selfDepsAll.includes(id) && selfDepsAll.push(id))
    selfDepsAll.push(depId)
    selfDeps.push(depNode)

    selfUpdates.push(({ state, stateNew, payload, changedIds, type }: Ctx) => {
      if (!depNode.depsAll.includes(type)) return

      const atomStateSnapshot = state[selfId]
      const isFirstWalk = atomStateSnapshot === undefined

      if (!isFirstWalk && type === initAction.type) return

      const atomStatePreviousReducer = stateNew[selfId]
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
      const depValue = (isDepActionCreator ? payload : depState) as T

      if (atomState === undefined && type !== initAction.type)
        throwError('dispatch with undefined state')
      if (isDepActionCreator || isDepChanged || isFirstWalk) {
        const atomStateNew = reducer(atomState, depValue)

        if (atomStateNew === undefined)
          throwError(
            `(undefined) state in reducer № ${position} in atom "${selfId}"`,
          )

        if (atomStateNew !== atomState && !hasAtomNewState)
          changedIds.push(selfId)
        stateNew[selfId] = atomStateNew
      }
    })
  }

  on(_initAction, (state = initialState as TState) => {
    return state
  })
  dependencyMatcher(on)

  // TODO: refactoring types
  // @ts-ignore
  const atom: Atom<TState> = (
    state: StateCtx = {},
    action: ActionBase<any> = initAction,
  ) => {
    const ctx = new Ctx(state, action)
    walk(selfNode, ctx)

    const { changedIds, stateNew } = ctx

    return changedIds.length > 0 ? assign({}, state, stateNew) : state
  }

  atom[NODE_KEY] = selfNode
  atom[KIND_KEY] = KIND.atom
  atom.getState = <T = TState>(
    // @ts-ignore
    dependedAtom: Atom<T> = atom,
    state: StateCtx = {},
    action: ActionBase = initAction,
  ): T | undefined => {
    return getState(atom(state, action), dependedAtom)
  }

  return atom
}

function walk(node: Node, ctx: Ctx) {
  if (node.depsAll.includes(ctx.type) && ctx.stateNew[node.id] === undefined) {
    node.deps.forEach(childNode => walk(childNode, ctx))
    node.updates.forEach(update => update(ctx))
  }
}

export function getState<T>(state: StateCtx, atom: Atom<T>): T | undefined {
  return state[atom[NODE_KEY].id] as T | undefined
}

type AtomsMap = { [key in string]: Atom<unknown> }

// prettier-ignore
type TupleOfAtoms =
  [Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]
  | [Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>, Atom<unknown>]

type CombineInputCollection = AtomsMap | TupleOfAtoms | Atom<unknown>[]
type CombineInput = Atom<unknown> | CombineInputCollection

type CombineOutput<Input extends CombineInput> = Input extends Atom<infer T>
  ? T
  : { [K in keyof Input]: Input[K] extends Atom<infer S> ? S : never }
type CombineOutputAtom<Input extends CombineInput> = Atom<CombineOutput<Input>>

function _map(name: Name, source: Atom<unknown>, mapper: (a: any) => any) {
  return declareAtom(
    name,
    // FIXME: initialState for `map` :thinking:
    null as unknown,
    on => [on(source, (state, payload) => mapper(payload))],
  )
}

function _combine(name: Name, shape: CombineInputCollection) {
  const keys = Object.keys(shape) // '{' + Object.keys(shape).join() + '}'

  const isArray = Array.isArray(shape)
  const copy = isArray
    ? (state: any) => state.slice(0)
    : (state: any) => assign({}, state)

  return declareAtom(name, isArray ? [] : {}, on =>
    keys.map(key =>
      on((shape as any)[key], (state, payload) => {
        const stateNew = copy(state)
        stateNew[key] = payload
        return stateNew
      }),
    ),
  )
}

function getIsCombineInputCollection(
  thing: unknown,
): thing is CombineInputCollection {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    (!Array.isArray(thing) || thing.length > 0)
  )
}

export function combine<Input extends CombineInputCollection>(
  input: Input,
): CombineOutputAtom<Input>
export function combine<Input extends CombineInputCollection>(
  name: string | [Id],
  input: Input,
): CombineOutputAtom<Input>
export function combine<Input extends CombineInput, Output>(
  input: Input,
  mapper: (dependedState: CombineOutput<Input>) => Output,
): Atom<Output>
export function combine<Input extends CombineInput, Output>(
  name: string | [Id],
  input: Input,
  mapper: (dependedState: CombineOutput<Input>) => Output,
): Atom<Output>
export function combine<Input extends CombineInput, Output>(
  first: string | [Id] | Input,
  second?: Input | ((dependedState: CombineOutput<Input>) => Output),
  third: (dependedState: CombineOutput<Input>) => Output = v => v as any,
) {
  const argsLength = arguments.length
  if (argsLength === 1 && getIsCombineInputCollection(first)) {
    return _combine('combine', first)
  }
  if (
    argsLength === 2 &&
    getIsName(first) &&
    getIsCombineInputCollection(second)
  ) {
    return _combine(first, second)
  }
  if (argsLength === 2 && getIsFn(second)) {
    if (getIsCombineInputCollection(first)) {
      return _map('combine', _combine('combine', first), second)
    }
    if (getIsAtom(first)) {
      return _map('combine', first, second)
    }
  }
  if (argsLength === 3 && getIsName(first) && getIsFn(third)) {
    if (getIsCombineInputCollection(second)) {
      return _map('combine', _combine('combine', second), third)
    }
    if (getIsAtom(second)) {
      return _map('combine', second, third)
    }
  }

  throwError('combine arguments')
}

export const map = combine
