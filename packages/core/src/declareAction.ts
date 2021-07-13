import {
  ActionCreatorBinded,
  Atom,
  defaultStore,
  Fn,
  invalid,
  isFunction,
  isString,
  ActionData,
} from './internal'

const defaultMapper = (payload: any) => ({
  payload,
})

let actionsCount = 0

export function declareAction(type?: string): ActionCreatorBinded<[]>
export function declareAction<Payload>(
  type?: string,
): ActionCreatorBinded<[Payload]>
export function declareAction<
  Args extends any[] = [],
  Data extends ActionData = { payload: Args[0] },
>(mapper: (...a: Args) => Data, type?: string): ActionCreatorBinded<Args, Data>
export function declareAction(
  typeOrMapper?: string | Fn,
  type = isString(typeOrMapper) ? typeOrMapper : `action [${++actionsCount}]`,
) {
  const mapper = isFunction(typeOrMapper) ? typeOrMapper : defaultMapper
  const actionCreator: ActionCreatorBinded = (...a) => {
    const action = mapper(...a)

    invalid(`type` in action, `action type in created action data`)
    invalid(
      `payload` in action === false,
      `missing payload in created action data`,
    )

    return Object.assign({}, action, { type })
  }

  actionCreator.dispatch = (...a) => defaultStore.dispatch(actionCreator(...a))

  actionCreator.subscribe = (cb) => defaultStore.subscribe(actionCreator, cb)

  actionCreator.type = type

  return actionCreator
}
