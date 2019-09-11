import { Leaf, Action, Tree } from './kernel'
import { TREE, noop, nameToId } from './shared'

export type ActionCreator<Payload = undefined, TType extends Leaf = Leaf> = {
  getType: () => string
  [TREE]: Tree
} & (Payload extends undefined
  ? () => Action<Payload, TType>
  : (payload: Payload) => Action<Payload, TType>)

export function declareAction<
  Payload = undefined,
  TType extends Leaf = Leaf
>(name: string | [TType] = 'action'): ActionCreator<Payload, TType> {
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
