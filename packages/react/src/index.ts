import {
  createContext,
  useEffect,
  useRef,
  useReducer,
  useContext,
  useCallback,
  Reducer,
  useMemo,
  Context,
} from 'react'

import { Store, Atom, Action } from '@reatom/core'

/**
 * @ignore
 */
function noop() {}

/**
 * Added in: v1.0.0
 *
 * ```js
 * import { context } from '@reatom/react'
 * ```
 *
 * #### Description
 *
 * Context for Reatom store
 *
 * #### Examples
 *
 * Basic
 * ```jsx
 * <context.Provider value={store}>
 *   <App />
 * </context.Provider>
 * ```
 *
 * Getting store
 *
 * ```js
 * const store = useContext(context)
 * ```
 */
export const context = createContext<Store | null>(null)

export const { Provider } = context

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
 * @param ctx react context for your store.
 * @returns A `useAtom` hook bound to the context.
 */
export function createAtomHook(ctx: Context<Store | null> = context) {
  function useAtom<T>(atom: Atom<T>): T
  function useAtom<TI, TO = TI>(
    atom: Atom<TI>,
    selector: (atomValue: TI) => TO,
    deps: any[],
  ): TO
  function useAtom<TI, TO = TI>(
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
    const store = useContext(ctx)
    const forceUpdate = useForceUpdate()

    if (!store) throw new Error('[reatom] The provider is not defined')

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    function getRelativeState(atomValue = store!.getState(atomRef.current!)) {
      return selectorRef.current(atomValue)
    }

    useMemo(() => {
      atomRef.current = atom
      unsubscribeRef.current()
      unsubscribeRef.current = store.subscribe(
        atomRef.current,
        (state: any) => {
          const newState = getRelativeState(state)
          if (newState !== stateRef.current) {
            stateRef.current = newState
            if (mountStatusRef.current === lifeCycleStatus.mounted) {
              forceUpdate()
            } else {
              mountStatusRef.current = lifeCycleStatus.initNotActual
            }
          }
        },
      )
      stateRef.current = getRelativeState()
    }, [atom, store])

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

  return useAtom
}

/**
 * Added in: v1.0.0
 *
 * ```js
 * import { useAction } from '@reatom/react'
 * ```
 *
 * #### Description
 *
 * React Hook for connects the atom to the store provided in context and returns the state of the atom from the store (or default atom state).
 *
 * #### Signature
 *
 * ### useAtom(atom, selector?, deps?)
 *
 * **Arguments**
 * - atom [`Atom`](../core/Atom.md) - required
 * - selector `Function` - optional
 * - deps `Array` - optional
 *
 * **Returns** [`AtomState`](../core/AtomState.md)
 *
 * #### Examples
 *
 * Basic
 * ```js
 * const products = useAtom(productsAtom)
 * ```
 *
 * With selector
 * ```js
 * const product = useAtom(productsAtom, state => state[id], [id])
 * ```
 */
export const useAtom = createAtomHook()

type AnyActionCreator = (...args: any[]) => Action<any> | void

/**
 * @param ctx react context for your store.
 * @returns A `useAction` hook bound to the context.
 */
export function createActionHook(ctx: Context<Store | null> = context) {
  function useAction<AC extends AnyActionCreator>(
    cb: AC,
    deps?: any[],
  ): (...args: Parameters<AC>) => void
  function useAction(cb: () => Action<any> | void, deps?: any[]): () => void
  function useAction<T>(
    cb: (a: T) => Action<any> | void,
    deps?: any[],
  ): (payload: T) => void
  function useAction(
    cb: AnyActionCreator,
    deps: any[] = [],
  ): (...args: any[]) => void {
    const store = useContext(ctx)

    if (!store) throw new Error('[reatom] The provider is not defined')
    if (typeof cb !== 'function') {
      throw new TypeError('[reatom] `useAction` argument must be a function')
    }

    return useCallback((...args) => {
      const action = cb(...args)
      if (action) store.dispatch(action)
    }, deps.concat(store))
  }

  return useAction
}

/**
 * Added in: v1.0.0
 *
 * ```js
 * import { useAction } from '@reatom/react'
 * ```
 *
 * #### Description
 *
 * React Hook for bind action and dispatch to the store provided in the context.
 *
 * #### Signature
 *
 * ### useAction(actionCreator)
 *
 * **Arguments**
 * - actionCreator [`ActionCreator`](../core/ActionCreator) | `() =>`[`Action`](../core/Action)
 *
 * **Returns** [`ActionCreator`](./../core/ActionCreator)
 *
 * #### Examples
 *
 * ```js
 * const doIncrement = useAction(increment)
 * ```
 */
export const useAction = createActionHook()

// TODO: TS tests

// const a = declareAction()
// const ap = declareAction<0>()
// const aop = declareAction<{ a: string; b: number; c: boolean }>()

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
// const test8 = useAction((a: string, b: number, c: boolean = false) => aop({ a, b, c }))
