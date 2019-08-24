import React from 'react'
import { createActionCreator, createAtom } from 'reatom'

import { useAtom, useDispatch } from '../../shared'

export const onSubmit = createActionCreator('onSubmit', e => e.preventDefault())
export const $isAuth = createAtom(['auth', 'isAuth'], false, reduce => [
  reduce(onSubmit, () => true),
])

export function Auth() {
  // connect reducers lazy
  useAtom(() => $isAuth)
  const handleSubmit = useDispatch(onSubmit)

  return (
    <form onSubmit={handleSubmit}>
      <h4>Fake auth</h4>
      <button type="submit">Accept</button>
    </form>
  )
}
