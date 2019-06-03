// FIXME: replace ACTION to EVENT
import { Store, Reducer, getId, Action, asId, getName } from '../../src/model'
import { getState as _getState, map } from '../../src/createReducer'

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
}

export function createStore<State>(
  reducer: Reducer<State>,
  preloadedState: State = null,
): Store<Reducer<State>> {
  const listenersStore = {} as { [key in string]: Set<Function> }
  const listenersEvents = {} as { [key in string]: Set<Function> }
  // clone deps for future mutations
  // TODO: remove unnecesary `*/map` node
  const localReducer = map(
    asId(getName(reducer) + ' [store]'),
    reducer,
    state => state,
  )
  const initialState = localReducer(preloadedState, {
    type: '@@INIT',
    payload: null,
  })
  let state = initialState
  let errors = [] as any

  function getState(target?: Reducer<any>) {
    if (target === undefined) return state
    if (!is.reducer(target)) throw new TypeError('Invalid target')
    return _getState(state, target)
  }

  function subscribe<T>(
    listener: (a: T) => any,
    // TODO: subscribe to ALL events? :think:
    // @ts-ignore
    target: Reducer<T> = localReducer,
  ) {
    if (typeof listener !== 'function') throw new TypeError('Invalid listener')

    const targetId = getId(target)

    if (targetId === null) throw new TypeError('Invalid target')

    const isEvent = is.event(target)
    const listeners = isEvent ? listenersEvents : listenersStore
    let isSubscribed = true

    if (listeners[targetId] === undefined) {
      listeners[targetId] = new Set()
      if (!isEvent && state.flat[targetId] === undefined) {
        const {
          _types,
          _node: { _children },
        } = localReducer
        _children.push(target._node)
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
        const { _children } = localReducer._node
        delete listeners[targetId]
        _children.splice(_children.indexOf(target._node), 1)
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
      const newState = localReducer(state, event)

      if (newState !== state) {
        state = newState

        state.changes!.forEach((id: string) => {
          const subscribersById = listenersStore[id]
          if (subscribersById !== undefined) {
            subscribersById.forEach(listener => {
              try {
                listener(state.flat[id])
              } catch (e) {
                errors.push(e)
                console.error(e)
              }
            })
          }
        })
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
  }
}
