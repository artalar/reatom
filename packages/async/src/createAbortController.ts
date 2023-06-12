import { throwIfAborted } from '@reatom/utils'

export const createAbortController = () => {
  const controller = new AbortController()
  // Available from 2022
  controller.signal.throwIfAborted ??= () => throwIfAborted(controller)
  return controller
}
