import {
  VERTEX,
  TYPE,
  createId,
  Reducer,
  Vertex,
  Action,
  Ctx,
  noop,
  ActionCreator,
  combineVertices,
} from './shared'
import { createAction } from './createAction'

export const initialAction = createAction<'@@/init'>('initialAction')

// type State = number
// function _match<Node1Type>(
//   dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type>,
//   reducer: (state: State, payload1: Node1Type) => State,
// ): {
//   reducer: (state: State, payload1: Node1Type) => State
//   nodes: [ActionCreator<Node1Type> | Reducer<Node1Type>]
// }
// function _match<Node1Type, Node2Type>(
//   dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type>,
//   dependedReducer1: Reducer<Node2Type>,
//   reducer: (state: State, payload1: Node1Type, payload2: Node2Type) => State,
// ): {
//   reducer: (state: State, payload1: Node1Type, payload2: Node2Type) => State
//   nodes: [ActionCreator<Node1Type> | Reducer<Node1Type>, Reducer<Node2Type>]
// }
// function _match(...a) {
//   const reducer = a.pop()
//   const nodes = a

//   return { reducer, nodes }
// }

// declare var _match1: typeof _match
// _match1(initialAction, ((q, w) => 123))

// function f(m: (m: typeof _match) => any): ReturnType<typeof _match>

// var a = f(m => m(initialAction, ((q, w) => 123)))

export function createReducer<State, Dependencies extends ActionCreator<any> | Reducer<any>>(
  name: string,
  initialState: State,
  matcher: (
    match: typeof _match,
  ) => {
    reducer: Function
    nodes: Dependencies[]
  }[] = () => [],
): Reducer<State> {
  function _match<Node1Type>(
    dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type>,
    reducer: (state: State, payload1: Node1Type) => State,
  ): {
    reducer: (state: State, payload1: Node1Type) => State
    nodes: [ActionCreator<Node1Type> | Reducer<Node1Type>]
  }
  function _match<Node1Type, Node2Type>(
    dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type>,
    dependedReducer1: Reducer<Node2Type>,
    reducer: (state: State, payload1: Node1Type, payload2: Node2Type) => State,
  ): {
    reducer: (state: State, payload1: Node1Type, payload2: Node2Type) => State
    nodes: [ActionCreator<Node1Type> | Reducer<Node1Type>, Reducer<Node2Type>]
  }
  function _match<Node1Type, Node2Type, Node3Type>(
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
    nodes: [
      ActionCreator<Node1Type> | Reducer<Node1Type>,
      Reducer<Node2Type>,
      Reducer<Node3Type>
    ]
  }
  function _match<Node1Type, Node2Type, Node3Type, Node4Type>(
    dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type>,
    dependedReducer1: Reducer<Node2Type>,
    dependedReducer2: Reducer<Node3Type>,
    dependedReducer3: Reducer<Node4Type>,
    reducer: (
      state: State,
      payload1: Node1Type,
      payload2: Node2Type,
      payload3: Node3Type,
      payload4: Node4Type,
    ) => State,
  ): {
    reducer: (
      state: State,
      payload1: Node1Type,
      payload2: Node2Type,
      payload3: Node3Type,
      payload4: Node4Type,
    ) => State
    nodes: [
      ActionCreator<Node1Type> | Reducer<Node1Type>,
      Reducer<Node2Type>,
      Reducer<Node3Type>,
      Reducer<Node4Type>
    ]
  }

  function _match(...a) {
    const reducer = a.pop()
    const nodes = a

    return { reducer, nodes }
  }

  const id = createId(name, 'reducer')

  const matchers = matcher(_match)

  matchers.unshift(_match(initialAction, () => initialState))

  const { deps, depth } = combineVertices(
    matchers.map(matcher => {
      const { reducer, nodes } = matcher
      const vertices: Vertex[] = nodes.map(n => n[VERTEX])

      function handler(ctx: Ctx) {
        const isInit = !(id in ctx.flat)
        const oldState = isInit ? initialState : ctx.flat[id]
        const args = [oldState]
        let hasDependenciesChanged = false

        vertices.forEach(v => {
          args.push(v.id in ctx.flatNew ? ctx.flatNew[v.id] : ctx.flat[v.id])
          hasDependenciesChanged = hasDependenciesChanged
            ? hasDependenciesChanged
            : ctx.flatNew[v.id] !== ctx.flat[v.id]
        })

        if (hasDependenciesChanged || isInit) {
          const newState: State = reducer.apply(null, args)
          ctx.flatNew[id] = newState
          if (oldState !== newState) ctx.changes.push(id)
        }
      }

      return combineVertices(vertices, handler, id)
    }),
    noop,
    id,
  )

  function reducer(
    state: {
      root?: State
      flat?: Ctx['flat']
      changes?: Ctx['changes']
    },
    action: Action<any>,
  ): {
    root?: State
    flat?: Ctx['flat']
    changes?: Ctx['changes']
  } {
    const { type, payload } = action
    const handlersOrdered = deps[type]

    if (handlersOrdered === undefined) return state

    const { flat = {} } = state
    const changes: Ctx['changes'] = []
    const flatNew = {}
    const ctx: Ctx = Object.assign(
      { type, payload },
      {
        changes,
        flat,
        flatNew,
      },
    )

    for (let depthCurrent = 0; depthCurrent <= depth; depthCurrent++) {
      const handlers = handlersOrdered[depthCurrent]
      if (handlers !== undefined) handlers.forEach(handler => handler(ctx))
    }

    if (ctx.changes.length === 0) return state

    return {
      // FIXME: without combineReducers user may change child, but not change parent
      root: flatNew[id] as State,
      flat: Object.assign({}, flat, flatNew),
      changes,
    }
  }

  reducer[VERTEX] = { id, deps, depth, handler: noop }

  return reducer
}

type MapIds<List extends {}[]> = { [K in keyof List[keyof List]]: List[K] }

function createNode<State>(name: string) {
  let _initialState: State
  const matchers = [{ reducer: () => _initialState, nodes: [initialAction] }]

  function _default(
    initialState: State,
  ): {
    _state: State
    _nodes: (ActionCreator<any> | Reducer<any>)[]
  } {
    _initialState = initialState
    return {} as {
      _state: State
      _nodes: (ActionCreator<any> | Reducer<any>)[]
    }
  }

  function _case<Node1>(
    dependedActionOrReducer1: ActionCreator<Node1> | Reducer<Node1>,
    reducer: (state: State, payload: Node1) => State,
  ): {
    case: typeof _case
    default: typeof _default
    _state: State
    _nodes: [Node1]
  }

  function _case<Node1, Node2>(
    dependedActionOrReducer1: ActionCreator<Node1> | Reducer<Node1>,
    dependedReducer2: Reducer<Node2>,
    reducer: (state: State, payload1: Node1, payload2: Node2) => State,
  ): {
    case: typeof _case
    default: typeof _default
    _state: State
    _nodes: [Node1, Node2]
  }

  function _case(...a) {
    const reducer = a.pop()
    const nodes = a

    matchers.push({ reducer, nodes })

    return switcher
  }

  const switcher = {
    case: _case,
    default: _default,
  }

  return switcher
}

const a = createNode<number>('test')
  .case(initialAction, (state, payload) => 123)
  .default(123)
