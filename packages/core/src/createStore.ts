import { Tree, State, TreeId, createCtx, Action } from './kernel'
import {
  throwError,
  getTree,
  safetyFunc,
  assign,
  getIsAtom,
} from './shared'
import { Atom, declareAtom, initAction, getState } from './declareAtom'

// for create nullable store
const defaultAtom = declareAtom(0, () => 0)

declare function storeGetState<T>(target: Atom<T>): T
declare function storeGetState(): State

declare function storeSubscribe<T>(
  target: Atom<T>,
  listener: (state: T) => any,
): () => void
declare function storeSubscribe(
  listener: (action: Action<any>) => any,
): () => void
export type Store = {
  dispatch: (action: Action<any>) => void
  subscribe: typeof storeSubscribe
  getState: typeof storeGetState
}

// TODO: try to use ES6 Map's instead of plain object
// for prevent using `delete` operator
// (need perf tests)
export function createStore(
  atom: Atom<any> | null,
  preloadedState = {},
): Store {
  const listenersStore = new Map<TreeId, Function[]>()
  const listenersActions: Function[] = []
  // const storeAtom = map('store', atom || defaultAtom, value => value)
  const storeTree = new Tree('store')
  storeTree.union(getTree(atom || defaultAtom)!)
  const ctx = createCtx(preloadedState || {}, initAction)
  storeTree.forEach(initAction.type, ctx)
  const initialAtoms = new Set(Object.keys(ctx.stateNew))
  // preloadedState needed to save data of lazy atoms
  const state = assign({}, preloadedState || {}, ctx.stateNew)

  function _getState(target?: Atom<any>) {
    // TODO: try to cache `assign`
    if (target === undefined) return assign({}, state)

    if (!getIsAtom(target)) throwError('Invalid target')

    const targetState = getState(state, target)
    if (targetState !== undefined) return targetState

    const ctx = createCtx(state, initAction)
    getTree(target)!.forEach(initAction.type, ctx)

    return getState(ctx.stateNew, target)
  }

  // @ts-ignore
  function subscribe(target, cb) {
    const isActionSubscription = cb === undefined
    const listener = safetyFunc(isActionSubscription ? target : cb, 'listener')
    let isSubscribed = true

    if (isActionSubscription) {
      listenersActions.push(listener)
      return () => {
        if (isSubscribed) {
          isSubscribed = false
          listenersActions.splice(listenersActions.indexOf(listener), 1)
        }
      }
    }

    if (!getIsAtom(target)) throwError('Subscription target is not Atom')
    const targetTree = getTree(target)
    const targetId = targetTree.id
    const isLazy = !initialAtoms.has(targetId)

    if (!listenersStore.has(targetId)) {
      listenersStore.set(targetId, [])
      if (isLazy) {
        storeTree.union(targetTree)
        const ctx = createCtx(state, initAction)
        targetTree.forEach(initAction.type, ctx)
        assign(state, ctx.stateNew)
      }
    }

    listenersStore.get(targetId)!.push(listener)

    return () => {
      if (isSubscribed) {
        isSubscribed = false

        const _listeners = listenersStore.get(targetId)!
        _listeners.splice(_listeners.indexOf(listener), 1)

        if (isLazy && _listeners.length === 0) {
          listenersStore.delete(targetId)
          storeTree.disunion(targetTree)
          // FIXME: dependencies is not clearing
          delete state[targetId]
        }
      }
    }
  }

  function dispatch(action: Action<any>) {
    (typeof action !== 'object' ||
      action === null ||
      typeof action.type !== 'string') &&
      throwError('Invalid action')

    const ctx = createCtx(state, action)
    storeTree.forEach(action.type, ctx)

    const { changedTreeIds, stateNew } = ctx

    if (changedTreeIds.length > 0) {
      assign(state, stateNew)

      for (let i = 0; i < changedTreeIds.length; i++) {
        const id = changedTreeIds[i]
        callFromList(listenersStore.get(id) || [], stateNew[id])
      }
    }

    callFromList(listenersActions, action)
  }

  return {
    // @ts-ignore
    getState: _getState,
    // @ts-ignore
    subscribe,
    dispatch,
  }
}

function callFromList(list: Function[], arg: any, i = -1) {
  while (++i < list.length) list[i](arg)
}
