import { Path, Ctx, map, actionDefault, readStateByPath } from './next'

export type Store<RootAtom> = {
  dispatch: (
    action: Action<any>,
  ) => RootAtom extends Atom<infer S> ? ReturnType<Atom<S>>['root'] : never
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

class CtxWithTrack extends Ctx {
  changes?: { [key in string]: any }
  write(path: Path, value: any) {
    super.write(path, value)
    if (!this.changes) this.changes = {}
    this.changes[path._id] = value
  }
}

// function collectDepsIds(node: Node, collection: { [key in string]: true }) {
//   collection[node.id] = true
//   node.edges.forEach(n => collectDepsIds(n, collection))
// }

export function createStore<State>(
  atom: Atom<State>,
  preloadedState: State = {},
): Store<Atom<State>> {
  const listenersStore = {} as { [key in string]: Set<Function> }
  const listenersActions: Set<Function> = new Set()
  const initialState = atom(preloadedState, actionDefault())
  const invalidateDeps = atom._invalidateDeps
  const expiredNodes: Node[] = []
  let state = initialState
  let isStateCanBeMutating = false

  // function ensureCanMutateState() {
  //   if (isStateCanBeMutating) return

  //   state = {
  //     root: state.root,
  //     flat: Object.assign({}, state.flat),
  //   }
  //   isStateCanBeMutating = true
  // }

  // function actualizeState(immutable = true) {
  //   if (expiredNodes.length === 0) return

  //   if (immutable) {
  //     state = {
  //       flat: Object.assign({}, state.flat),
  //       root: state.flat[localNode.id],
  //     }
  //     isStateCanBeMutating = true
  //   }

  //   const depsIds = {} as { [key in string]: true }
  //   collectDepsIds(localNode, depsIds)

  //   function deleteEdges({ id, edges }: Node) {
  //     if (depsIds[id] === undefined) delete state.flat[id]
  //     edges.forEach(deleteEdges)
  //   }

  //   let node
  //   while ((node = expiredNodes.pop())) deleteEdges(node)
  // }

  // function getState(target?: Atom<any>) {
  //   if (target === undefined) {
  //     actualizeState()
  //     return state
  //   }
  //   if (!geIsAtom(target)) throw new TypeError('Invalid target')

  //   const targetNode = target._node as Node
  //   const targetId = targetNode.id
  //   const isLazy = initialState.flat[targetId] === undefined
  //   if (isLazy) {
  //     actualizeState()

  //     const targetState = state.flat[targetId]
  //     const isExist = targetState !== undefined
  //     return isExist
  //       ? targetState
  //       : // TODO: improve perf
  //         target(state, initialAction(), () => null).root
  //   }
  //   // TODO: remove this check?
  //   const result = state.flat[targetId]
  //   return result === undefined ? targetNode.initialState : result
  // }

  function subscribe<T>(
    listener: (a: T) => any,
    // @ts-ignore
    target?: Atom<T>,
  ) {
    if (typeof listener !== 'function') throw new TypeError('Invalid listener')

    if (target === undefined) {
      listenersActions.add(listener)
      return () => listenersActions.delete(listener)
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
      typeof action !== 'object' &&
      action === null &&
      typeof action.type !== 'string'
    )
      throw new TypeError('Invalid action')

    const ctx = new CtxWithTrack(state, action.type, action.payload)

    invalidateDeps(ctx)

    const { changes } = ctx

    if (changes !== undefined) {
      const stateOld = state
      state = Object.assign({}, state, ctx.stateNew)
      actualizeState(false)

      for (const id in changes) {
        // if (oldFlat[id] === flatNew[id]) continue

        const subscribersById = listenersStore[id]

        if (subscribersById === undefined) continue

        // FIXME: separator
        const value = readStateByPath(state, id.split('.'))
        subscribersById.forEach(listener => listener(value))
      }
    }
    listenersActions.forEach(listener => listener(state, action))
  }

  // TODO: add `observable`
  return {
    subscribe,
    getState,
    dispatch,
    _node: localNode,
  }
}
