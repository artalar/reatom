import { ActionCreator, Cache, F, invalid, Transaction } from './internal'

let actionsCount = 0
export function declareAction(): ActionCreator<[]>
export function declareAction<Payload>(): ActionCreator<[Payload]>
export function declareAction<
  Arguments extends any[] = [],
  ActionData extends { payload: any } = { payload: Arguments[0] }
>(
  mapper: (...a: Arguments) => ActionData,
  options?: { type?: string },
): ActionCreator<Arguments, ActionData>
export function declareAction(
  mapper: (...a: any[]) => any = (payload: any) => ({ payload }),
  { type = `action [${++actionsCount}]` } = {},
) {
  const types = new Set([type])

  const actionCreator: ActionCreator = (...a) => {
    const action = mapper(...a)

    invalid('type' in action, `action type in created action data`)
    invalid(
      'payload' in action === false,
      `missing payload in created action data`,
    )

    return Object.assign({}, action, { type }) as any
  }
  actionCreator.handle = (cb: F) => (
    transaction,
    cache = { types, handler } as Cache,
  ) => (
    transaction.actions.forEach(
      action => action.type === type && cb(action.payload, action, transaction),
    ),
    cache
  )
  actionCreator.type = type

  function handler(transaction: Transaction, cache = { types, handler }) {
    return transaction.actions.some(action => action.type === type)
      ? Object.assign({}, cache)
      : cache
  }

  return actionCreator
}

export const init = declareAction(() => ({ payload: null }), {
  type: `@@Reatom/init`,
})
