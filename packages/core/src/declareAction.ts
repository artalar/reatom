import { Leaf, Tree, BaseAction } from './kernel'
import { TREE, nameToId, Unit, assign } from './shared'
import { Store } from './createStore'

export type ActionType = Leaf
export type Reaction<T> = (payload: T, store: Store) => any

/**
 * Action is a packet of data sent to the store for processing by atoms.
 *
 * > See more info about [flux standard action](https://github.com/redux-utilities/flux-standard-action):
 *
 * #### Signature
 *
 * ```ts
 * type Reaction<T> = (payload: T, store: Store) => void
 *
 * interface Action<T> {
 *   type: string,
 *   payload: Payload<T>,
 *   reactions?: Reaction<T>[]
 * }
 * ```
 *
 * #### Examples
 *
 * Basic
 *
 * ```js
 * {
 *   type: 'auth',
 *   payload: { user: 'Sergey' }
 * }
 * ```
 *
 * With reactions
 * ```js
 * {
 *   type: 'auth',
 *   payload: { user: 'Sergey' },
 *   reactions: [
 *     payload => console.log(payload),
 *     payload => console.log(payload.user),
 *   ]
 * }
 * ```
 */
export type Action<Payload, Type extends ActionType = string> = BaseAction<
  Payload
> & {
  type: Type
  reactions?: Reaction<Payload>[]
}

export type BaseActionCreator<Type extends string = string> = {
  getType: () => Type
} & Unit

/**
 * Function for crating action packages
 *
 * ```ts
 * interface ActionCreator {
 *   (): Action<T>,
 *   getType(): string
 * }
 * ```
 *
 */
export type ActionCreator<Type extends string = string> = BaseActionCreator<
  Type
> &
  (() => Action<undefined, Type>)

export type PayloadActionCreator<
  Payload,
  Type extends string = string
> = BaseActionCreator<Type> & ((payload: Payload) => Action<Payload, Type>)

/**
 * Added in: v1.0.0
 *
 * ```js
 * import { declareAction } from '@reatom/core'
 * ```
 *
 * #### Description
 *
 * A function to create the Declaration of the action.
 *
 * #### Signature
 *
 * ```typescript
 * // overload 1
 * declareAction<P>(...reactions: Reaction<P>[]): ActionCreator<P>
 *
 * // overload 2
 * declareAction<P>(type: string | [string], ...reactions: Reaction<P>[]): ActionCreator<P>
 * ```
 *
 * **Arguments**
 * - **type** `string` | `[string]` - optional
 * - **...reactions** [`Reaction[]`](./Reaction) - optional
 *
 * **Returns** [`ActionCreator`](./ActionCreator)
 *
 * #### Examples
 *
 * Basic
 * ```js
 * const action = declareAction()
 * ```
 *
 * With type
 * ```js
 * const action = declareAction('myAction')
 * ```
 *
 * With static type
 * ```js
 * const action = declareAction(['myAction'])
 * ```
 *
 * With reaction
 * ```js
 * const action = declareAction((payload, store) => {
 *   store.dispatch(otherAction())
 * })
 * ```
 *
 * With type and reaction
 * ```js
 * const action = declareAction('myAction', (payload, store) => {
 *   store.dispatch(otherAction())
 * })
 * ```
 */
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
  ACTree.addFn(
    assign(() => {}, { _ownerAtomId: id }),
    id as string,
  )

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
