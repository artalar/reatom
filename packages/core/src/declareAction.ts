import {
  ActionCreator,
  Cache,
  defaultStore,
  invalid,
  isFunction,
  isString,
  Transaction,
} from './internal'

const defaultMapper = (payload: any) => ({
  payload,
})

let actionsCount = 0

export function declareAction(type?: string): ActionCreator<[]>
export function declareAction<Payload>(type?: string): ActionCreator<[Payload]>
export function declareAction<
  Arguments extends any[] = [],
  ActionData extends { payload: any; type?: never } = { payload: Arguments[0] }
>(
  mapper: (...a: Arguments) => ActionData,
  type?: string,
): ActionCreator<Arguments, ActionData>
export function declareAction(
  mapper?: string | ((...a: any[]) => any),
  type = isString(mapper) ? mapper : `action [${++actionsCount}]`,
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
    const action = (isFunction(mapper) ? mapper : defaultMapper)(...a)

    invalid('type' in action, `action type in created action data`)
    invalid(
      'payload' in action === false,
      `missing payload in created action data`,
    )

    return Object.assign({}, action, { type })
  }
  actionCreator.type = type
  actionCreator.handle = cb => (transaction, cache = { types, handler }) => (
    transaction.actions.forEach(
      action => action.type === type && cb(action.payload, action, transaction),
    ),
    cache
  )
  actionCreator.handleEffect = cb => (
    transaction,
    cache = { types, handler },
  ) => (
    transaction.actions.forEach(
      action =>
        action.type === type &&
        transaction.effects.push(store => cb(action, store, transaction)),
    ),
    cache
  )
  actionCreator.dispatch = (...a) => defaultStore.dispatch(actionCreator(...a))
  actionCreator.subscribe = cb => defaultStore.subscribe(actionCreator, cb)

  return actionCreator
}
