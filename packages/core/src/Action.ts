import { F, IAction, IActionCreator, invalid, KIND } from './internal'

let actionsCount = 0
export function Action<Payload = void>(): IActionCreator<Payload>
export function Action<
  Payload = void,
  Action extends Partial<IAction> = IAction
>(mapper: (payload: Payload) => Action): IActionCreator<Payload, Action>
export function Action(mapper: F = () => ({})): IActionCreator {
  // @ts-expect-error
  const actionCreator: IActionCreator = (payload: any): IAction => {
    const { type } = actionCreator
    const action: any = mapper(payload)

    invalid('type' in action, `type from mapper`)

    return Object.assign(
      {
        payload,
      },
      action,
      {
        type,
      },
    )
  }
  actionCreator.type = `action [№${++actionsCount}]`
  actionCreator[KIND] = 'action' as const

  return actionCreator
}

export const init = Action()
init.type = `@@Reatom/init`
