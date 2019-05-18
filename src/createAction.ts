import {
  ActionCreator,
  Action,
  getValidDescription,
  Description,
} from './model'

export function createAction<P, T = any>(
  name: string | Description = 'actionCreator',
  mapper?: ((a?: T) => P) | null,
): ActionCreator<
  P,
  // FIXME: infer action type
  typeof name extends Description<infer Id, infer Name>
    ? Description<Id, Name>['id']
    : string
> {
  const { id, name: _name } = getValidDescription(name, 'action')
  mapper = mapper || (_ => _)

  if (typeof mapper !== 'function') throw new TypeError('Invalid mapper')

  function node(ctx) {
    ctx.flatNew[id] = ctx.payload
  }
  node._match = () => true
  node._children = []

  function actionCreator(payload?: P): Action<P, typeof id> {
    return {
      type: id,
      payload: mapper(payload),
    }
  }

  actionCreator._node = node
  actionCreator._id = id
  actionCreator._name = name
  actionCreator._types = { [id]: true }
  actionCreator._isAction = true

  return actionCreator
}
