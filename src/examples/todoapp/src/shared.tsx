import React, {
  createContext,
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback,
} from 'react'

// ---------------------------------------
// this code will moved to `reatom-react`
// ---------------------------------------

export const context = createContext(null)

export function useForceUpdate() {
  const update = useState(0)[1]
  return useRef(() => update(v => v + 1)).current
}

function useUnsubscribe(ref) {
  useEffect(
    () => () => {
      ref.current()
    },
    [ref],
  )
}

export function useAtom(atomCreator, onlyInitialization = false) {
  const atomRef = useRef()
  const stateRef = useRef()
  const unsubscribeRef = useRef()
  const store = useContext(context)
  const forceUpdate = useForceUpdate()

  if (atomRef.current === undefined) {
    const atom = atomCreator()
    atomRef.current = atom
    unsubscribeRef.current = store.subscribe(atom, state => {
      stateRef.current = state
      if (!onlyInitialization) forceUpdate()
    })
    stateRef.current = store.getState(atom)
  }

  useUnsubscribe(unsubscribeRef)

  return stateRef.current
}

export function useDispatch(cb, deps) {
  const store = useContext(context)

  return useCallback((...a) => {
    const action = cb.apply(store, a)
    if (typeof action === 'object' && action !== null) store.dispatch(action)
  }, deps)
}
