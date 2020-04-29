import { useContext } from 'react'

import { context } from '@reatom/react'
import { Store } from '@reatom/core'

/**
 * A hook to access the reatom store.
 *
 * @returns {Store} the reatom store
 *
 * @example
 *
 * import React from 'react'
 * import { useStore } from '@reatom/react'
 *
 * export const ExampleComponent = () => {
 *   const store = useStore()
 *   return <div>{JSON.stringify(store.getState())}</div>
 * }
 */
export const useStore = (): Store => {
  const store = useContext(context)

  if (!store) {
    throw new Error('[reatom] The provider is not defined')
  }

  return store
}
