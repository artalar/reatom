import { Store, Reducer, getId, Action } from './model'
import { getState as _getState, map } from './createReducer'

const subscribersEmpty = {
  forEach() {},
}

export function createStore<R extends Reducer<any>>(
  rootReducer: R,
  preloadedState = null,
): Store<R> {
  // clone deps for future mutations
  // FIXME: remove unnecesary `*/map` node
  const localReducer = map(rootReducer, state => state)
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
      subscribers[targetId] = new Set()
    }

    subscribers[targetId].add(listener)

    return () => subscribers[targetId].delete(listener)
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
