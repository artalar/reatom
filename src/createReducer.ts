import { Ctx, Node, traverse } from './graph'
import { Action, ActionCreator, createAction } from './createAction'

const initialAction = createAction('@@/init')
const initialActionType = initialAction.getType()

export type Reducer<State> = (
  state: { flat: Ctx['flat'] },
  action: Action<any>,
) => { root: State; flat: Ctx['flat'] }

export function createReducer<State, Name extends string = string>(
  name: Name,
  initialState: State,
  handlersCollector: (
    handle: <D extends ActionCreator<any, any> | Reducer<any>>(
      dependencies: D,
      reducer: (
        state: State,
        payload: D extends ActionCreator<infer T>
          ? T
          : D extends Reducer<infer T>
          ? T
          : never,
      ) => State,
    ) => any,
  ) => any,
): Reducer<State> {
  if (initialState === undefined) {
    throw new TypeError('initialState can not be undefined')
  }
  if (typeof handlersCollector !== 'function') {
    throw new TypeError('Invalid handlersCollector')
  }

  const _node = new Node(
    name,
    function(ctx: Ctx) {
      ctx.visited[this.id] = true
    },
    function(ctx: Ctx) {
      return ctx.visited[this.id] !== true
    },
  )
  const { id } = _node

  _node.initialState = initialState
  handle(initialAction, (state = initialState) => state)
  handlersCollector(handle)

  function handle(dependencies, reducer) {
    if (!dependencies || !(dependencies._node instanceof Node)) {
      throw new TypeError('Invalid dependencies')
    }
    if (typeof reducer !== 'function') {
      throw new TypeError('Invalid reducer')
    }
    const childNode = dependencies._node as Node
    const childId = childNode.id
    const childDeps = childNode.deps
    const childIsAction = typeof dependencies.getType === 'function'

    const node = new Node(
      id,
      function({ flat, flatNew }) {
        const stateNew = flatNew[id]
        const stateOld = flat[id]
        const isInit = stateOld === undefined
        const stateLatest =
          isInit && stateNew === undefined
            ? initialState
            : stateNew === undefined
            ? stateOld
            : stateNew
        const childStateNew = flatNew[childId]
        const childStateOld = flat[childId]
        const childStateChanged = childStateNew !== childStateOld

        if (childStateChanged || childIsAction || isInit) {
          const childState =
            childStateNew === undefined ? childStateOld : childStateNew
          const newState = reducer(stateLatest, childState)

          if (newState === undefined) {
            throw new TypeError("state can't be undefined")
          }

          if (stateLatest === newState && !isInit) return

          flatNew[id] = newState
        }
      },
      function(ctx: Ctx) {
        return this.deps[ctx.type] === 0
      },
    )

    node.deps = childDeps
    node.edges.push(childNode)
    _node.edges.push(node)
    Object.assign(_node.deps, childDeps)
  }

  function reducer(
    state: { flat: Ctx['flat'] },
    action: Action<any>,
    merger: (flat: Object, flatNew: Object) => Object = (flat, flatNew) =>
      Object.assign({}, flat, flatNew),
  ): {
    root: State
    flat: Ctx['flat']
  } {
    const { flat } = state
    let { type, payload } = action

    if (
      _node.deps[type] !== 0 &&
      // can be true for lazy reducer
      !_node.edges.some(n => n.match({ visited: {}, type }))
    ) {
      if (flat[id] !== undefined) return state
      type = initialActionType
      payload = undefined
    }

    const flatNew = {}
    const ctx: Ctx = {
      type,
      payload,
      flat,
      flatNew,
      visited: {},
    }

    traverse(_node, ctx)

    delete flatNew[type]

    let changed = false
    for (let _ in flatNew) {
      changed = true
      break
    }

    if (!changed) return state

    return {
      root: flatNew[id] as State,
      flat: merger(flat, flatNew),
    }
  }

  reducer._node = _node

  return reducer
}

export function getState<R extends Reducer<any>>(
  state: { flat?: { [key in string]: any } },
  reducer: R,
): R['_initialState'] {
  const reducerState = (state || { flat: {} }).flat[reducer._node.id]
  if (reducerState === undefined) return reducer._node.initialState
  return reducerState
}

export function map<T, State = any>(
  target: Reducer<State>,
  reducer: (state: State) => T,
): Reducer<T>
export function map<T, State = any>(
  id: string,
  target: Reducer<State>,
  reducer: (state: State) => T,
): Reducer<T>

export function map(...a) {
  let id, target, reducer
  if (a.length === 2) {
    id = a[0]._node.id + ' [map]'
    target = a[0]
    reducer = a[1]
  } else {
    id = a[0] + ' [map]'
    target = a[1]
    reducer = a[2]
  }
  return createReducer(id, target._node.initialState, h =>
    h(target, (_, state) => reducer(state)),
  )
}

export function combine<T extends { [key in string]: Reducer<any> }>(
  reducersCollection: T,
): Reducer<{ [key in keyof T]: T[key] extends Reducer<infer S> ? S : T[key] }>
export function combine<T extends { [key in string]: Reducer<any> }>(
  id: string,
  reducersCollection: T,
): Reducer<{ [key in keyof T]: T[key] extends Reducer<infer S> ? S : T[key] }>

export function combine(...a) {
  const withName = a.length === 2
  const reducersCollection = withName ? a[1] : a[0]
  const keys = Object.keys(reducersCollection)
  const name = withName ? a[0] : `{ ${keys.join(', ')} } [combine]`

  return createReducer(
    name,
    // keys.reduce(
    //   (acc, key) => (
    //     (acc[key] = getState({ flat: {} }, reducersCollection[key])), acc
    //   ),
    //   {},
    // ),
    {},
    h =>
      keys.map(key =>
        h(reducersCollection[key], (state, payload) => ({
          ...state,
          [key]: payload,
        })),
      ),
  )
}
