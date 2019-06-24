import { Ctx, Node, traverse, getId } from './graph'
import { Action, ActionCreator, createAction } from './createAction'

export const initialAction = createAction('@@/init')
const initialActionType = initialAction.getType()

export type Atom<State> = (
  state: { flat: Ctx['flat'] },
  action: Action<any>,
) => { root: State; flat: Ctx['flat'] }


const IS_ATOM = Symbol('@@FLAXOM/IS_ATOM')
export function geIsAtom(target) {
  return target && target[IS_ATOM] === true
}

export function createAtom<State, Name extends string = string>(
  name: Name,
  initialState: State,
  handlersCollector: (
    handle: <D extends ActionCreator<any, any> | Atom<any>>(
      dependencies: D,
      reducer: (
        state: State,
        payload: D extends ActionCreator<infer T>
          ? T
          : D extends Atom<infer T>
          ? T
          : never,
      ) => State,
    ) => any,
  ) => any,
): Atom<State> {
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
      `${id} [handler]`,
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

  function atom(
    state: { flat: Ctx['flat'] },
    action: Action<any>,
    merger: (flat: Object, flatNew: Object) => Object = (flat, flatNew) =>
      Object.assign({}, flat, flatNew),
  ): {
    root: State
    flat: Ctx['flat']
  } {
    const { flat } = state
    const { type, payload } = action
    const flatNew = {}
    const ctx: Ctx = {
      type,
      payload,
      flat,
      flatNew,
      visited: {},
    }

    if (_node.deps[type] !== 0 && !_node.edges.some(n => n.match(ctx))) {
      if (flat[id] !== undefined) return state
      ctx.type = initialActionType
      ctx.payload = undefined
    }

    traverse(_node, ctx)

    delete flatNew[ctx.type]

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

  atom._node = _node
  atom[IS_ATOM] = true

  return atom
}

export function getState<R extends Atom<any>>(
  state: { flat: { [key in string]: any } },
  atom: R,
): R extends Atom<infer T> ? T : never {
  const atomState = state.flat[getId(atom)]
  if (atomState === undefined) return atom._node.initialState
  return atomState
}

export function map<T, State = any>(
  target: Atom<State>,
  reducer: (state: State) => T,
): Atom<T>
export function map<T, State = any>(
  id: string,
  target: Atom<State>,
  reducer: (state: State) => T,
): Atom<T>

export function map() {
  let id, target, reducer
  if (arguments.length === 2) {
    id = getId(arguments[0]) + ' [map]'
    target = arguments[0]
    reducer = arguments[1]
  } else {
    id = arguments[0] + ' [map]'
    target = arguments[1]
    reducer = arguments[2]
  }
  return createAtom(id, reducer(target._node.initialState), h =>
    h(target, (_, state) => reducer(state)),
  )
}

export function combine<T extends { [key in string]: Atom<any> }>(
  atomsCollection: T,
): Atom<{ [key in keyof T]: T[key] extends Atom<infer S> ? S : T[key] }>
export function combine<T extends { [key in string]: Atom<any> }>(
  id: string,
  atomsCollection: T,
): Atom<{ [key in keyof T]: T[key] extends Atom<infer S> ? S : T[key] }>

export function combine() {
  const withName = arguments.length === 2
  const atomsCollection = withName ? arguments[1] : arguments[0]
  const keys = Object.keys(atomsCollection)
  const name = withName ? arguments[0] : `{ ${keys.join(', ')} } [combine]`

  return createAtom(
    name,
    keys.reduce(
      (acc, key) => (
        (acc[key] = atomsCollection[key]._node.initialState), acc
      ),
      {},
    ),
    h =>
      keys.map(key =>
        h(atomsCollection[key], (state, payload) =>
          Object.assign({}, state, {
            [key]: payload,
          }),
        ),
      ),
  )
}
