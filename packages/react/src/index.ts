import { Action, Atom, createStore, isAtom } from '@reatom/core'
import React from 'react'
import ReactDOM from 'react-dom'
import { useSubscription } from 'use-subscription'

export const reatomContext = React.createContext(createStore())

export function useAction<T = void>(
  actionCreator: (payload: T) => Action | Action[] | void,
  deps: any[] = [],
) {
  const store = React.useContext(reatomContext)

  return React.useCallback((payload: T) => {
    const action = actionCreator(payload)

    if (action) {
      ReactDOM.unstable_batchedUpdates(() => {
        store.dispatch(action)
      })
    }
  }, deps.concat(store))
}

export function useAtom<T>(atom: Atom<T>, deps: any[] = []): T {
  const store = React.useContext(reatomContext)

  const subscription = React.useMemo(
    () => ({
      getCurrentValue: () => store.getState(atom),
      subscribe: (cb: () => any) => store.subscribe(atom, cb),
    }),

    deps.concat([atom, store]),
  )

  return useSubscription(subscription)
}

export function useInit(atoms: Array<Atom>, deps: any[] = []) {
  const store = React.useContext(reatomContext)

  React.useEffect(() => store.init(...atoms), [])
}

export function useModel<
  Model extends Record<string, ((...a: any[]) => Action | Array<Action>) | Atom>
>(
  modelCreator: () => Model,
  deps = [],
): {
  [K in keyof Model]: Model[K] extends Atom<infer T> ? T : Model[K]
} {
  const model = React.useMemo(modelCreator, deps)
  const result: Record<string, any> = {}
  for (const key in model) {
    const handler = model[key]
    result[key as string] = isAtom(handler)
      ? useAtom(handler)
      : useAction(handler as any)
  }
  return result as any
}
