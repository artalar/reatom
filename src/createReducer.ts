import {
  Action,
  Reducer,
  ActionCreator,
  Ctx,
  ID,
  NAME,
  DEPS,
  DEPTH,
  NODES,
  HANDLER,
  INITIAL_STATE,
  DEPS_REDUCERS,
  noop,
  combineNodes,
  createId,
  getName,
} from './model.ts'
import { createAction } from './createAction.ts'

const initialAction = createAction<'@@/init'>('initialAction', () => '@@/init')

export function createReducer<State>(
  name: string,
  initialState: State,
  ..._matchers: {
    (state: State, ...a: any[]): State
    [NODES]: any[]
  }[]
): Reducer<State, []> {
  const id = createId(name, 'reducer')

  var handlers = _matchers as {
    (state: State, ...a: any[]): State
    [NODES]: (ActionCreator<any> | Reducer<any, any>)[]
  }[]

  handlers.unshift(
    handle(initialAction, state =>
      state === undefined ? initialState : state,
    ),
  )

  const { [DEPS]: deps, [DEPTH]: depth } = combineNodes(
    handlers.map(reducer => {
      const nodes = reducer[NODES]

      // TODO: throw?
      if (nodes === undefined) combineNodes([], noop, id)

      // TODO: improve checks
      const isActionInDeps = nodes[0][DEPS_REDUCERS] === undefined

      function handler(ctx: Ctx) {
        const isInit = !(id in ctx.flat)
        const oldState = isInit ? initialState : (ctx.flat[id] as State)
        const args = [oldState]
        let hasDependenciesChanged = false

        nodes.forEach(node => {
          const nodeId = node[ID]
          const nodeStateNew = ctx.flatNew[node[ID]]
          const nodeStateOld = ctx.flat[node[ID]]

          args.push(nodeId in ctx.flatNew ? nodeStateNew : nodeStateOld)

          hasDependenciesChanged =
            isActionInDeps ||
            (hasDependenciesChanged
              ? hasDependenciesChanged
              : // what if `nodeStateNew === undefined`? :hmm:
                nodeStateNew !== nodeStateOld)
        })

        if (hasDependenciesChanged || isInit) {
          const newState: State = reducer.apply(null, args)
          ctx.flatNew[id] = newState
          if (oldState !== newState) ctx.changes.push(id)
        }
      }

      return combineNodes(nodes, handler, id)
    }),
    noop,
    id,
  )

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
      type = initialAction.type
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
  reducer[HANDLER] = noop
  reducer[INITIAL_STATE] = initialState
  // TODO: add deps reducers for best type infer
  reducer[DEPS_REDUCERS] = []

  return reducer
}

export function getState<R extends Reducer<any, any>>(
  state: { flat?: { [key in typeof ID]: any } },
  reducer: R,
): R[typeof INITIAL_STATE] {
  const id = reducer[ID]
  if (id in (state.flat || {})) return state.flat[id]
  return reducer[INITIAL_STATE]
}

export function handle<Node1Type, State = any>(
  dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type, any>,
  reducer: (state: State, payload1: Node1Type) => State,
): {
  (state: State, payload1: Node1Type): State
  [NODES]: [ActionCreator<Node1Type> | Reducer<Node1Type, any>]
}
export function handle<Node1Type, Node2Type, State = any>(
  dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type, any>,
  dependedReducer1: Reducer<Node2Type, any>,
  reducer: (state: State, payload1: Node1Type, payload2: Node2Type) => State,
): {
  (state: State, payload1: Node1Type, payload2: Node2Type): State
  [NODES]: [
    ActionCreator<Node1Type> | Reducer<Node1Type, any>,
    Reducer<Node2Type, any>
  ]
}
export function handle<Node1Type, Node2Type, Node3Type, State = any>(
  dependedActionOrReducer1: ActionCreator<Node1Type> | Reducer<Node1Type, any>,
  dependedReducer1: Reducer<Node2Type, any>,
  dependedReducer2: Reducer<Node3Type, any>,
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
    ActionCreator<Node1Type> | Reducer<Node1Type, any>,
    Reducer<Node2Type, any>,
    Reducer<Node3Type, any>
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
  target: Reducer<State, any>,
  reducer: (state: State) => T,
): Reducer<T, []> {
  return createReducer(
    `${getName(target)}/map`,
    target[INITIAL_STATE],
    handle(target, (_, state) => reducer(state)),
  )
}

export function combineReducers<
  T extends { [key in string]: Reducer<any, any> }
>(
  reducersCollection: T,
): Reducer<{ [key in keyof T]: T[key][typeof INITIAL_STATE] }, []> {
  const keys = Object.keys(reducersCollection)
  const reducers = keys.map(key => reducersCollection[key])

  return createReducer(
    keys.join(' + '),
    {},
    handle.apply(null, [
      ...reducers,
      (oldState, ...values) =>
        keys.reduce(
          (acc, key, i) => Object.assign(acc, { [key]: values[i] }),
          {},
        ),
    ]),
  )
}
