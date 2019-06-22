// FIXME: replace ACTION to EVENT
import { Node, getId } from './graph'
import { Action, ActionCreator } from './createAction'
import { Reducer, map, initialAction } from './createReducer'

export type Store<RootReducer> = {
  dispatch: (
    action: Action<any>,
  ) => RootReducer extends Reducer<infer S>
    ? ReturnType<Reducer<S>>['root']
    : never
  subscribe: <TargetReducer = RootReducer>(
    listener: (
      state: TargetReducer extends Reducer<infer S>
        ? ReturnType<Reducer<S>>['root']
        : never,
    ) => any,
    target?: TargetReducer,
  ) => () => void
  getState: <TargetReducer = RootReducer>(
    target?: TargetReducer,
  ) => TargetReducer extends Reducer<infer S>
    ? ReturnType<Reducer<S>>['root']
    : RootReducer extends Reducer<infer S>
    ? ReturnType<Reducer<S>>
    : never
  replaceReducer: <
    RNew extends RootReducer extends Reducer<infer S> ? Reducer<S> : never
  >(
    reducer: RNew,
  ) => Store<RNew>
}

const is = {
  reducer(target: Reducer<any> | any) {
    // FIXME:
    return true
  },
  event(target: ActionCreator<any> | any) {
    // FIXME:
    return false
  },
}

function collectDepsIds(node: Node, collection: { [key in string]: true }) {
  collection[node.id] = true
  node.edges.forEach(n => collectDepsIds(n, collection))
}

export function createStore<State>(
  reducer: Reducer<State>,
  preloadedState: State = { flat: {} },
): Store<Reducer<State>> {
  const listenersStore = {} as { [key in string]: Set<Function> }
  const listenersEvents = {} as { [key in string]: Set<Function> }
  const listenersAll: Set<Function> = new Set()
  // clone deps for future mutations
  // TODO: remove unnecesary `*/map` node
  const localReducer = map(`[store]`, reducer, state => state)
  const localNode = localReducer._node as Node
  const { edges } = localNode
  const initialState = localReducer(preloadedState, initialAction())
  const expiredNodes: Node[] = []
  let state = initialState
  let isStateCanBeMutating = false
  let errors: any[] = []

  function ensureCanMutateState() {
    if (isStateCanBeMutating) return

    state = {
      root: state.root,
      flat: Object.assign({}, state.flat),
    }
    isStateCanBeMutating = true
  }

  function actualizeState(immutable = true) {
    if (expiredNodes.length === 0) return

    if (immutable) {
      state = {
        flat: Object.assign({}, state.flat),
        root: state.flat[localNode.id],
      }
      isStateCanBeMutating = true
    }

    const depsIds = {} as { [key in string]: true }
    collectDepsIds(localNode, depsIds)

    function deleteEdges({ id, edges }: Node) {
      if (depsIds[id] === undefined) delete state.flat[id]
      edges.forEach(deleteEdges)
    }

    let node
    while ((node = expiredNodes.pop())) deleteEdges(node)
  }

  function getState(target?: Reducer<any>) {
    if (arguments.length === 0) {
      actualizeState()
      return state
    }
    if (!is.reducer(target)) throw new TypeError('Invalid target')

    const targetNode = target._node as Node
    const targetId = targetNode.id
    const isLazy = initialState.flat[targetId] === undefined
    if (isLazy) {
      actualizeState()

      const targetState = state.flat[targetId]
      const isExist = targetState !== undefined
      return isExist
        ? targetState
        : // TODO: improve perf
          target(state, initialAction(), () => null).root
    }
    const result = state.flat[targetId]
    return result === undefined ? targetNode.initialState : result
  }

  function subscribe<T>(
    listener: (a: T) => any,
    // TODO: subscribe to ALL events? :think:
    // @ts-ignore
    target?: Reducer<T>,
  ) {
    if (typeof listener !== 'function') throw new TypeError('Invalid listener')

    if (arguments.length === 1) {
      listenersAll.add(listener)
      return () => listenersAll.delete(listener)
    }

    const targetNode = target._node as Node
    const targetId = targetNode.id

    const isEvent = is.event(target)
    const listeners = isEvent ? listenersEvents : listenersStore
    let isSubscribed = true

    if (listeners[targetId] === undefined) {
      listeners[targetId] = new Set()
      if (!isEvent && state.flat[targetId] === undefined) {
        actualizeState()
        ensureCanMutateState()
        target(state, initialAction(), (flat, flatNew) => {
          Object.assign(state.flat, flatNew)
        })
        edges.push(targetNode)
      }
    }

    listeners[targetId].add(listener)

    return () => {
      if (!isSubscribed) return
      isSubscribed = false

      listeners[targetId].delete(listener)

      if (
        !isEvent &&
        initialState.flat[targetId] === undefined &&
        listeners[targetId].size === 0
      ) {
        delete listeners[targetId]
        edges.splice(edges.indexOf(targetNode), 1)
        expiredNodes.push(targetNode)
      }
    }
  }

  function dispatch(event: Action<any>) {
    if (
      !(
        typeof event === 'object' &&
        event !== null &&
        typeof event.type === 'string'
      )
    ) {
      throw new TypeError('Invalid event')
    }
    try {
      let flatNew = {}
      const newState = localReducer(state, event, (flat, _flatNew) =>
        Object.assign({}, flat, (flatNew = _flatNew)),
      )

      if (newState !== state) {
        const oldFlat = state.flat
        state = newState

        actualizeState(false)

        for (const id in flatNew) {
          if (oldFlat[id] === flatNew[id]) continue

          const subscribersById = listenersStore[id]
          if (subscribersById !== undefined) {
            subscribersById.forEach(listener => {
              try {
                listener(flatNew[id])
              } catch (e) {
                errors.push(e)
                console.error(e)
              }
            })
          }
        }
      }
    } catch (e) {
      errors.push(e)
      console.error(e)
    }

    const subscribersById = listenersEvents[event.type]
    if (subscribersById !== undefined) {
      subscribersById.forEach(listener => {
        try {
          listener(event)
        } catch (e) {
          errors.push(e)
          console.error(e)
        }
      })
    }

    listenersAll.forEach(listener => {
      try {
        listener(state, event)
      } catch (e) {
        errors.push(e)
        console.error(e)
      }
    })
    errors = []
  }

  function getErrors() {
    console.warn('`getErrors` is experimental API and it will be changed')
    return errors
  }

  // TODO: add `replaceReducer` and `observable`
  return {
    subscribe,
    getState,
    dispatch,
    _getErrors: getErrors,
    _node: localNode,
  }
}

export { getId }
