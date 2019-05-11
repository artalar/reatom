import {
  Store,
  Reducer,
  Ctx,
  noop,
  createId,
  getId,
  combineNodes,
} from './model'
import { getState as _getState, createReducer, handle } from './createReducer'

const subscribersEmpty = {
  forEach: noop,
}

export function createStore<R extends Reducer<any>>(
  rootReducer: R,
  preloadedState = null,
): Store<R> {
  let state = rootReducer(preloadedState, { type: '', payload: null })
  const subscribers = {}

  function getState(target = rootReducer) {
    return _getState(state, target)
  }

  function subscribe(listener, target = rootReducer) {
    const targetId = getId(target)
    if (subscribers[targetId] === undefined) subscribers[targetId] = new Set()
    subscribers[targetId].add(listener)

    return () => {
      subscribers[targetId].delete(listener)
    }
  }

  function dispatch(action) {
    const newState = rootReducer(state, action)
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
  }
}
