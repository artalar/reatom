import { IActionCreator, KIND } from './internal'

export function createActionCreator<Payload = void>(
  type: string,
): IActionCreator<Payload> {
  function actionCreator(payload: Payload) {
    return {
      type,
      payload,
    }
  }
  actionCreator[KIND] = 'action' as const
  actionCreator.type = type

  return actionCreator
}
let actionsCount = 0
export function Action<T>(name = 'action') {
  return createActionCreator<T>(`${name} [${++actionsCount}]`)
}

export const init = createActionCreator(`@@Reatom/init`)
