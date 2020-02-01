import {
  useEffect,
  useRef,
  useReducer,
  useContext,
  useCallback,
  Reducer,
  useMemo,
} from 'react'

import { Atom, ActionCreator, PayloadActionCreator, Action } from '@reatom/core'

import { context } from './context'
export { StoreProvider } from './context'

function noop() {}

function useForceUpdate() {
  // dispatch don't have action and don't changes between rerenders
  return useReducer<Reducer<boolean, null>>(s => !s, true)[1] as () => void
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

type Payload<
  PAC extends PayloadActionCreator<any>
> = PAC extends PayloadActionCreator<infer T> ? T : never
type PayloadCb<T> = (payload: T) => Action<T> | void

/**
 * @param cb actionCreator (may return void for preventing dispatch)
 * @param deps
 */
export function useAction<AC extends ActionCreator>(
  cb: AC,
  deps?: any[],
): () => void
export function useAction<PAC extends PayloadActionCreator<any>>(
  cb: PAC,
  deps?: any[],
): (payload: Payload<PAC>) => void
export function useAction(
  cb: () => Action<any> | void,
  deps?: any[],
): () => void
export function useAction<T>(
  cb: (a: T) => Action<any> | void,
  deps?: any[],
): (payload: T) => void
export function useAction(
  cb:
    | ActionCreator
    | PayloadActionCreator<any>
    | ((a?: any) => Action<any> | void),
  deps: any[] = [],
): (a?: any) => void {
  const store = useContext(context)

  if (!store) throw new Error('[reatom] The provider is not defined')
  if (typeof cb !== 'function') {
    throw new TypeError('[reatom] `useAction` argument must be a function')
  }

  return useCallback(payload => {
    const action = cb(payload)
    if (action) store.dispatch(action)
  }, deps)
}

// TODO: TS tests

// const a = declareAction()
// const ap = declareAction<0>()

// const test1 = useAction(a)
// const test2 = useAction(() => a())
// const test3 = useAction(ap)
// const test4 = useAction(() => ap(0))
// const test5 = useAction<0>((v) => ap(v))
// const test6 = useAction<0>((v) => a())
// const test7 = useAction(() => {
//   if (Math.random()) {
//     return ap(0)
//   }
//   if (Math.random()) {
//     return a()
//   }
//   if (Math.random()) {
//     // error
//     return 123
//   }
// })
