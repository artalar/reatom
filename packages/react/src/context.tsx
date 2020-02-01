import React, { createContext } from 'react'
import { Store } from '@reatom/core'

export const context = createContext<Store | null>(null)

export const StoreProvider: React.FC<{
  store: Store
}> = ({ store, children }) => {
  return <context.Provider value={store}>{children}</context.Provider>
}
