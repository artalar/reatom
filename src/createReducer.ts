import {
  Node,
  Action,
  Reducer,
  ActionCreator,
  Ctx,
  ID,
  NAME,
  DEPS,
  DEPTH,
  INITIAL_STATE,
  noop,
  combineNodes,
  createId,
  getName,
  getId,
} from './model'
import { createAction } from './createAction'

export const NODES = Symbol('@@/NODES')

const initialAction = createAction<'@@/init'>('initialAction', () => '@@/init')
const initialActionType = getId(initialAction)

export function createReducer<State>(
  name: string,
  initialState: State,
  ...handlers: {
    (state: State, ...a: any[]): State
    [NODES]: Node[]
  }[]
): Reducer<State> {
  const id = createId(name, 'reducer')

  handlers.unshift(
    handle(initialAction, state =>
      state === undefined ? initialState : state,
    ),
  )

  const { [DEPS]: deps, [DEPTH]: depth } = combineNodes({
    id,
    name,
    nodes: handlers.map(reducer => {
      const nodes = reducer[NODES]

      // TODO: throw?
      if (nodes === undefined) {
        return combineNodes({
          nodes: [],
          id,
          name,
        })
      }

      // TODO: improve checks
      const isActionInDeps = !(INITIAL_STATE in nodes[0])

      function handler(ctx: Ctx) {
        const isInit = !(id in ctx.flat)
        const oldState = isInit ? initialState : (ctx.flat[id] as State)
        const args = [oldState]
        let hasDependenciesChanged = isActionInDeps || isInit

        nodes.forEach(node => {
          const nodeId = node[ID]
          const nodeStateNew = ctx.flatNew[node[ID]]
          const nodeStateOld = ctx.flat[node[ID]]

          args.push(nodeId in ctx.flatNew ? nodeStateNew : nodeStateOld)

          hasDependenciesChanged =
            hasDependenciesChanged ||
            // what if `nodeStateNew === undefined`? :hmm:
            nodeStateNew !== nodeStateOld
        })

        if (hasDependenciesChanged) {
          const newState = reducer.apply(null, args)
          ctx.flatNew[id] = newState
          if (oldState !== newState) ctx.changes.push(id)
        }
      }

      return combineNodes({
        id,
        name,
        nodes,
        handler,
      })
    }),
  })

  function reducer(
    state: {
      root?: State
      flat?: Ctx['flat']
    } | null,
    action: Action<any>,
  ): {
    root: State
    flat: Ctx['flat']
    changes: Ctx['changes']
  } {
    let { type, payload } = action
    let handlersOrdered = deps[type]

    if (handlersOrdered === undefined) {
      type = initialActionType
      payload = undefined
      handlersOrdered = deps[type]
    }

    const { flat = {} } = state || {}
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

    if (ctx.changes.length === 0) {
      return {
        flat,
        root: flat[id] as State,
        changes,
      }
    }

    delete flatNew[type]

    return {
      // TODO: without combineReducers user may change child, but not change parent :hmm:
      root: flatNew[id] as State,
      flat: Object.assign({}, flat, flatNew),
      changes,
    }
  }

  reducer[ID] = id
  reducer[NAME] = name
  reducer[DEPS] = deps
  reducer[DEPTH] = depth
  reducer[INITIAL_STATE] = initialState

  return reducer
}

export function getState<R extends Reducer<any>>(
  state: { flat?: { [key in typeof ID]: any } },
  reducer: R,
): R[typeof INITIAL_STATE] {
  const id = reducer[ID]
  if (id in (state.flat || {})) return state.flat[id]
  return reducer[INITIAL_STATE]
}

export function handle<Node1Type, State = any>(
  dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type>,
  reducer: (state: State, payload1: Node1Type) => State,
): {
  (state: State, payload1: Node1Type): State
  [NODES]: [ActionCreator<Node1Type> | Reducer<Node1Type>]
}
export function handle<Node1Type, Node2Type, State = any>(
  dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type>,
  dependedReducer1: Reducer<Node2Type>,
  reducer: (state: State, payload1: Node1Type, payload2: Node2Type) => State,
): {
  (state: State, payload1: Node1Type, payload2: Node2Type): State
  [NODES]: [ActionCreator<Node1Type> | Reducer<Node1Type>, Reducer<Node2Type>]
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
  (
    state: State,
    payload1: Node1Type,
    payload2: Node2Type,
    payload3: Node3Type,
  ): State
  [NODES]: [
    ActionCreator<Node1Type> | Reducer<Node1Type>,
    Reducer<Node2Type>,
    Reducer<Node3Type>
  ]
}

export function handle(...a) {
  const reducer = a.pop()
  const nodes = a
  reducer[NODES] = nodes

  return reducer
}

// EXPERIMENTAL

export function map<T, State = any>(
  target: Reducer<State>,
  reducer: (state: State) => T,
): Reducer<T> {
  return createReducer(
    `${getName(target)}/map`,
    target[INITIAL_STATE],
    handle(target, (_, state) => reducer(state)),
  )
}

export function combineReducers<T extends { [key in string]: Reducer<any> }>(
  reducersCollection: T,
): Reducer<{ [key in keyof T]: T[key][typeof INITIAL_STATE] }> {
  const keys = Object.keys(reducersCollection)
  const reducers = keys.map(key => reducersCollection[key])

  return createReducer(
    `{ ${keys.join(', ')} }`,
    {},
    handle.apply(null, [
      ...reducers,
      (oldState, ...values) =>
        keys.reduce((acc, key, i) => ((acc[key] = values[i]), acc), {}),
    ]),
  )
}
