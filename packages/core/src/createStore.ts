import { Tree, State, TreeId, createCtx } from './kernel'
import {
  throwError,
  getTree,
  safetyFunc,
  assign,
  getIsAtom,
  getIsAction,
} from './shared'
import { Action } from './declareAction'
import { Atom, initAction, getState } from './declareAtom'

type ActionsSubscriber = (action: Action<any>) => any
type SubscribeFunction = {
  <T>(target: Atom<T>, listener: (state: T) => any): () => void
  (listener: ActionsSubscriber): () => void
}
type GetStateFunction = {
  <T>(target: Atom<T>): T
  (): State
}

export type Store = {
  dispatch: ActionsSubscriber
  subscribe: SubscribeFunction
  getState: GetStateFunction
}

export function createStore(initState?: State): Store
export function createStore(atom: Atom<any>, initState?: State): Store
// TODO: try to use ES6 Map's instead of plain object
// for prevent using `delete` operator
// (need perf tests)
export function createStore(
  atom?: Atom<any> | State,
  initState?: State,
): Store {
  let atomsListeners: Map<TreeId, Function[]> = new Map<TreeId, Function[]>()
  let nextAtomsListeners: Map<TreeId, Function[]> = atomsListeners
  let actionsListeners: Function[] = []
  let nextActionsListeners: Function[] = actionsListeners
  let initialAtoms = new Set<TreeId>()
  const state: State = {}
  const storeTree = new Tree('store')
  if (atom !== undefined) {
    if (typeof atom === 'object' && initState === undefined) assign(state, atom)
    else {
      if (!getIsAtom(atom)) throwError('Invalid atom')
      if (typeof initState === 'object' && initState !== null)
        assign(state, initState)
      else if (initState !== undefined) throwError('Invalid initial state')

      storeTree.union(getTree(atom as Atom<any>))
      const ctx = createCtx(state, initAction)
      storeTree.forEach(initAction.type, ctx)
      assign(state, ctx.stateNew)
      initialAtoms = new Set(Object.keys(ctx.stateNew))
    }
  }

  function ensureCanMutateNextListeners() {
    if (nextActionsListeners === actionsListeners) {
      nextActionsListeners = actionsListeners.slice()
    }
  }

  function ensureCanMutateNextAtomsListeners(treeId: TreeId) {
    if (nextAtomsListeners === atomsListeners) {
      nextAtomsListeners = new Map()
      atomsListeners.forEach((value, key) =>
        nextAtomsListeners.set(key, treeId === key ? value.slice() : value),
      )
    }
  }

  function _getState(): State
  function _getState<T>(target?: Atom<T>): State | T {
    // TODO: try to cache `assign`
    if (target === undefined) return assign({}, state) as State

    if (!getIsAtom(target)) throwError('Invalid target')

    const targetState = getState<T>(state, target)
    if (targetState !== undefined) return targetState

    const ctx = createCtx(state, initAction)
    getTree(target)!.forEach(initAction.type, ctx)

    return getState(ctx.stateNew, target)
  }

  function subscribe(subscriber: ActionsSubscriber): () => void
  function subscribe<T>(
    target: Atom<T>,
    subscriber: (state: T) => any,
  ): () => void
  function subscribe<T>(
    target: Atom<T> | ActionsSubscriber,
    subscriber?: (state: T) => any,
  ): () => void {
    const listener = safetyFunc(subscriber || target, 'listener')
    let isSubscribed = true

    if (subscriber === undefined) {
      if (getIsAtom(listener) || getIsAction(listener))
        throwError('Invalid listener')

      ensureCanMutateNextListeners()
      nextActionsListeners.push(listener)
      return () => {
        if (!isSubscribed) return
        isSubscribed = false
        ensureCanMutateNextListeners()
        nextActionsListeners.splice(nextActionsListeners.indexOf(listener), 1)
      }
    }

    if (!getIsAtom(target)) throwError('Subscription target is not Atom')
    const targetTree = getTree(target as Atom<T>)
    const targetId = targetTree.id
    const isLazy = !initialAtoms.has(targetId)

    ensureCanMutateNextAtomsListeners(targetId)
    if (!nextAtomsListeners.has(targetId)) {
      nextAtomsListeners.set(targetId, [])
      if (isLazy) {
        storeTree.union(targetTree)
        const ctx = createCtx(state, initAction)
        targetTree.forEach(initAction.type, ctx)
        assign(state, ctx.stateNew)
      }
    }

    nextAtomsListeners.get(targetId)!.push(listener)

    return () => {
      if (!isSubscribed) return
      isSubscribed = false

      ensureCanMutateNextAtomsListeners(targetId)
      const _listeners = nextAtomsListeners.get(targetId)!
      _listeners.splice(_listeners.indexOf(listener), 1)

      if (isLazy && _listeners.length === 0) {
        nextAtomsListeners.delete(targetId)
        storeTree.disunion(targetTree)
        // FIXME: dependencies are not clearing
        delete state[targetId]
      }
    }
  }

  function dispatch(action: Action<any>) {
    if (
      typeof action !== 'object' ||
      action === null ||
      typeof action.type !== 'string'
    )
      throwError('Invalid action')

    const ctx = createCtx(state, action)
    storeTree.forEach(action.type, ctx)

    const { changedIds, stateNew, payload } = ctx

    if (changedIds.length > 0) {
      assign(state, stateNew)
      atomsListeners = nextAtomsListeners
      for (let i = 0; i < changedIds.length; i++) {
        const id = changedIds[i]
        callFromList(atomsListeners.get(id) || [], stateNew[id])
      }
    }

    ;(action.reactions || []).forEach(r => r(payload, store))
    callFromList((actionsListeners = nextActionsListeners), action)
  }

  const store = {
    getState: _getState,
    subscribe,
    dispatch,
  }

  return store
}

function callFromList(list: Function[], arg: any, i = -1) {
  while (++i < list.length) list[i](arg)
}
