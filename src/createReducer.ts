import {
  Action,
  Reducer,
  ActionCreator,
  Ctx,
  createId,
  getName,
  getId,
  Steroid,
  Node,
} from './model'
import { createAction } from './createAction'

const NODES = Symbol('@@/NODES')

const initialAction = createAction<'@@/init'>('initialAction', () => '@@/init')
const initialActionType = getId(initialAction)

export function createReducer<State>(
  name: string,
  initialState: State,
  ...handlers: {
    reducer: (state: State, ...a: any[]) => State
    children: Steroid[]
  }[]
) {
  if (initialState === undefined) {
    throw new TypeError("`initialState` can't be undefined")
  }

  const id = createId(name, 'reducer')
  const _types = {}

  function reducer(
    state: {
      root?: State
      flat?: Ctx['flat']
    } | null,
    action: Action<any>,
    merger = (flat: Object, flatNew: Object) =>
      Object.assign({}, flat, flatNew),
  ): {
    root: State
    flat: Ctx['flat']
    changes?: Ctx['changes']
  } {
    let { type, payload } = action

    if (
      _types[type] !== true &&
      // can be true for lazy reducer
      !_node._children.some(n => n._match({ visited: {}, type }))
    ) {
      if (state && state.flat && state.flat[id] !== undefined) return state
      type = initialActionType
      payload = undefined
    }

    const { flat = {} } = state || {}
    const changes: Ctx['changes'] = []
    const flatNew = {}
    const ctx: Ctx = {
      type,
      payload,
      changes,
      flat,
      flatNew,
      visited: {},
    }

    walk(_node, ctx)
    if (ctx.changes.length === 0) return state

    delete flatNew[type]

    return {
      root: flatNew[id] as State,
      flat: merger(flat, flatNew),
      changes,
    }
  }

  function _node(ctx) {
    ctx.visited[id] = true
  }

  _node._match = (ctx: Ctx) => ctx.visited[id] !== true
  _node._children = []

  reducer._node = _node
  reducer._id = id
  reducer._name = name
  reducer._types = _types
  reducer._isAction = false
  reducer._initialState = initialState
  handlers.unshift(handle(initialAction, (state = initialState) => state))

  handlers.forEach(({ reducer, children }) => {
    const argsLength = children.length
    const isActionInDeps = children[0]._isAction === true
    const types = Object.assign({}, ...children.map(({ _types }) => _types))

    function node({ flat, flatNew, changes, visited }: Ctx) {
      const isInit = flat[id] === undefined
      const oldState = isInit ? initialState : (flat[id] as State)
      const args = new Array(argsLength)
      args[0] = oldState
      let hasDependenciesChanged = isActionInDeps || isInit

      children.forEach((steroid, i) => {
        const steroidId = steroid._id
        const steroidStateNew = flatNew[steroidId]
        const steroidStateOld = flat[steroidId]

        args[i + 1] =
          steroidStateNew === undefined ? steroidStateOld : steroidStateNew

        hasDependenciesChanged =
          hasDependenciesChanged || steroidStateNew !== steroidStateOld
      })

      if (hasDependenciesChanged) {
        const newState = reducer(...args)
        if (newState === undefined) {
          throw new TypeError("state can't be undefined")
        }
        flatNew[id] = newState
        if (oldState !== newState || isInit) changes.push(id)
      }
    }

    node._match = (ctx: Ctx) => types[ctx.type] === true
    node._children = children.map(({ _node }) => _node)

    Object.assign(_types, types)
    _node._children.push(node)
  })

  return reducer
}

function walk(node: Node, ctx: Ctx) {
  if (node._match(ctx)) {
    node._children.forEach(childNode => {
      walk(childNode, ctx)
    })
    node(ctx)
  }
}

export function getState<R extends Reducer<any>>(
  state: { flat?: { [key in string]: any } },
  reducer: R,
): R['_initialState'] {
  const reducerState = (state || { flat: {} }).flat[reducer._id]
  if (reducerState === undefined) return reducer._initialState
  return reducerState
}

export function handle<Node1Type, State = any>(
  dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type>,
  reducer: (state: State, payload1: Node1Type) => State,
): {
  reducer: (state: State, payload1: Node1Type) => State
  children: [ActionCreator<Node1Type> | Reducer<Node1Type>]
}
export function handle<Node1Type, Node2Type, State = any>(
  dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type>,
  dependedReducer1: Reducer<Node2Type>,
  reducer: (state: State, payload1: Node1Type, payload2: Node2Type) => State,
): {
  reducer: (state: State, payload1: Node1Type, payload2: Node2Type) => State
  children: [ActionCreator<Node1Type> | Reducer<Node1Type>, Reducer<Node2Type>]
}
export function handle<Node1Type, Node2Type, Node3Type, State = any>(
  dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type>,
  dependedReducer1: Reducer<Node2Type>,
  dependedReducer2: Reducer<Node3Type>,
  reducer: (
    state: State,
    payload1: Node1Type,
    payload2: Node2Type,
    payload3: Node3Type,
  ) => State,
): {
  reducer: (
    state: State,
    payload1: Node1Type,
    payload2: Node2Type,
    payload3: Node3Type,
  ) => State
  children: [
    ActionCreator<Node1Type> | Reducer<Node1Type>,
    Reducer<Node2Type>,
    Reducer<Node3Type>
  ]
}

export function handle(...a) {
  const reducer = a.pop()

  return {
    reducer,
    children: a,
  }
}

export function map<T, State = any>(
  target: Reducer<State>,
  reducer: (state: State) => T,
): Reducer<T> {
  return createReducer(
    `${getName(target)}/map`,
    target._initialState,
    handle(target, (_, state) => reducer(state)),
  )
}

export function combineReducers<T extends { [key in string]: Reducer<any> }>(
  reducersCollection: T,
): Reducer<{ [key in keyof T]: T[key]['_initialState'] }> {
  const keys = Object.keys(reducersCollection)
  const reducers = keys.map(key => reducersCollection[key])
  reducers.push((oldState, ...values) =>
    keys.reduce((acc, key, i) => ((acc[key] = values[i]), acc), {}),
  )

  return createReducer(`{ ${keys.join(', ')} }`, {}, handle(...reducers))
}
