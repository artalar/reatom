import { Leaf, Tree, BaseAction } from './kernel'
import { TREE, noop, nameToId, Unit } from './shared'
import { Store } from './createStore'

export type ActionType = Leaf
export type Reaction<T> = (payload: T, store: Store) => any

export type Action<Payload, Type extends ActionType = string> = BaseAction<
  Payload
> & {
  type: Type
  reactions?: Reaction<Payload>[]
}

export type BaseActionCreator = {
  getType: () => string
} & Unit

export type ActionCreator<Type extends string = string> = BaseActionCreator &
  (() => Action<undefined, Type>)

export type PayloadActionCreator<
  Payload,
  Type extends string = string
> = BaseActionCreator & ((payload: Payload) => Action<Payload, Type>)

export function declareAction<Type extends ActionType = string>(
  name?: string | [Type] | Reaction<undefined>,
  ...reactions: Reaction<undefined>[]
): ActionCreator<Type>

export function declareAction<Payload, Type extends ActionType = string>(
  name?: string | [Type] | Reaction<Payload>,
  ...reactions: Reaction<Payload>[]
): PayloadActionCreator<Payload, Type>

export function declareAction<
  Payload = undefined,
  Type extends ActionType = string
>(
  name: string | [Type] | Reaction<Payload> = 'action',
  ...reactions: Reaction<Payload>[]
): ActionCreator<Type> | PayloadActionCreator<Payload, Type> {
  if (typeof name === 'function') {
    reactions.unshift(name)
    name = 'action'
  }
  const id = nameToId(name)

  const ACTree = new Tree(id, true)
  ACTree.addFn(noop, id)

  const actionCreator = function actionCreator(payload?: Payload) {
    return {
      type: id,
      payload,
      reactions,
    }
  } as (ActionCreator<Type> | PayloadActionCreator<Payload, Type>)

  actionCreator[TREE] = ACTree
  actionCreator.getType = () => id

  return actionCreator
}
