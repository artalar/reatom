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

function match(...a) {
  const reducer = a.pop()
  const nodes = a

  return { reducer, nodes }
}

export function createReducer<State>(
  name: string,
  initialState: State,
  matcher: <
    Node1 extends ActionCreator<any> | Reducer<any>,
    Node2 extends Reducer<any>
  >(
    match:
      | ((
          dependedActionOrReducer1: Node1,
          reducer: (state: State, payload1: Node1[typeof TYPE]) => State,
        ) => {
          reducer: (state: State, payload1: Node1[typeof TYPE]) => State
          nodes: [Node1]
          1: true
        })
      | ((
          dependedActionOrReducer1: Node1,
          dependedReducer1: Node2,
          reducer: (
            state: State,
            payload1: Node1[typeof TYPE],
            payload2: Node2[typeof TYPE],
          ) => State,
        ) => {
          reducer: (
            state: State,
            payload1: Node1[typeof TYPE],
            payload2: Node2[typeof TYPE],
          ) => State
          nodes: [Node1, Node2]
          2: true
        }),
  ) => (
    | {
        reducer: (state: State, payload1: Node1[typeof TYPE]) => State
        nodes: [Node1]
        1: true
      }
    | {
        reducer: (
          state: State,
          payload1: Node1[typeof TYPE],
          payload2: Node2[typeof TYPE],
        ) => State
        nodes: [Node1, Node2]
        2: true
      })[] = () => [],
) {
  const id = createId(name, 'reducer')

  const matchers = matcher(match)

  matchers.unshift(match(initialAction, () => initialState))

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
