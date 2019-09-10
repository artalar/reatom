import { Leaf, Tree } from './kernel'
import { TREE, noop, nameToId } from './shared'

export type ActionType = Leaf

export type Action<Payload, Type extends ActionType = string> = {
  type: Type
  payload: Payload
}

export type ActionCreator<Payload = undefined, Type extends string = string> = {
  getType: () => string
  [TREE]: Tree
} & (Payload extends undefined
  ? () => Action<Payload, Type>
  : (payload: Payload) => Action<Payload, Type>)

export function declareAction<
  Payload = undefined,
  Type extends ActionType = string
>(name: string | [Type] = 'action'): ActionCreator<Payload, Type> {
  const id = nameToId(name)

  const ACTree = new Tree(id, true)
  ACTree.addFn(noop, id)

  function actionCreator(payload?: Payload) {
    return {
      type: id,
      payload,
    }
  }

  // @ts-ignore
  actionCreator[TREE] = ACTree
  actionCreator.getType = () => id

  // @ts-ignore
  return actionCreator
}
