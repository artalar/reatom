import { initAction, Store } from '@reatom/core'

// http://extension.remotedev.io/docs/API/Methods.html#connect
export function connectReduxDevtools(store: Store, config = {}) {
  const devTools =
    (window as any).__REDUX_DEVTOOLS_EXTENSION__ &&
    (window as any).__REDUX_DEVTOOLS_EXTENSION__.connect(config)

  if (!devTools) return

  let state = store.getState()

  devTools.init(state)

  devTools.subscribe((action: any) => {
    if (action.type === 'DISPATCH') {
      // TODO: improve action types
      store.dispatch({
        ...initAction,
        payload: JSON.parse(action.state),
      } as any)
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
          typeof k === 'symbol' &&
          (k.toString().startsWith('Symbol({') ||
            k.toString().startsWith('Symbol(['))
        ) {
          return
        }
        state[k.toString()] = diff[k as string]
      })
    }
    devTools.send(action, state)
  })
}
