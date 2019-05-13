import {
  Store,
  Reducer,
  Ctx,
  noop,
  createId,
  getId,
  combineNodes,
  Action,
  disunitNode,
} from './model'
import {
  getState as _getState,
  createReducer,
  handle,
  map,
  getDeps,
  getDepth,
} from './createReducer'

const subscribersEmpty = {
  forEach: noop,
}

export function createStore<R extends Reducer<any>>(
  rootReducer: R,
  preloadedState = null,
): Store<R> {
  // clone deps for future mutations
  // FIXME: remove unnecesary `*/map` node
  const localReducer = map(rootReducer, state => state)
  const deps = getDeps(localReducer)
  const subscribers = {} as { [key in string]: Set<Function> }
  const initialState = localReducer(preloadedState, { type: '', payload: null })
  let state = initialState

  function getState(target = localReducer) {
    return _getState(state, target)
  }

  // FIXME: beter naming
  function getStateInternal() {
    return state
  }

  function subscribe<T>(
    listener: (a: T) => any,
    target: Reducer<T> = localReducer,
  ) {
    const targetId = getId(target)
    if (subscribers[targetId] === undefined) {
      if (
        targetId in initialState.flat &&
        getDepth(target) > getDepth(localReducer)
      ) {
        throw new Error(
          'Can not subscribe to reducer thats includes root reducer',
        )
      }
      subscribers[targetId] = new Set()
    }

    subscribers[targetId].add(listener)

    if (targetId in initialState.flat) {
      return () => subscribers[targetId].delete(listener)
    }
    // else
    combineNodes({
      nodes: [target],
      deps: deps,
      id: '',
      name: '',
    })
    return () => {
      subscribers[targetId].delete(listener)
      disunitNode(localReducer, target)
    }
  }

  function dispatch(action: Action<any>) {
    const newState = localReducer(state, action)
    if (newState !== state) {
      state = newState

      state.changes.forEach(id =>
        (subscribers[id] || subscribersEmpty).forEach(listener =>
          listener(state.flat[id]),
        ),
      )
    }
    return state.root
  }

  return {
    subscribe,
    getState,
    dispatch,
    getStateInternal,
  }
}
