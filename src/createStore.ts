import { Store, Reducer, Ctx, combineNodes, createId } from './model'
import { getState, createReducer, handle } from './createReducer'

const EXIT_FLAG = Symbol('@@/EXIT_FLAG')

export function createStore<R extends Reducer<any>>(
  rootReducer: R,
  preloadedState = null,
): Store<R> {
  let currentReducer = rootReducer
  let state = currentReducer(preloadedState, {})

  function handler(oldState) {
    const { changes, flat, flatNew } = this as Ctx
    if (changes.length === 0) throw EXIT_FLAG

    state = {
      root: getState({ flat: flatNew }, rootReducer),
      flat: Object.assign({}, flat, flatNew),
      changes,
    }

    return !oldState
  }

  currentReducer = createReducer(
    'store',
    false,
    handle(currentReducer, handler),
  )

  function _getState(target = rootReducer) {
    return getState(state, target)
  }

  function subscribe(listener, target = rootReducer) {
    currentReducer = createReducer(
      'subscriber',
      false,
      handle(
        currentReducer,
        createReducer(
          'subscriber',
          false,
          handle(target, function(oldState) {
            listener(getState({ flat: this.flatNew }, target))
            return !oldState
          }),
        ),
        state => !state,
      ),
    )

    return () => {}
  }

  function dispatch(action) {
    try {
      currentReducer(state, action)
      return state.root
    } catch (e) {
      if (e === EXIT_FLAG) return state.root
      throw e
    }
  }

  return {
    subscribe,
    getState: _getState,
    dispatch,
  }
}
