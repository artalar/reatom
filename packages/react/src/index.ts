import {
  createContext,
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback,
  MutableRefObject,
  useMemo,
} from 'react'

import { Store, Atom, ActionCreator, ActionType, Action } from '@reatom/core'

function noop() {}

export const context = createContext<Store | null>(null)

function useForceUpdate() {
  const update = useState(0)[1]
  return useRef(() => update(v => v + 1)).current
}

const lifeCycleStatus = {
  initActual: 'initActual',
  initNotActual: 'initNotActual',
  mounted: 'mounted',
} as const

const defaultMapper = (atomValue: any) => atomValue

/**
 * @param atom target atom for subscription
 * @param selector (optional)
 * @param deps (optional)
 * @returns atom value
 */
export function useAtom<T>(atom: Atom<T>): T
export function useAtom<TI, TO = TI>(
  atom: Atom<TI>,
  selector: (atomValue: TI) => TO,
  deps: any[],
): TO
export function useAtom<TI, TO = TI>(
  atom: Atom<TI>,
  selector: (atomValue: TI) => TO = defaultMapper,
  deps: any[] = [],
): TO {
  const atomRef = useRef<Atom<TI>>()
  const selectorRef = useRef(selector)
  selectorRef.current = selector
  const stateRef = useRef<TO>()
  const unsubscribeRef = useRef<Function>(noop)
  const mountStatusRef = useRef<keyof typeof lifeCycleStatus>(
    lifeCycleStatus.initActual,
  )
  const store = useContext(context)
  const forceUpdate = useForceUpdate()

  if (!store) throw new Error('[reatom] The provider is not defined')

  function getRelativeState(atomValue = store!.getState(atomRef.current!)) {
    return selectorRef.current(atomValue)
  }

  if (atomRef.current !== atom) {
    atomRef.current = atom
    unsubscribeRef.current()
    unsubscribeRef.current = store.subscribe(atomRef.current, (state: any) => {
      const newState = getRelativeState(state)
      if (newState !== stateRef.current) {
        stateRef.current = newState
        if (mountStatusRef.current === lifeCycleStatus.mounted) {
          forceUpdate()
        } else {
          mountStatusRef.current = lifeCycleStatus.initNotActual
        }
      }
    })
    stateRef.current = getRelativeState()
  }

  useMemo(() => {
    if (mountStatusRef.current === lifeCycleStatus.mounted) {
      stateRef.current = getRelativeState()
    }
  }, deps)

  useEffect(() => {
    if (mountStatusRef.current === lifeCycleStatus.initNotActual) {
      forceUpdate()
    }
    mountStatusRef.current = lifeCycleStatus.mounted
    return () => unsubscribeRef.current()
  }, [])

  return stateRef.current as TO
}

type ActionBindedInferArguments<Payload> = Payload extends undefined
  ? () => void
  : (payload: Payload) => void
type ActionBinded<Fn extends Function> = Fn extends ActionCreator<
  infer Payload,
  any
>
  ? ActionBindedInferArguments<Payload>
  : Fn extends (...a: any[]) => Action<infer Payload> | undefined
  ? ActionBindedInferArguments<Payload>
  : never

/**
 * @param cb actionCreator (may return void for preventing dispatch)
 * @param deps
 */
export function useAction<Fn extends Function>(
  cb: Fn,
  deps: any[] = [],
): ActionBinded<Fn> {
  const store = useContext(context)

  if (!store) throw new Error('[reatom] The provider is not defined')
  if (typeof cb !== 'function') {
    throw new TypeError('[reatom] `useAction` argument must be a function')
  }

  // @ts-ignore
  return useCallback((payload: T) => {
    const action = cb(payload)
    if (action) store.dispatch(action)
  }, deps)
}
