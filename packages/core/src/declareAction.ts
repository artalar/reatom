import {
  ActionCreator,
  Cache,
  F,
  invalid,
  isFunction,
  Store,
  Transaction,
} from './internal'

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

  function handler(
    transaction: Transaction,
    cache: Cache = { types, handler },
  ) {
    return transaction.actions.some(action => action.type === type)
      ? { types, handler }
      : cache
  }

  const actionCreator: ActionCreator = (...a) => {
    const action = mapper(...a)

    invalid('type' in action, `action type in created action data`)
    invalid(
      'payload' in action === false,
      `missing payload in created action data`,
    )

    return Object.assign({}, action, { type })
  }
  actionCreator.type = type
  actionCreator.handle = (cb: F) => (
    transaction: Transaction,
    cache: Cache = { types, handler },
  ) => (
    transaction.actions.forEach(action => {
      if (action.type === type) {
        const result = cb(action.payload, action, transaction)
        if (isFunction(result)) transaction.effects.push(result)
      }
    }),
    cache
  )

  return actionCreator
}
