import type { AtomLike, Ext } from '../core'
import { _enqueue, _recompile, ReatomError, top, withMiddleware } from '../core'
import type { OverloadParameters, Unsubscribe } from '../utils'

/**
 * Executes a callback whenever the target atom or action throws during an
 * update or call.
 *
 * The hook fires in the "Hooks" phase via the reactive queue, after the failed
 * operation throws synchronously to the caller. The original error is always
 * re-thrown.
 *
 * @example
 *   const field = atom(0, 'field').extend(
 *     withParams((value: number) => {
 *       if (value < 0) throw new Error('negative')
 *       return value
 *     }),
 *     withErrorHook((error, params) => {
 *       console.error('Invalid value', params, error)
 *     }),
 *   )
 *
 * @template Target - The atom or action type being extended
 * @param cb - Callback fired when the target throws. Receives:
 *
 *   - `error` - The thrown error
 *   - `params` - The parameters passed to the failed update or call
 *
 * @returns Extension function to be used with `.extend()`
 * @throws {ReatomError} If callback is not a function
 * @see {@link addErrorHook} For dynamically adding/removing error hooks
 * @see {@link withChangeHook} For reacting to successful state changes
 * @see {@link withCallHook} For reacting to successful action calls
 */
export let withErrorHook = <Target extends AtomLike>(
  cb: (error: unknown, params: OverloadParameters<Target>) => void,
): Ext<Target> => {
  if (typeof cb !== 'function') {
    throw new ReatomError('function expected')
  }

  return withMiddleware<Target>(
    () =>
      function withErrorHook(next, ...params) {
        let frame = top()

        try {
          // @ts-ignore
          return next(...params)
        } catch (error) {
          _enqueue(() => {
            frame.run(cb, error, params as OverloadParameters<Target>)
          }, 'hook')

          throw error
        }
      },
  )
}

/**
 * Dynamically adds an error hook to an existing atom or action and returns a
 * function to remove it.
 *
 * @template T - The atom or action type
 * @param target - The atom or action to attach the hook to
 * @param cb - Callback fired when the target throws
 * @returns Unsubscribe function to remove this specific hook
 * @see {@link withErrorHook} For adding hooks at atom definition time
 */
export let addErrorHook = <T extends AtomLike>(
  target: T,
  cb: (error: unknown, params: OverloadParameters<T>) => void,
): Unsubscribe => {
  let { middlewares } = target.__reatom
  let before = new Set(middlewares)

  target.extend(withErrorHook(cb))

  let hook = middlewares.find((middleware) => !before.has(middleware))
  if (!hook) {
    throw new ReatomError('Failed to add error hook')
  }

  return () => {
    let index = middlewares.indexOf(hook)
    if (index !== -1) {
      middlewares.splice(index, 1)
      _recompile(target)
    }
  }
}
