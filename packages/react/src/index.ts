import {
  Action,
  Atom,
  AtomState,
  getState,
  isActionCreator,
  Store,
  getStoreByAtom,
} from '@reatom/core/'
import React from 'react'
import { useSubscription } from 'use-subscription'

export const reatomContext = React.createContext()

let batchedUpdates = (f: () => any) => f()
export const setBatchedUpdates = (f: (callback: () => any) => void) => {
  batchedUpdates = f
}

function bindActionCreator<Args extends any[]>(
  atom,
  actionCreator: (...args: Args) => Action | Action[] | void,
  store: Store,
) {
  return (...args: Args) => {
    const action = actionCreator(...args)

    if (action) {
      batchedUpdates(() => {
        getStoreByAtom(atom, store).dispatch(action)
      })
    }
  }
}

export function useAction<Args extends any[] = []>(
  actionCreator: (...args: Args) => Action | Action[] | void,
  deps: any[] = [],
  atom?: Atom,
): (...args: Args) => void {
  const store = React.useContext(reatomContext)

  return React.useCallback(
    bindActionCreator(atom, actionCreator, store),
    deps.concat(store),
  )
}

type ActionCreators<T extends any> = {
  [K in keyof T]: T[K] extends (...a: infer Args) => Action
    ? (...args: Args) => void
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
          getCurrentValue: () => getStoreByAtom(atom, store).getState(atom),
          subscribe: (cb: () => any) =>
            getStoreByAtom(atom, store).subscribe(atom, cb),
        },
        Object.entries(atom).reduce((acc, [k, ac]) => {
          // @ts-expect-error
          if (isActionCreator(ac)) acc[k] = bindActionCreator(atom, ac, store)
          return acc
        }, {} as ActionCreators<T>),
      ] as const,
    deps.concat([atom, store]),
  )

  return [useSubscription(result[0]), result[1]]
}
