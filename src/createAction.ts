import { ActionCreator, Action, createId } from './model'

export function createAction<P, T = any>(
  name?: string,
  mapper?: ((a?: T) => P) | null,
  type: string = createId(name, 'action'),
): ActionCreator<P> {
  name = name || 'actionCreator'
  mapper = mapper || (_ => _)

  function node(ctx) {
    ctx.flatNew[type] = ctx.payload
  }
  node._match = () => true
  node._children = []

  function actionCreator(payload?: P): Action<P, typeof type> {
    return {
      type: type,
      payload: mapper(payload),
    }
  }

  actionCreator._node = node
  actionCreator._id = type
  actionCreator._name = name
  actionCreator._types = { [type]: true }
  actionCreator._isAction = true

  return actionCreator
}
