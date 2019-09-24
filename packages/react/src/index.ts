import {
  createContext,
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback,
  MutableRefObject,
} from 'react'

import { Store, Atom, ActionCreator, ActionType, Action } from '@reatom/core'

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
    [ref.current],
  )
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
export function useAtom<T>(atom: Atom<T>, isUpdatesNotNeeded = false): T {
  const atomRef = useRef<Atom<T>>()
  const stateRef = useRef<T>()
  const unsubscribeRef = useRef<Function>()
  const isMountRef = useRef<keyof typeof lifeCycleStatus>(
    lifeCycleStatus.initActual,
  )
  const store = useContext(context) as Store
  const forceUpdate = useForceUpdate()

  if (!store) throw new TypeError('[reatom] The provider is not defined')

  useEffect(() => {
    if (isMountRef.current === lifeCycleStatus.initNotActual) forceUpdate()
    isMountRef.current = lifeCycleStatus.mounted
  }, [])

  if (atomRef.current !== atom) {
    atomRef.current = atom
    unsubscribeRef.current = store.subscribe(
      atomRef.current,
      isUpdatesNotNeeded
        ? noop
        : (state: any) => {
            stateRef.current = state
            if (isMountRef.current === lifeCycleStatus.mounted) forceUpdate()
            else isMountRef.current = lifeCycleStatus.initNotActual
          },
    )
    stateRef.current = store.getState(atomRef.current)
  }

  useUnsubscribe(unsubscribeRef as MutableRefObject<Function>)

  return stateRef.current as T
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
