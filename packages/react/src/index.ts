import {
  createContext,
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback,
  MutableRefObject,
} from 'react'

import { Store, Atom, ActionCreator, getIsAtom } from '@reatom/core'

function noop() {}

export const context = createContext<Store | null>(null)

function useForceUpdate() {
  const update = useState(0)[1]
  return useRef(() => update(v => v + 1)).current
}

function useUnsubscribe(ref: MutableRefObject<Function>) {
  useEffect(
    () => () => {
      ref.current()
    },
    [ref],
  )
}

/**
 * @param atom target atom for subscription
 * @param isUpdatesNotNeeded usefully for mount lazy atoms, but not subscribe to it updates
 * @returns atom value
 */
export function useAtom<T>(
  atom: Atom<T> | (() => Atom<T>),
  isUpdatesNotNeeded = false,
): T {
  const atomRef = useRef<Atom<T>>()
  const stateRef = useRef<T>()
  const unsubscribeRef = useRef<Function>()
  const isMountRef = useRef(false)
  const store = useContext(context) as Store
  const forceUpdate = useForceUpdate()

  if (!store) throw new TypeError('[reatom] The provider is not defined')

  useEffect(() => {
    isMountRef.current = true
  }, [])

  if (!atomRef.current) {
    atomRef.current = getIsAtom(atom)
      ? (atom as Atom<T>)
      : (atom as () => Atom<T>)()
    unsubscribeRef.current = store.subscribe(
      atomRef.current,
      isUpdatesNotNeeded
        ? noop
        : (state: any) => {
            stateRef.current = state
            if (isMountRef.current) forceUpdate()
          },
    )
    stateRef.current = store.getState(atomRef.current)
  }

  useUnsubscribe(unsubscribeRef as MutableRefObject<Function>)

  return stateRef.current as T
}

export function useAction<T>(
  cb: ActionCreator<T> | ((payload: T) => void),
  deps: any[] = [],
) {
  const store = useContext(context) as Store

  return useCallback((payload: T) => {
    const action = cb(payload)
    if (action) store.dispatch(action)
  }, deps)
}
