import { IAction, IActionCreator, invalid, KIND } from './internal'

let actionsCount = 0
export function Action<Payload = void>(): IActionCreator<Payload>
export function Action<
  Payload = void,
  Action extends Partial<IAction> = IAction
>(mapper: (payload: Payload) => Action): IActionCreator<Payload, Action>
export function Action(
  mapper = (payload: any) => ({ payload }),
): IActionCreator {
  // @ts-expect-error
  const actionCreator: IActionCreator = (payload: any): IAction => {
    const { type } = actionCreator
    const action: any = mapper(payload)

    invalid(
      'type' in action && action.type !== type,
      `mapper type, expect nothing or "${type}", but got "${action.type}"`,
    )

    return {
      type,
      payload,
      ...action,
    }
  }
  actionCreator.type = `action [№${++actionsCount}]`
  actionCreator[KIND] = 'action' as const

  return actionCreator
}

export const init = Action(payload => ({ type: `@@Reatom/init`, payload }))
init.type = `@@Reatom/init`
