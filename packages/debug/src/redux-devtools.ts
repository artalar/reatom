import { Store } from '@reatom/core'

// http://extension.remotedev.io/docs/API/Methods.html#connect
export function connectReduxDevtools(store: Store, config: object) {
  const devTools =
    // @ts-ignore
    window.__REDUX_DEVTOOLS_EXTENSION__ &&
    // @ts-ignore
    window.__REDUX_DEVTOOLS_EXTENSION__.connect(config)

  if (!devTools) return

  devTools.init(store.getState())
  return store.subscribe(action => devTools.send(action, store.getState()))
}
