import { Leaf, Tree, State, TreeId, Ctx, createCtx } from './kernel'
import {
  TREE,
  noop,
  nameToId,
  Unit,
  throwError,
  getTree,
  safetyFunc,
  getIsAction,
  assign,
  getIsAtom,
} from './shared'
import { Action, declareAction, ActionType } from './declareAction'
import { Atom, declareAtom, initAction, map, getState } from './declareAtom'

type DispatchFunction = (action: Action<any>) => any
type SubscribeFunction = {
  <T>(target: Atom<T>, listener: (state: T) => any): () => void
  (listener: DispatchFunction): () => void
}
type GetStateFunction = {
  <T>(target: Atom<T>): T
  (): State
}

// for create nullable store
const defaultAtom = declareAtom(0, () => 0)

export type Store = {
  dispatch: DispatchFunction
  subscribe: SubscribeFunction
  getState: GetStateFunction
}

// TODO: try to use ES6 Map's instead of plain object
// for prevent using `delete` operator
// (need perf tests)
export function createStore(
  atom: Atom<any> | null,
  preloadedState = {},
): Store {
  const atomsListeners = new Map<TreeId, Function[]>()
  let actionsListeners: Function[] = []
  let nextActionsListiners: Function[] = actionsListeners
  // const storeAtom = map('store', atom || defaultAtom, value => value)
  const storeTree = new Tree('store')
  storeTree.union(getTree(atom || defaultAtom)!)
  const ctx = createCtx(preloadedState || {}, initAction)
  storeTree.forEach(initAction.type, ctx)
  const initialAtoms = new Set(Object.keys(ctx.stateNew))
  // preloadedState needed to save data of lazy atoms
  const state = assign({}, preloadedState || {}, ctx.stateNew)

  function ensureCanMutateNextListeners() {
    if (nextActionsListiners === actionsListeners) {
      nextActionsListiners = actionsListeners.slice()
    }
  }

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
  function subscribe<T>(
    target: Atom<T> | DispatchFunction,
    subscriber: (state: T) => any,
  ): () => void {
    const isActionSubscription = subscriber === undefined
    const listener = safetyFunc(
      isActionSubscription ? target : subscriber,
      'listener',
    )
    let isSubscribed = true

    if (isActionSubscription) {
      ensureCanMutateNextListeners()
      nextActionsListiners.push(listener)
      return () => {
        if (isSubscribed) {
          isSubscribed = false
          ensureCanMutateNextListeners()
          nextActionsListiners.splice(nextActionsListiners.indexOf(listener), 1)
        }
      }
    }

    if (!getIsAtom(target)) throwError('Subscription target is not Atom')
    const targetTree = getTree(target)
    const targetId = targetTree.id
    const isLazy = !initialAtoms.has(targetId)

    if (!atomsListeners.has(targetId)) {
      atomsListeners.set(targetId, [])
      if (isLazy) {
        storeTree.union(targetTree)
        const ctx = createCtx(state, initAction)
        targetTree.forEach(initAction.type, ctx)
        assign(state, ctx.stateNew)
      }
    }

    atomsListeners.get(targetId)!.push(listener)

    return () => {
      if (isSubscribed) {
        isSubscribed = false

        const _listeners = atomsListeners.get(targetId)!
        _listeners.splice(_listeners.indexOf(listener), 1)

        if (isLazy && _listeners.length === 0) {
          atomsListeners.delete(targetId)
          storeTree.disunion(targetTree)
          // FIXME: dependencies is not clearing
          delete state[targetId]
        }
      }
    }
  }

  function dispatch(action: Action<any>) {
    ;(typeof action !== 'object' ||
      action === null ||
      typeof action.type !== 'string') &&
      throwError('Invalid action')

    const ctx = createCtx(state, action)
    storeTree.forEach(action.type, ctx)

    const { changedIds, stateNew, payload } = ctx

    if (changedIds.length > 0) {
      assign(state, stateNew)

      for (let i = 0; i < changedIds.length; i++) {
        const id = changedIds[i]
        callFromList(atomsListeners.get(id) || [], stateNew[id])
      }
    }

    ;(action.reactions || []).forEach(r => r(payload, store as any))
    callFromList((actionsListeners = nextActionsListiners), action)
  }

  const store = {
    getState: _getState,
    subscribe,
    dispatch,
  }

  // @ts-ignore
  return store
}

function callFromList(list: Function[], arg: any, i = -1) {
  while (++i < list.length) list[i](arg)
}
