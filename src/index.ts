console.warn('REAtom still work in progress, do not use it in production')

type NodeId = string

type ActionType = string
type ActionTypesDictionary = Record<ActionType, true>
type Node = {
  id: NodeId
  actionTypes: ActionTypesDictionary
  // TODO: try to remove it
  dependencies: DependenciesDictionary
  stackWorker: (ctx: Ctx) => any
}
type DependenciesDictionary = Record<NodeId, Node>
type State = Record<string, any>

const NODE = Symbol('@@REAtom/NODE')
const assign = Object.assign

function noop() {}

export type ActionCreator<Payload = undefined, Type extends string = string> = {
  getType: () => string
  [NODE]: Node
} & (Payload extends undefined
  ? () => Action<Payload, Type>
  : (payload: Payload) => Action<Payload, Type>)

type Atom<T> = {
  (state: State, action: Action<any>): State
  [NODE]: Node
}

type Unit<T = unknown> = (ActionCreator<T>) | (Atom<T>)

function throwIf(predicate: boolean | any, msg: string) {
  // TODO: add link to docs with full description
  if (predicate) throw new Error(msg)
}
function safetyStr(str: any, name: string): string {
  throwIf(typeof str !== 'string' || str.length === 0, 'Invalid ' + name)
  return str
}
function safetyFunc(func: any, name: string): Function {
  throwIf(typeof func !== 'function', 'Invalid ' + name)
  return func
}
let id = 0
function nameToId(name: unknown) {
  return Array.isArray(name)
    ? safetyStr(name[0], 'name')
    : safetyStr(name, 'name') + ' #' + ++id
}

type StackWorker = (ctx: Ctx) => any
type Stack = StackWorker[]

class Ctx {
  state: State
  stateNew: State
  type: string
  payload: any
  stack: Stack
  changedIds: NodeId[]
  constructor(state: State, { type, payload }: Action<any>, stack: Stack) {
    this.state = state
    this.stateNew = {}
    this.type = type
    this.payload = payload
    this.stack = stack
    this.changedIds = []
  }
}

export type Action<Payload, Type extends string = string> = {
  type: Type
  payload: Payload
}

function getIsAction(target: any): target is ActionCreator<any> {
  return target && target[NODE] && typeof target.getType === 'function'
}

export function declareAction<
  Payload = undefined,
  Type extends string = string
>(name: string | [Type] = 'action'): ActionCreator<Payload, Type> {
  const id = nameToId(name)

  const ACNode: Node = {
    id,
    actionTypes: { [id]: true as const },
    dependencies: {},
    stackWorker: noop,
  }

  function actionCreator(payload?: Payload) {
    return {
      type: id,
      payload,
    }
  }

  // @ts-ignore
  actionCreator[NODE] = ACNode
  actionCreator.getType = () => id

  // @ts-ignore
  return actionCreator
}

// action for set initialState of each atom to global state
export const actionDefault = declareAction(['@@REAtom/default'])

// for create nullable store
const defaultAtom = declareAtom(0, () => 0)

// @ts-ignore
export declare function declareAtom<State>(
  name: string | [string],
  initialState: State,
  dependencyMatcher: (
    reduce: <T>(
      dependency: Unit<T>,
      reducer: (state: State, value: T) => State,
    ) => void,
  ) => any,
): Atom<State>
// @ts-ignore
export declare function declareAtom<State>(
  initialState: State,
  dependencyMatcher: (
    reduce: <T>(
      dependency: Unit<T>,
      reducer: (state: State, value: T) => State,
    ) => void,
  ) => any,
): Atom<State>
export function declareAtom<State>(
  name: string | [string],
  initialState: State,
  dependencyMatcher: (
    reduce: <T>(
      dependency: Unit<T>,
      reducer: (state: State, value: T) => State | undefined,
    ) => void,
  ) => any,
): Atom<State> {
  if (arguments.length === 2) {
    // @ts-ignore
    dependencyMatcher = initialState
    // @ts-ignore
    initialState = name
    name = 'reducer'
  }
  throwIf(initialState === undefined, "Initial state can't be undefined")

  const atomId = nameToId(name)

  const atomActionTypes: ActionTypesDictionary = {}
  const atomDependencies: DependenciesDictionary = {}
  const atomStack: Stack = []
  let initialPhase = true

  function reduce<T>(
    dep: Unit<T>,
    reducer: (state: State, payload: T) => State | undefined,
  ) {
    throwIf(
      !initialPhase,
      "Can't define dependencies after atom initialization",
    )

    let depNode!: Node
    throwIf(!dep || !(depNode = dep[NODE]), 'Invalid dependency')
    safetyFunc(reducer, 'reducer')

    const {
      id: depId,
      actionTypes: depActionTypes,
      dependencies: depDependencies,
      stackWorker: depStackWorker,
    } = depNode

    const isDepActionCreator = getIsAction(dep)

    throwIf(depDependencies[atomId], 'One of dependencies has the equal id')

    assign(atomActionTypes, depActionTypes)
    assign(atomDependencies, depDependencies)
    atomDependencies[depId] = depNode

    function update(ctx: Ctx) {
      const { state, stateNew, payload } = ctx
      const atomStateSnapshot = state[atomId]
      // first `walk` of lazy (dynamically added by subscription) atom
      const isAtomLazy = atomStateSnapshot === undefined
      const atomStatePreviousReducer = stateNew[atomId]
      // it is mean atom has more than one dependencies
      // that depended from dispatched action
      // and one of the atom reducers already processed
      const hasAtomNewState = atomStatePreviousReducer !== undefined
      const atomState = hasAtomNewState
        ? atomStatePreviousReducer
        : atomStateSnapshot

      const depStateSnapshot = state[depId]
      const depStateNew = stateNew[depId]
      const isDepChanged = depStateNew !== undefined
      const depState = isDepChanged ? depStateNew : depStateSnapshot
      const depValue = isDepActionCreator ? payload : depState

      if (isDepActionCreator || isDepChanged || isAtomLazy) {
        const atomStateNew = reducer(atomState, depValue)

        throwIf(atomStateNew === undefined, "State can't be undefined")

        if (atomStateNew !== atomState) {
          ctx.stateNew[atomId] = atomStateNew
          if (!hasAtomNewState) ctx.changedIds.push(atomId)
        }
      }
    }

    atomStack.push(
      ctx => depActionTypes[ctx.type] && ctx.stack.push(update, depStackWorker),
    )
  }

  reduce(actionDefault, (state = initialState) => state)
  dependencyMatcher(reduce)
  atomStack.reverse()

  const stackWorker = (ctx: Ctx) =>
    atomActionTypes[ctx.type] &&
    ctx.stateNew[atomId] === undefined &&
    ctx.stack.push(...atomStack)

  const atomNode: Node = {
    id: atomId,
    actionTypes: atomActionTypes,
    dependencies: atomDependencies,
    stackWorker,
  }

  function atom(state: Ctx['state'], action: { type: string; payload: any }) {
    const { changedIds, stateNew } = walk(new Ctx(state, action, [stackWorker]))

    return changedIds.length > 0 ? assign({}, state, stateNew) : state
  }

  // @ts-ignore
  atom[NODE] = atomNode

  // @ts-ignore
  return atom
}

function getIsAtom(target: any) {
  return !getIsAction(target) && target && target[NODE]
}

export function getNode(target: Unit): Node {
  return target[NODE]
}

export function getState<T>(state: State, atom: Atom<T>): T | undefined {
  return state[atom[NODE].id]
}

function walk(ctx: Ctx) {
  const { stack } = ctx
  let f
  while ((f = stack.pop())) f(ctx)

  return ctx
}

// @ts-ignore
export declare function map<T, _T = unknown>(
  atom: Atom<_T>,
  mapper: (dependedAtomState: _T) => T,
): Atom<T>
// @ts-ignore
export declare function map<T, _T = unknown>(
  name: string | [string],
  atom: Atom<_T>,
  mapper: (dependedAtomState: _T) => T,
): Atom<T>
// @ts-ignore
export function map(name, target, mapper) {
  if (arguments.length === 2) {
    mapper = target
    target = name
    name = (target[NODE] as Node).id + ' [map]'
  }
  safetyFunc(mapper, 'mapper')

  return declareAtom(
    name,
    // FIXME: initialState for `map` :thinking:
    null,
    reduce => reduce(target, (state, payload) => mapper(payload)),
  )
}

// @ts-ignore
export declare function combine<
  T extends { [key in string]: Atom<any> } | TupleOfAtoms
>(
  shape: T,
): Atom<{ [key in keyof T]: T[key] extends Atom<infer S> ? S : never }>
// @ts-ignore
export declare function combine<
  T extends { [key in string]: Atom<any> } | TupleOfAtoms
>(
  name: string | [string],
  shape: T,
): Atom<{ [key in keyof T]: T[key] extends Atom<infer S> ? S : never }>
export function combine(name: any, shape: any) {
  let keys: string[]
  if (arguments.length === 1) {
    // @ts-ignore
    shape = name
    name = '{' + (keys = Object.keys(shape)).join() + '}'
  }

  keys = keys! || Object.keys(shape)

  const isArray = Array.isArray(shape)

  return declareAtom(name, isArray ? [] : {}, reduce =>
    keys.map(key =>
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

declare function storeGetState<TargetAtom extends Atom<any>>(
  target: TargetAtom,
): TargetAtom extends Atom<infer S> ? S : never
declare function storeGetState(): State

declare function storeSubscribe<TargetAtom extends Atom<any>>(
  target: TargetAtom,
  listener: (state: TargetAtom extends Atom<infer S> ? S : never) => any,
): () => void
declare function storeSubscribe(
  listener: (action: Action<any>) => any,
): () => void
export type Store = {
  dispatch: (action: Action<any>) => void
  subscribe: typeof storeSubscribe
  getState: typeof storeGetState
}

// TODO: try to use ES6 Map's instead of plain object
// for prevent using `delete` operator
// (need perf tests)
export function createStore(atom: Atom<any> | null, preloadedState = {}): Store {
  const listenersStore = {} as { [key in string]: Function[] }
  const listenersActions: Function[] = []
  const atomNode = getNode(atom || defaultAtom)
  const atomDeps = atomNode.dependencies
  const atomDepsCounters: { [key in string]: number } = {}
  for (const id in atomDeps) atomDepsCounters[id] = 1

  const newStack: Stack = []
  let stack: Stack = [atomNode.stackWorker]

  const initialState = walk(
    new Ctx(preloadedState, actionDefault(), [atomNode.stackWorker]),
  ).stateNew
  // preloadedState needed to save data of lazy atoms
  const state = assign({}, preloadedState, initialState)

  function actualizeState() {
    if (newStack.length > 0)
      assign(state, walk(new Ctx(state, actionDefault(), newStack)).stateNew)
  }

  function incrementDeps(key: string) {
    atomDepsCounters[key] = (atomDepsCounters[key] || 0) + 1
  }

  function decrementDeps(id: NodeId) {
    if (--atomDepsCounters[id] === 0) {
      delete atomDepsCounters[id]
      delete state[id]
    }
  }

  function _getState(target?: Atom<any>) {
    actualizeState()

    if (target === undefined) return assign({}, state)

    throwIf(!getIsAtom(target), 'Invalid target')

    const targetState = getState(state, target)
    if (targetState !== undefined) return targetState

    const targetNode = target[NODE]

    return getState(
      walk(new Ctx(state, actionDefault(), [targetNode.stackWorker])).stateNew,
      target,
    )
  }

  // @ts-ignore
  function subscribe(...a) {
    const isSubscriptionToAtom = a.length === 2
    const listener = safetyFunc(a[+isSubscriptionToAtom], 'listener')
    let isSubscribed = true

    if (!isSubscriptionToAtom) {
      listenersActions.push(listener)
      return () => {
        if (isSubscribed) {
          isSubscribed = false
          listenersActions.splice(listenersActions.indexOf(listener, 1))
        }
      }
    }

    const target = a[0] as Atom<any>
    throwIf(!getIsAtom(target), 'Target is not Atom')
    const targetNode = target[NODE]
    const targetId = targetNode.id
    const targetStackWorker = targetNode.stackWorker
    const targetDeps = targetNode.dependencies
    const isLazy = initialState[targetId] === undefined

    if (listenersStore[targetId] === undefined) {
      listenersStore[targetId] = []
      if (isLazy) {
        newStack.push(targetStackWorker)
        stack.push(targetStackWorker)
        incrementDeps(targetId)
        for (const key in targetDeps) incrementDeps(key)
      }
    }

    listenersStore[targetId].push(listener)

    return () => {
      if (isSubscribed) {
        isSubscribed = false

        const _listeners = listenersStore[targetId]
        _listeners.splice(_listeners.indexOf(listener), 1)

        if (isLazy && _listeners.length === 0) {
          delete listenersStore[targetId]

          decrementDeps(targetId)
          for (const key in targetDeps) decrementDeps(targetDeps[key].id)

          stack.splice(stack.indexOf(targetStackWorker), 1)

          const targetInNewStack = newStack.indexOf(targetStackWorker)
          if (targetInNewStack !== -1) newStack.splice(targetInNewStack, 1)
        }
      }
    }
  }

  function dispatch(action: Action<any>) {
    throwIf(
      typeof action !== 'object' ||
        action === null ||
        typeof action.type !== 'string',
      'Invalid action',
    )

    actualizeState()

    const { changedIds, stateNew } = walk(
      new Ctx(state, action, stack.slice(0)),
    )

    if (changedIds.length > 0) {
      assign(state, stateNew)

      for (let i = 0; i < changedIds.length; i++) {
        const id = changedIds[i]
        callFromList(listenersStore[id] || [], stateNew[id])
      }
    }

    callFromList(listenersActions, action)
  }

  return { getState: _getState, subscribe, dispatch }
}

function callFromList(list: Function[], arg: any, i = -1) {
  while (++i < list.length) list[i](arg)
}

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
