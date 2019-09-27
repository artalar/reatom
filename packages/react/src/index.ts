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

/**
 * @param atom target atom for subscription or callback for it creation
 * @param isUpdatesNotNeeded usefully for mount lazy atoms, but not subscribe to it updates
 * @returns atom value
 */
export function useAtom<T>(atom: Atom<T>): T
export function useAtom<TI, TO = TI>(
  atom: Atom<TI>,
  mapper: (atomValue: TI) => TO,
  deps: any[],
): TO
export function useAtom<TI, TO = TI>(
  atom: Atom<TI>,
  mapper: (atomValue: TI) => TO = (atomValue: TI) =>
    (atomValue as unknown) as TO,
  deps: any[] = [],
): TO {
  const atomRef = useRef<Atom<TI>>()
  const mapperRef = useRef(mapper)
  mapperRef.current = mapper
  const stateRef = useRef<TO>()
  const unsubscribeRef = useRef<Function>(noop)
  const mountStatusRef = useRef<keyof typeof lifeCycleStatus>(
    lifeCycleStatus.initActual,
  )
  const store = useContext(context) as Store
  const forceUpdate = useForceUpdate()
  function getRelativeState() {
    return mapperRef.current(store.getState(atomRef.current!))
  }

  if (!store) throw new TypeError('[reatom] The provider is not defined')

  if (atomRef.current !== atom) {
    atomRef.current = atom
    unsubscribeRef.current()
    unsubscribeRef.current = store.subscribe(atomRef.current, (state: any) => {
      const newState = mapperRef.current(state)
      const isStateChanged = newState !== stateRef.current
      if (isStateChanged) {
        stateRef.current = newState
        if (mountStatusRef.current === lifeCycleStatus.mounted) forceUpdate()
        else mountStatusRef.current = lifeCycleStatus.initNotActual
      }
    })
    stateRef.current = getRelativeState()
  }

  stateRef.current = useMemo(getRelativeState, deps)

  useEffect(() => {
    if (mountStatusRef.current === lifeCycleStatus.initNotActual)
      stateRef.current = getRelativeState()
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

export function useAction<Fn extends Function>(
  cb: Fn,
  deps: any[] = [],
): ActionBinded<Fn> {
  const store = useContext(context) as Store

  // @ts-ignore
  return useCallback((payload: T) => {
    const action = cb(payload)
    if (action) store.dispatch(action)
  }, deps)
}
