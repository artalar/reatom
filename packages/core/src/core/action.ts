import type { Fn, Unsubscribe } from '../utils'
import type { AtomLike, Ext } from './'
import {
  _recompile,
  actionMiddleware,
  createAtom,
  isAtom,
  named,
  ReatomError,
} from './'

export interface ActionCall<Params extends any[] = any[], Payload = any> {
  params: Params
  payload: Payload
}

/** Autoclearable array of processed events */
export interface ActionState<
  Params extends any[] = any[],
  Payload = any,
> extends Array<ActionCall<Params, Payload>> {}

/** Logic container with atom features */
export interface Action<
  Params extends any[] = any[],
  Payload = any,
> extends AtomLike<ActionState<Params, Payload>, Params, Payload> {
  subscribe: (
    cb?: (payload: Payload, params: Params) => any,
    errorCb?: (error: unknown) => any,
  ) => Unsubscribe
}

/** Action type that supports all overloads of the original function */
export type GAction<T extends Fn> = T & Action<Parameters<T>, ReturnType<T>>

/**
 * Type guard to check if a value is a Reatom action.
 *
 * This function determines whether the given value is an action by checking if
 * it's an atom with non-reactive behavior (actions are non-reactive atoms).
 *
 * @param target - The value to check
 * @returns `true` if the value is a Reatom action, `false` otherwise
 */
export let isAction = (target: unknown): target is Action =>
  isAtom(target) && !target.__reatom.reactive

/**
 * Creates an extension that adds middleware to an action, wrapping only the
 * call function, not the state.
 *
 * Unlike `withMiddleware`, which wraps the entire middleware chain (including
 * the state update), `withActionMiddleware` wraps only the call function that
 * gets passed to `actionMiddleware`. This allows you to decorate the action's
 * execution logic without interfering with the action's state management.
 *
 * @example
 *   // Creating a retry middleware for actions
 *   const withRetry = (maxAttempts: number) =>
 *     withActionMiddleware((target) => {
 *       return (next, ...params) => {
 *         let attempts = 0
 *         while (attempts < maxAttempts) {
 *           try {
 *             return next(...params)
 *           } catch (error) {
 *             attempts++
 *             if (attempts >= maxAttempts) throw error
 *           }
 *         }
 *       }
 *     })
 *
 *   // Using the middleware
 *   const fetchData = action(async () => {
 *     const response = await fetch('/api/data')
 *     return response.json()
 *   }).extend(withRetry(3))
 *
 * @template Target - The type of action the middleware will be applied to
 * @param cb - A function that receives the target action and returns a
 *   middleware function that wraps the call
 * @returns An extension that applies the middleware when used with .extend()
 */
// @ts-ignore
export let withActionMiddleware: {
  <Params extends any[] = any[], Payload = any>(
    cb: (
      target: Action<Params, Payload>,
    ) => (next: Fn, ...params: Params) => Payload,
  ): Ext<Action<Params, Payload>>
} =
  (cb: (target: Action) => (next: Fn, ...params: any[]) => any) =>
  (target: Action) => {
    const actionMiddlewareIdx =
      target.__reatom.middlewares.indexOf(actionMiddleware)

    if (!isAction(target) || actionMiddlewareIdx === -1) {
      throw new ReatomError(
        'withActionMiddleware can only be applied to actions',
      )
    }

    target.__reatom.middlewares.splice(actionMiddlewareIdx, 0, cb(target))
    _recompile(target)

    return target
  }

/**
 * Creates a logic and side effect container.
 *
 * Actions are used to encapsulate complex logic, perform side effects (like API
 * calls), and orchestrate multiple state updates. Unlike atoms, actions are
 * meant to be called with parameters and can return values.
 *
 * Actions also have atom-like features (subscribe, extend) and track their call
 * history.
 *
 * @example
 *   // Create an action that fetches data and updates state
 *   const fetchUserData = action(async (userId: string) => {
 *     const response = await wrap(fetch(`/api/users/${userId}`))
 *     const data = await wrap(response.json())
 *
 *     // Update state atoms with the fetched data
 *     userName(data.name)
 *     userEmail(data.email)
 *
 *     return data // Actions can return values
 *   }, 'fetchUserData')
 *
 *   // Call the action
 *   fetchUserData('user123')
 *
 * @template Params - The parameter types the action accepts
 * @template Payload - The return type of the action
 * @param cb - The function containing the action's logic
 * @param name - Optional name for debugging purposes
 * @returns An action instance that can be called with the specified parameters
 */
export function action<T extends (...a1: never[]) => any>(
  cb: T,
  name?: string,
): GAction<T>
export function action<Params extends any[] = any[], Payload = any>(
  cb: (...params: Params) => Payload,
  name?: string,
): Action<Params, Payload>
export function action(cb: Fn, name = named('action', cb.name)): Action {
  return createAtom(
    { initState: [], computed: cb as any, reactive: false },
    name,
  ) as unknown as Action
}
