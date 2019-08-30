import {
  createContext,
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback,
} from 'react'

import { Store, Atom, ActionCreator } from '@reatom/core'

export const context = createContext<Store | null>(null)

export function useForceUpdate() {
  const update = useState(0)[1]
  return useRef(() => update(v => v + 1)).current
}

function useUnsubscribe(ref: any) {
  useEffect(
    () => () => {
      ref.current()
    },
    [ref],
  )
}

export function useAtom<T>(atom: Atom<T>, silent = false): T {
  const atomRef = useRef<Atom<T>>()
  const stateRef = useRef<T>()
  const unsubscribeRef = useRef<Function>()
  const store = useContext(context) as Store
  const forceUpdate = useForceUpdate()

  if (atomRef.current === undefined) {
    atomRef.current = atom
    unsubscribeRef.current = store.subscribe(atom, (state: any) => {
      stateRef.current = state
      if (!silent) forceUpdate()
    })

    stateRef.current = store.getState(atom)
  }

  useUnsubscribe(unsubscribeRef)

  return stateRef.current as T
}

export function useAction<T>(cb: ActionCreator<T>, deps: any[] = []) {
  const store = useContext(context) as Store

  return useCallback((payload: T) => {
    const action = cb(payload)
    if (typeof action === 'object' && action !== null) store.dispatch(action)
  }, deps)
}
