import {
  Store,
  Reducer,
  getId,
  Action,
  asId,
  getName,
  isPlainObject,
} from './model'
import { getState as _getState, map } from './createReducer'

// https://github.com/reduxjs/redux/blob/master/index.d.ts
export function createStore<State, Ext>(
  rootReducer: Reducer<State>,
  preloadedState?: State,
): Store<Reducer<State>> & Ext
export function createStore<State, Ext>(
  rootReducer: Reducer<State>,
  preloadedState?: State,
  enhancer?: StoreEnhancer<Ext>,
): Store<Reducer<State>> & Ext
export function createStore(reducer, preloadedState, enhancer) {
  if (
    (typeof preloadedState === 'function' && typeof enhancer === 'function') ||
    (typeof enhancer === 'function' && typeof arguments[3] === 'function')
  ) {
    throw new Error(
      'It looks like you are passing several store enhancers to ' +
        'createStore(). This is not supported. Instead, compose them ' +
        'together to a single function.',
    )
  }

  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState
    preloadedState = undefined
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.')
    }

    return enhancer(createStore)(reducer, preloadedState)
  }

  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.')
  }

  let currentReducer = reducer
  let currentState = preloadedState
  let currentListeners = {} as { [key in string]: Function[] }
  let nextListeners = currentListeners
  let isDispatching = false

  function ensureCanMutateNextListeners(id: string) {
    if (nextListeners[id] === currentListeners[id]) {
      nextListeners[id] = currentListeners[id].slice()
    }
  }

  function getState(target: Reducer<any>) {
    if (isDispatching) {
      throw new Error(
        'You may not call store.getState() while the reducer is executing. ' +
          'The reducer has already received the state as an argument. ' +
          'Pass it down from the top reducer instead of reading it from the store.',
      )
    }
    if (target === undefined) return state
    return _getState(state, target)
  }

  function subscribe<T>(
    listener: (a: T) => any,
    target: Reducer<T> = localReducer,
  ) {
    if (typeof listener !== 'function') {
      throw new Error('Expected the listener to be a function.')
    }

    if (isDispatching) {
      throw new Error(
        'You may not call store.subscribe() while the reducer is executing. ' +
          'If you would like to be notified after the store has been updated, subscribe from a ' +
          'component and invoke store.getState() in the callback to access the latest state. ' +
          'See https://redux.js.org/api-reference/store#subscribe(listener) for more details.',
      )
    }

    const targetId = getId(target)
    let isSubscribed = true

    if (nextListeners[targetId] === undefined) {
      nextListeners[targetId] = []
      if (state.flat[targetId] === undefined) {
        const {
          _types,
          _node: { _children },
        } = localReducer
        // FIXME: ensureCanMutateNextListeners
        _children.push(target._node)
      }
    } else {
      ensureCanMutateNextListeners(targetId)
    }

    nextListeners[targetId].push(listener)

    return () => {
      if (!isSubscribed) {
        return
      }

      if (isDispatching) {
        throw new Error(
          'You may not unsubscribe from a store listener while the reducer is executing. ' +
            'See https://redux.js.org/api-reference/store#subscribe(listener) for more details.',
        )
      }

      ensureCanMutateNextListeners(targetId)
      const index = nextListeners[targetId].indexOf(listener)
      nextListeners[targetId].splice(index, 1)

      if (
        initialState.flat[targetId] === undefined &&
        nextListeners[targetId].length === 0
      ) {
        const { _children } = localReducer._node
        delete nextListeners[targetId]
        // FIXME: ensureCanMutateNextListeners
        _children.splice(_children.indexOf(target._node), 1)
      }
    }
  }

  function dispatch(action: Action<any>) {
    if (!isPlainObject(action)) {
      throw new Error(
        'Actions must be plain objects. ' +
          'Use custom middleware for async actions.',
      )
    }

    if (typeof action.type === 'undefined') {
      throw new Error(
        'Actions may not have an undefined "type" property. ' +
          'Have you misspelled a constant?',
      )
    }

    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.')
    }

    try {
      isDispatching = true
      const newState = localReducer(state, action)
      isDispatching = false

      if (newState !== state) {
        state = newState

        state.changes.forEach(id => {
          const subscribersById = nextListeners[id]
          if (subscribersById !== undefined) {
            subscribersById.forEach(listener => listener(state.flat[id]))
          }
        })
      }

      return action
    } catch (e) {
      isDispatching = false
    }
  }

  // clone deps for future mutations
  // TODO: remove unnecesary `*/map` node
  const localReducer = map(
    asId(getName(reducer) + ' [store]'),
    reducer,
    state => state,
  )
  const initialState = localReducer(preloadedState, { type: '', payload: null })
  let state = initialState

  // FIXME: add `replaceReducer` and `observable`
  return {
    subscribe,
    getState,
    dispatch,
  }
}
