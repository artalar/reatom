import { Node } from './graph'

export type Action<T = void, Type extends string = string> = {
  type: Type
  payload: T
}

export type ActionCreator<Payload = void, Name extends string = string> = {
  (payload: Payload): Action<Payload, Name>
  getType: () => Name
}

export declare function createAction<
  Payload = void,
  Name extends string = string
>(name?: Name): ActionCreator<Payload, Name>
export declare function createAction<
  Input,
  Payload,
  Name extends string = string
>(name: Name, mapper: (input: Input) => Payload): ActionCreator<Payload, Name>
export function createAction(name = 'actionCreator', mapper = a => a) {
  const node = new Node(
    name,
    function(ctx) {
      ctx.flatNew[this.id] = ctx.payload
    },
    function(ctx) {
      return this.deps[ctx.type] === 0
    },
  )
  const { id } = node

  function actionCreator(payload) {
    return {
      type: id,
      payload: mapper(payload),
    }
  }

  actionCreator._node = node
  actionCreator.getType = () => id

  return actionCreator
}
