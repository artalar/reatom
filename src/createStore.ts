import { Node, getId } from './graph'
import { Action, ActionCreator, geIsAction } from './createAction'
import { Atom, map, initialAction, geIsAtom } from './createAtom'

export type Store<RootAtom> = {
  dispatch: (
    action: Action<any>,
  ) => RootAtom extends Atom<infer S>
    ? ReturnType<Atom<S>>['root']
    : never
  subscribe: <TargetAtom = RootAtom>(
    listener: (
      state: TargetAtom extends Atom<infer S>
        ? ReturnType<Atom<S>>['root']
        : never,
    ) => any,
    target?: TargetAtom,
  ) => () => void
  getState: <TargetAtom = RootAtom>(
    target?: TargetAtom,
  ) => TargetAtom extends Atom<infer S>
    ? ReturnType<Atom<S>>['root']
    : RootAtom extends Atom<infer S>
    ? ReturnType<Atom<S>>
    : never
}

function collectDepsIds(node: Node, collection: { [key in string]: true }) {
  collection[node.id] = true
  node.edges.forEach(n => collectDepsIds(n, collection))
}

export function createStore<State>(
  atom: Atom<State>,
  preloadedState: State = { flat: {} },
): Store<Atom<State>> {
  const listenersStore = {} as { [key in string]: Set<Function> }
  const listenersActions = {} as { [key in string]: Set<Function> }
  const listenersAll: Set<Function> = new Set()
  // clone deps for future mutations
  // TODO: remove unnecesary `*/map` node
  const localAtom = map(`[store]`, atom, state => state)
  const localNode = localAtom._node as Node
  const { edges } = localNode
  const initialState = localAtom(preloadedState, initialAction())
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

  function getState(target?: Atom<any>) {
    if (target === undefined) {
      actualizeState()
      return state
    }
    if (!geIsAtom(target)) throw new TypeError('Invalid target')

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
    // TODO: remove this check?
    const result = state.flat[targetId]
    return result === undefined ? targetNode.initialState : result
  }

  function subscribe<T>(
    listener: (a: T) => any,
    // @ts-ignore
    target?: Atom<T>,
  ) {
    if (typeof listener !== 'function') throw new TypeError('Invalid listener')

    if (target === undefined) {
      listenersAll.add(listener)
      return () => listenersAll.delete(listener)
    }
    if (!geIsAtom(target)) throw new TypeError('Invalid target')

    const targetNode = target._node as Node
    const targetId = targetNode.id

    const listeners = listenersStore
    let isSubscribed = true

    if (listeners[targetId] === undefined) {
      listeners[targetId] = new Set()
      if (state.flat[targetId] === undefined) {
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
        initialState.flat[targetId] === undefined &&
        listeners[targetId].size === 0
      ) {
        delete listeners[targetId]
        edges.splice(edges.indexOf(targetNode), 1)
        expiredNodes.push(targetNode)
      }
    }
  }

  function dispatch(action: Action<any>) {
    if (
      !(
        typeof action === 'object' &&
        action !== null &&
        typeof action.type === 'string'
      )
    ) {
      throw new TypeError('Invalid action')
    }
    try {
      let flatNew = {}
      const newState = localAtom(state, action, (flat, _flatNew) =>
        Object.assign({}, flat, (flatNew = _flatNew)),
      )

      if (newState !== state) {
        const oldFlat = state.flat
        state = newState

        actualizeState(false)

        for (const id in flatNew) {
          if (oldFlat[id] === flatNew[id]) continue

          const subscribersById = listenersStore[id]

          if (subscribersById === undefined) continue
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
    } catch (e) {
      errors.push(e)
      console.error(e)
    }

    listenersAll.forEach(listener => {
      try {
        listener(state, action)
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

  // TODO: add `observable`
  return {
    subscribe,
    getState,
    dispatch,
    _getErrors: getErrors,
    _node: localNode,
  }
}

export { getId }
