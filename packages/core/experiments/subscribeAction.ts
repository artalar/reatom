import {
  AC,
  Action,
  ActionType,
  addToSetsMap,
  delFromSetsMap,
  Store,
  Unsubscribe,
} from '@reatom/core'

const storesMap = new WeakMap<
  Store,
  Map<ActionType, Set<(action: Action) => any>>
>()

export function subscribeAction<T extends AC>(
  store: Store,
  actionCreator: T,
  cb: (action: ReturnType<T>) => any,
): Unsubscribe {
  // let map = storesMap.get(store)

  // if (!map) storesMap.set(store, (map = new Map()))

  // addToSetsMap(map, actionCreator.type, cb as any)

  // return () => delFromSetsMap(map!, actionCreator.type, cb as any)
}
