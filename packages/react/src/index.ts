import {
  Action,
  Atom,
  AtomState,
  defaultStore,
  isActionCreator,
  Store,
} from '@reatom/core'
import React from 'react'
import ReactDOM from 'react-dom'
import { useSubscription } from 'use-subscription'

export const reatomContext = React.createContext(defaultStore)

function bindActionCreator<T>(
  store: Store,
  actionCreator: (payload: T) => Action | Action[] | void,
) {
  return (payload: T) => {
    const action = actionCreator(payload)

    if (action) {
      ReactDOM.unstable_batchedUpdates(() => {
        store.dispatch(action)
      })
    }
  }
}

export function useAction<T = void>(
  actionCreator: (payload: T) => Action | Action[] | void,
  deps: any[] = [],
) {
  const store = React.useContext(reatomContext)

  return React.useCallback(
    bindActionCreator(store, actionCreator),
    deps.concat(store),
  )
}

type ActionCreators<T extends any> = {
  [K in keyof T]: T[K] extends (payload: infer Payload) => Action
    ? (payload: Payload) => unknown
    : never
}

export function useAtom<T extends Atom>(
  atom: T,
  deps: any[] = [],
): [state: AtomState<T>, bindedActionCreators: ActionCreators<T>] {
  const store = React.useContext(reatomContext)

  const result = React.useMemo(
    () =>
      [
        {
          getCurrentValue: () => store.getState(atom),
          subscribe: (cb: () => any) => store.subscribe(atom, cb),
        },
        Object.entries(atom).reduce((acc, [k, ac]) => {
          // @ts-expect-error
          if (isActionCreator(ac)) acc[k] = bindActionCreator(store, ac)
          return acc
        }, {} as ActionCreators<T>),
      ] as const,
    deps.concat([atom, store]),
  )

  return [useSubscription(result[0]), result[1]]
}

export function useInit(atoms: Array<Atom>, deps: any[] = []) {
  const store = React.useContext(reatomContext)

  React.useEffect(() => store.init(...atoms), deps)
}
