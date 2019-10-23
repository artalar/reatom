import {
  Id,
  Unit,
  KIND_KEY,
  NODE_KEY,
  KIND,
  Node,
  nameToId,
  Name,
  getIsFn,
} from './shared'
import { Store } from './createStore'

export type ActionType = Id
export type ActionBase<Payload = any, Type extends ActionType = string> = {
  type: Type
  payload: Payload
}
export type Reaction<T> = (payload: T, store: Store) => any
export type Action<Payload, Type extends ActionType = string> = ActionBase<
  Payload,
  Type
> & {
  reactions: Reaction<Payload>[]
}

export type ActionCreator<Payload, Type extends ActionType = string> = Unit<
  'action'
> & {
  getType: () => string
  // tuple here required to fix type inference https://github.com/artalar/reatom/issues/192
} & ([Payload] extends [undefined]
    ? (() => Action<undefined, Type>)
    : (payload: Payload) => Action<Payload, Type>)

export function declareAction<Payload = undefined>(
  name?: Name | Reaction<Payload>,
  ...reactions: Reaction<Payload>[]
): ActionCreator<Payload>

export function declareAction<
  Payload = undefined,
  Type extends ActionType = string
>(type: [Type], ...reactions: Reaction<Payload>[]): ActionCreator<Payload, Type>

/**
 * @param name(string | [id]) optional name or id (string)
 * @param ...reactions((payload, store) => void) store call reactions at end of dispatch
 * (after state updates and subscriptions calls)
 * @returns action creator for Flux-standard action
 * (+ 'reactions' fields with reactions array).
 * The type may be generated automatically, based on name
 * or taken strictly from first tuple element
 * @example
 * const add = declareAction()
 * add(42) // { type: 'action [1]', payload: 42, reactions: [] }
 *
 * const increment = declareAction('increment')
 * increment() // { type: 'increment [2]', payload: undefined, reactions: [] }
 *
 * const router = declareAction(['REDUX_ACTION']) // usefully for subscribing
 * router() // { type: 'REDUX_ACTION', payload: undefined, reactions: [] }
 *
 * const fetchUser = declareAction(
 *   'fetchUser',
 *   (id, store) => fetch(`/user/${id}`)
 *     .then(user => store.dispatch(fetchUserDone(user)))
 *     .catch(user => store.dispatch(fetchUserFail(user)))
 * )
 * fetchUser(42) // { type: 'fetchUser [3]', payload: 42, reactions: [Function] }
 */
export function declareAction<Payload, Type extends ActionType>(
  name: string | [Type] | Reaction<Payload> = 'action',
  ...reactions: Reaction<Payload>[]
): ActionCreator<Payload, Type> {
  if (getIsFn(name)) {
    reactions.unshift(name)
    name = 'action'
  }
  const id = nameToId(name)
  const node = new Node(id)
  node.depsAll.push(id)

  // TODO: refactoring types
  // @ts-ignore
  const actionCreator: ActionCreator<Payload, Type> = (payload?: Payload) => ({
    type: id,
    payload,
    reactions,
  })

  actionCreator[NODE_KEY] = node
  actionCreator[KIND_KEY] = KIND.action
  actionCreator.getType = () => id

  return actionCreator
}
