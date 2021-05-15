import {
  ActionCreator,
  defaultStore,
  invalid,
  isFunction,
  isString,
} from './internal'

const defaultMapper = (payload: any) => ({
  payload,
})

let actionsCount = 0

export function declareAction(type?: string): ActionCreator<[]>
export function declareAction<Payload>(type?: string): ActionCreator<[Payload]>
export function declareAction<
  Arguments extends any[] = [],
  ActionData extends { payload: any; type?: never } = { payload: Arguments[0] },
>(
  mapper: (...a: Arguments) => ActionData,
  type?: string,
): ActionCreator<Arguments, ActionData>
export function declareAction(
  mapperOrType?: string | ((...a: any[]) => any),
  type = isString(mapperOrType) ? mapperOrType : `action [${++actionsCount}]`,
) {
  const mapper = isFunction(mapperOrType) ? mapperOrType : defaultMapper
  const actionCreator: ActionCreator = (...a) => {
    const action = mapper(...a)

    if (/* TODO: `process.env.NODE_ENV === 'development'` */ true) {
      invalid(`type` in action, `action type in created action data`)
      invalid(
        `payload` in action === false,
        `missing payload in created action data`,
      )
    }

    return Object.assign({}, action, { type })
  }

  actionCreator.dispatch = (...a) => defaultStore.dispatch(actionCreator(...a))

  actionCreator.subscribe = (cb) => defaultStore.subscribe(actionCreator, cb)

  actionCreator.type = type

  return actionCreator
}
