import { Leaf, Action, Tree } from './kernel'
import { TREE, noop, nameToId } from './shared'

export type ActionCreator<TPayload = undefined, TType extends Leaf = Leaf> = {
  getType: () => string
  [TREE]: Tree
} & (TPayload extends undefined
  ? () => Action<TPayload, TType>
  : (payload: TPayload) => Action<TPayload, TType>)

export function declareAction<
  TPayload = undefined,
  TType extends Leaf = Leaf
>(name: string | [TType] = 'action'): ActionCreator<TPayload, TType> {
  const id = nameToId(name)

  const ACTree = new Tree(id, true)
  ACTree.addFn(noop, id)

  function actionCreator(payload?: TPayload) {
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
