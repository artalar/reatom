import { AtomOptions } from '@reatom/core'
import { createPrimitiveAtom } from '.'

let count = 0
export function createBooleanAtom(initState = false, options: AtomOptions = `boolean${++count}`) {
  return createPrimitiveAtom(
    initState,
    {
      toggle: (state) => !state,
      setTrue: () => true,
      setFalse: () => false,
      change: (state, cb: (state: boolean) => boolean) => cb(state),
      set: (newState: boolean) => newState,
    },
    options,
  )
}
