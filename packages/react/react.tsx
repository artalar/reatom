import {
  createContext,
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback
} from 'react'

export const context = createContext(null as any)

export function useForceUpdate() {
  const update = useState(0)[1]
  return useRef(() => update(v => v + 1)).current
}

function useUnsubscribe(ref: any) {
  useEffect(
    () => () => {
      ref.current()
    },
    [ref]
  )
}

export function useAtom(atom: any, onlyInitialization = false) {
  const atomRef = useRef()
  const stateRef = useRef()
  const unsubscribeRef = useRef()
  const store = useContext(context)
  const forceUpdate = useForceUpdate()

  if (atomRef.current === undefined) {
    atomRef.current = atom
    unsubscribeRef.current = store.subscribe(atom, (state: any) => {
      stateRef.current = state
      if (!onlyInitialization) forceUpdate()
    })
    stateRef.current = store.getState(atom)
  }

  useUnsubscribe(unsubscribeRef)

  return stateRef.current
}

export function useAction(cb: Function, deps: any[] = []) {
  const store = useContext(context)

  return useCallback((...a) => {
    const action = cb.apply(store, a)
    if (typeof action === "object" && action !== null) store.dispatch(action)
  }, deps)
}
