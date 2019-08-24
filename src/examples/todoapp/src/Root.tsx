// github.com/artalar/flaxom

import React from 'react'

import { context, useAtom } from './shared'
import { Auth, $isAuth, App } from './features'

export { context }

export function Root() {
  const isAuth = useAtom(() => $isAuth)

  return isAuth ? <App /> : <Auth />
}
