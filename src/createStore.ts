// FIXME: replace ACTION to EVENT
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

export function createStore<State>(
  reducer: Reducer<State>,
  preloadedState: State = { flat: {} },
): Store<Reducer<State>> {
  const listenersStore = {} as { [key in string]: Set<Function> }
  const listenersEvents = {} as { [key in string]: Set<Function> }
  // clone deps for future mutations
  // TODO: remove unnecesary `*/map` node
  const localReducer = map(reducer, state => state)
  const initialState = localReducer(preloadedState, {
    type: '@@/init',
    payload: null,
  })
  const expiredIds: string[] = []
  let state = initialState
  let errors: any[] = []

  function actualizeState(immutable = true) {
    if (expiredIds.length === 0) return

    if (immutable)
      state = {
        flat: { ...state.flat },
        root: state.flat[localReducer._node.id],
      }

    let id
    while ((id = expiredIds.pop())) delete state.flat[id]
  }

  function getState(target?: Reducer<any>) {
    if (arguments.length === 0) return state
    if (!is.reducer(target)) throw new TypeError('Invalid target')

    const targetId = target._node.id
    const isLazy = initialState.flat[targetId] === undefined
    if (isLazy) {
      actualizeState()

      const targetState = state.flat[targetId]
      const isExist = targetState !== undefined
      return isExist
        ? targetState
        // TODO: improve perf
        : target(state, initialAction(), () => null).root
    }
    const result = state.flat[targetId]
    return result === undefined ? target._node.initialState : result
  }

  function subscribe<T>(
    listener: (a: T) => any,
    // TODO: subscribe to ALL events? :think:
    // @ts-ignore
    target: Reducer<T> = localReducer,
  ) {
    if (typeof listener !== 'function') throw new TypeError('Invalid listener')

    const targetId = target._node.id

    if (targetId === null) throw new TypeError('Invalid target')

    const isEvent = is.event(target)
    const listeners = isEvent ? listenersEvents : listenersStore
    let isSubscribed = true

    if (listeners[targetId] === undefined) {
      listeners[targetId] = new Set()
      if (!isEvent && state.flat[targetId] === undefined) {
        localReducer._node.edges.push(target._node)
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
        const { edges } = localReducer._node
        delete listeners[targetId]
        edges.splice(edges.indexOf(target._node), 1)
        expiredIds.push(targetId)
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
      const newState = localReducer(state, event, (flat, _flatNew) => ({
        ...flat,
        ...(flatNew = _flatNew),
      }))

      if (newState !== state) {
        state = newState

        actualizeState(false)

        for (const id in flatNew) {
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
