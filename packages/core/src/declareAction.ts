import { Leaf, Tree, BaseAction } from './kernel'
import { TREE, nameToId, Unit, assign } from './shared'
import { Store } from './createStore'

export type ActionType = Leaf
export type Reaction<T> = (payload: T, store: Store) => any

export type Action<Payload, Type extends ActionType = string> = BaseAction<
  Payload
> & {
  type: Type
  reactions?: Reaction<Payload>[]
}

export type BaseActionCreator<Type extends string = string> = {
  getType: () => Type
} & Unit

export type ActionCreator<Type extends string = string> = BaseActionCreator<
  Type
> &
  (() => Action<undefined, Type>)

export type PayloadActionCreator<
  Payload,
  Type extends string = string
> = BaseActionCreator<Type> & ((payload: Payload) => Action<Payload, Type>)

export function declareAction(
  name?: string | Reaction<undefined>,
  ...reactions: Reaction<undefined>[]
): ActionCreator<string>

export function declareAction<Type extends ActionType>(
  name: [Type],
  ...reactions: Reaction<undefined>[]
): ActionCreator<Type>

export function declareAction<Payload>(
  name?: string | Reaction<Payload>,
  ...reactions: Reaction<Payload>[]
): PayloadActionCreator<Payload, string>

export function declareAction<Payload, Type extends ActionType>(
  name: [Type],
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
  ACTree.addFn(assign(() => {}, { _ownerAtomId: id }), id as string)

  const actionCreator = function actionCreator(payload?: Payload) {
    return {
      type: id,
      payload,
      reactions,
    }
  } as ActionCreator<Type> | PayloadActionCreator<Payload, Type>

  actionCreator[TREE] = ACTree
  actionCreator.getType = () => id as Type

  return actionCreator
}
