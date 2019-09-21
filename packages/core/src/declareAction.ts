import { Leaf, Tree } from './kernel'
import { TREE, noop, nameToId, Unit } from './shared'
import { Store } from './createStore'

export type ActionType = Leaf

export type Reaction<T> = (payload: T, store: Store) => any

export type Action<Payload, Type extends ActionType = string> = {
  type: Type
  payload: Payload
  reactions: Reaction<Payload>[]
}

export type ActionCreator<Payload = undefined, Type extends string = string> = {
  getType: () => string
} & Unit &
  (Payload extends undefined
    ? () => Action<Payload, Type>
    : (payload: Payload) => Action<Payload, Type>)

export function declareAction<
  Payload = undefined,
  Type extends ActionType = string
>(
  name: string | [Type] | Reaction<Payload> = 'action',
  ...reactions: Reaction<Payload>[]
): ActionCreator<Payload, Type> {
  if (typeof name === 'function') {
    reactions.unshift(name as any)
    name = 'action'
  }
  const id = nameToId(name)

  const ACTree = new Tree(id, true)
  ACTree.addFn(noop, id)

  function actionCreator(payload?: Payload) {
    return {
      type: id,
      payload,
      reactions,
    }
  }

  // @ts-ignore
  actionCreator[TREE] = ACTree
  actionCreator.getType = () => id

  // @ts-ignore
  return actionCreator
}
