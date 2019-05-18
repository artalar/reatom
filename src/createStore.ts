import { Store, Reducer, getId, Action, asId, getName } from './model'
import { getState as _getState, map } from './createReducer'

// FIXME: add middleware
export function createStore<R extends Reducer<any>>(
  rootReducer: R,
  preloadedState = null,
): Store<R> {
  // clone deps for future mutations
  // TODO: remove unnecesary `*/map` node
  const localReducer = map(
    asId(getName(rootReducer) + ' [store]'),
    rootReducer,
    state => state,
  )
  const subscribers = {} as { [key in string]: Set<Function> }
  const initialState = localReducer(preloadedState, { type: '', payload: null })
  let state = initialState

  function getState(target: Reducer<any>) {
    if (target === undefined) return state
    return _getState(state, target)
  }

  // FIXME: add ensureCanMutateNextListeners
  function subscribe<T>(
    listener: (a: T) => any,
    target: Reducer<T> = localReducer,
  ) {
    const targetId = getId(target)
    let subscribersById = subscribers[targetId]

    if (subscribersById === undefined) {
      subscribersById = subscribers[targetId] = new Set()
      if (state.flat[targetId] === undefined) {
        const {
          _types,
          _node: { _children },
        } = localReducer
        _children.push(target._node)
      }
    }

    subscribersById.add(listener)

    if (initialState.flat[targetId] === undefined) {
      return () => {
        subscribersById.delete(listener)
        if (subscribersById.size === 0) {
          const { _children } = localReducer._node
          delete subscribers[targetId]
          _children.splice(_children.indexOf(target._node), 1)
        }
      }
    }

    return () => subscribersById.delete(listener)
  }

  function dispatch(action: Action<any>) {
    const newState = localReducer(state, action)
    if (newState !== state) {
      state = newState

      state.changes.forEach(id => {
        const subscribersById = subscribers[id]
        if (subscribersById !== undefined) {
          subscribersById.forEach(listener => listener(state.flat[id]))
        }
      })
    }
    return state.root
  }

  // FIXME: add replaceReducer
  return {
    subscribe,
    getState,
    dispatch,
  }
}
