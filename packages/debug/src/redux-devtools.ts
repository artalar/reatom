import { initAction, Store, Action } from '@reatom/core'

// http://extension.remotedev.io/docs/API/Methods.html#connect
export function connectReduxDevtools(store: Store, config = {}) {
  const devTools =
    // @ts-ignore
    window.__REDUX_DEVTOOLS_EXTENSION__ &&
    // @ts-ignore
    window.__REDUX_DEVTOOLS_EXTENSION__.connect(config)

  if (!devTools) return

  let state = store.getState()

  devTools.init(state)

  devTools.subscribe((action: any) => {
    if (action.type === 'DISPATCH') {
      // TODO: improve action types
      // @ts-ignore
      store.dispatch({ ...initAction, payload: JSON.parse(action.state) })
    }
  })
  return store.subscribe((action, diff) => {
    if (action.type === initAction.type) return

    const keys: (string | symbol)[] = Object.keys(diff)
    keys.push(...Object.getOwnPropertySymbols(diff))

    if (keys.length) {
      state = { ...state }
      keys.forEach(k => {
        if (
          typeof k !== 'symbol' ||
          // combine
          !k.toString().startsWith('Symbol({')
        ) {
          state[k.toString()] = diff[k as string]
        }
      })
    }
    devTools.send(action, state)
  })
}
