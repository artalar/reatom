import type { AsyncExt } from '../async'
import type { Action, Atom, AtomState, Ext, Frame } from '../core'
import {
  _read,
  action,
  bind,
  isAction,
  top,
  withActionMiddleware,
  withMiddleware,
} from '../core'
import { withCallHook } from '../extensions'
import type { Fn } from '../utils'
import { isAbort } from '../utils'
import type { Variable } from './variable'
import { variable } from './variable'

export type Rollbacks = Array<Fn>

/**
 * Extension result for actions that use `withTransaction`.
 *
 * Adds a `rollback` method to manually trigger rollback for the last action
 * call.
 */
export interface TransactionExt {
  /**
   * Rollback action that executes all collected rollback functions from the
   * last call of this action.
   *
   * Each action call has its own rollback scope. Calling `rollback()` only
   * reverts changes from the most recent call, not all previous calls.
   *
   * @example
   *   const counter = atom(0, 'counter').extend(withRollback())
   *
   *   const increment = action(() => {
   *     counter.set((n) => n + 1)
   *   }, 'increment').extend(withTransaction())
   *
   *   increment() // counter: 1
   *   increment.rollback() // counter: 0
   *
   * @param {any} [error] - Optional error that triggered the rollback
   */
  rollback: Action<[error?: any], void>

  /**
   * Stop action that clears all collected rollback functions from the last call
   * of this action without executing them.
   *
   * Use this when you want to "commit" the transaction and prevent any future
   * rollback from reverting the changes.
   *
   * @example
   *   const todos = atom<Todo[]>([], 'todos').extend(withRollback())
   *
   *   const addTodo = action(async (todo: Todo) => {
   *     todos.set((list) => [...list, todo]) // optimistic update
   *     await wrap(api.saveTodo(todo))
   *     addTodo.stop() // success - commit the change, prevent rollback
   *   }, 'addTodo').extend(withAsync(), withTransaction())
   *
   *   // On success: stop() prevents rollback from todos hooks or other code, todo stays in the list
   *   // On failure: withTransaction() auto-rollbacks, todo is removed
   */
  stop: Action<[], void>
}

interface TransactionVariable extends Variable<Rollbacks, [Rollbacks?]> {
  /**
   * Extension to schedule state restoration for atoms when `rollback()` is
   * called within the same transaction context.
   *
   * This extension tracks state changes on atoms and registers rollback
   * functions that restore the previous state when the transaction's `rollback`
   * action is invoked. The rollback functions are executed in reverse order
   * (LIFO) to properly unwind nested state changes.
   *
   * **When to use:**
   *
   * - For atoms that participate in optimistic updates
   * - When you need automatic state restoration on transaction failure
   * - In combination with `withTransaction` on actions that may fail
   *
   * **How it works:**
   *
   * 1. When the atom's state changes, the previous state is captured
   * 2. A rollback function is registered in the current transaction
   * 3. If `rollback()` is called, all registered functions execute in reverse
   *    order
   * 4. Changes caused by `rollback()` itself don't register new rollback functions
   *
   * @example
   *   const counter = atom(0, 'counter').extend(
   *     withRollback(), // Schedule state restoration for rollback()
   *   )
   *
   *   const increment = action(() => {
   *     counter.set((n) => n + 1)
   *   }, 'increment').extend(withTransaction())
   *
   *   increment() // counter: 1
   *   increment.rollback() // counter: 0
   *
   * @example
   *   // Optimistic update pattern with automatic rollback
   *   const list = atom<string[]>([], 'list').extend(
   *     withChangeHook(saveList), // Trigger save on change
   *     withRollback(), // Restore on failure
   *   )
   *
   *   const saveList = action(async () => {
   *     await api.save(list())
   *   }, 'saveList').extend(withAsync(), withTransaction())
   *
   * @example
   *   // Custom rollback transformation for list state
   *   const list = atom<string[]>([], 'list').extend(
   *     withRollback({
   *       onRollback: ({ beforeState, currentState, transactionState }) => {
   *         // Remove only the items that were added in the rolled-back change
   *         const addedItems = transactionState.filter(
   *           (item) => !beforeState.includes(item),
   *         )
   *         return currentState.filter((item) => !addedItems.includes(item))
   *       },
   *     }),
   *   )
   *
   * @returns Extension function to be used with `.extend()` on atoms
   * @see {@link withTransaction} For handling errors in actions and triggering
   *   rollback
   */
  withRollback<Target extends Atom>(options?: {
    /**
     * Custom state transformation function called during rollback.
     *
     * Use this when the default rollback behavior (restore to `beforeState`
     * only if `currentState === transactionState`) doesn't fit your needs.
     *
     * @default
     *   ({ beforeState, currentState, transactionState }) =>
     *     Object.is(currentState, transactionState) ? beforeState : currentState
     * @param params.beforeState - State before the change in transaction
     * @param params.transactionState - State after the change in transaction
     * @param params.currentState - Current state at the time rollback executes
     * @returns The state to set after rollback
     */
    onRollback?: Rollback<AtomState<Target>>
  }): Ext<Target>

  /**
   * Extension to handle errors in actions and automatically call `rollback()`.
   * Also adds a `rollback` method to the action for manual rollback.
   *
   * Each action call has its own rollback scope. The `action.rollback()` method
   * only reverts changes from the most recent call.
   *
   * **How it works:**
   *
   * - For actions with `withAsync()`: hooks into `onReject` to call `rollback()`
   * - For plain actions returning promises: catches rejections and calls
   *   `rollback()`
   * - For synchronous errors: catches and calls `rollback()`, then re-throws
   * - Abort errors are ignored (they don't trigger rollback)
   * - Optional `shouldRollback` callback filters which errors trigger rollback
   *   (by default all non-Abort errors trigger rollback)
   *
   * @example
   *   const counter = atom(0, 'counter').extend(withRollback())
   *
   *   const increment = action(() => {
   *     counter.set((n) => n + 1)
   *   }, 'increment').extend(withTransaction())
   *
   *   increment() // counter: 1
   *   increment.rollback() // counter: 0
   *
   * @example
   *   // Optimistic update with automatic rollback on failure
   *   const todos = atom<Todo[]>([], 'todos').extend(withRollback())
   *
   *   const saveTodos = action(async () => {
   *     todos.set((list) => [...list, optimisticTodo])
   *     await api.save(todos())
   *   }, 'saveTodos').extend(withAsync(), withTransaction())
   *
   *   saveTodos() // On failure, todos will rollback automatically
   *
   * @example
   *   // Only rollback on network errors, not validation errors
   *   const save = action(async () => { ... }, 'save').extend(
   *   withAsync(),
   *   withTransaction({
   *   shouldRollback: (error) => error instanceof NetworkError,
   *   }),
   *   )
   *
   * @see {@link withRollback} For scheduling atom state restoration
   */
  withTransaction<Target extends Action>(options?: {
    /**
     * Filter which errors should trigger rollback. When omitted, all non-Abort
     * errors trigger rollback.
     */
    shouldRollback?: (error: unknown) => boolean
  }): (target: Target) => TransactionExt

  /**
   * Executes all collected rollback functions in the current transaction
   * context.
   *
   * This action processes the rollback queue in reverse order (LIFO - Last In,
   * First Out), ensuring that nested state changes are properly unwound. After
   * execution, the rollback queue is cleared.
   *
   * **Important:** This action looks for the transaction variable in the
   * current frame stack. If called outside of an action's frame context (where
   * `withRollback` atoms were modified), it won't find any rollbacks. Use
   * `action.rollback()` from actions extended with `withTransaction()` for
   * manual rollback from outside the action context.
   *
   * **Behavior:**
   *
   * - Only affects rollbacks registered in the current transaction context
   * - Executes rollbacks in reverse registration order
   * - Clears the rollback queue after execution
   * - Safe to call when no rollbacks are registered (no-op)
   * - Accepts an optional error parameter for logging/debugging purposes
   *
   * @example
   *   // Rollback from within an action (works because same frame context)
   *   const draft = atom('', 'draft').extend(withRollback())
   *
   *   const updateAndValidate = action((text: string) => {
   *     draft.set(text)
   *     if (text.length < 3) {
   *       rollback() // Works: same frame context
   *     }
   *   }, 'updateAndValidate').extend(withTransaction())
   *
   * @example
   *   // Manual rollback from outside action (use action.rollback())
   *   const counter = atom(0, 'counter').extend(withRollback())
   *
   *   const increment = action(() => {
   *     counter.set((n) => n + 1)
   *   }, 'increment').extend(withTransaction())
   *
   *   increment()
   *   increment.rollback() // Use action.rollback() for external rollback
   *
   * @param {any} [error] - Optional error that triggered the rollback (for
   *   debugging)
   */
  rollback: Action<[error?: any], void>
}

export type Rollback<State = any> = ({
  beforeState,
  currentState,
  transactionState,
}: {
  beforeState: State
  currentState: State
  transactionState: State
}) => State

/**
 * Default rollback strategy for `withRollback` extension.
 *
 * This function determines what state to restore when a rollback occurs. It
 * only restores the `beforeState` if the `currentState` hasn't changed since
 * the transaction started (i.e., `currentState === transactionState`). If the
 * state was modified after the transaction, it preserves the current state to
 * avoid overwriting unrelated changes.
 *
 * @param params.beforeState - State before the change in transaction
 * @param params.transactionState - State after the change in transaction
 * @param params.currentState - Current state at the time rollback executes
 * @returns The state to set after rollback
 * @see {@link reatomTransaction} To customize the default rollback for a
 *   transaction scope
 * @see {@link withRollback} To customize rollback per-atom via `onRollback`
 *   option
 */
export let defaultRollback: Rollback = ({
  beforeState,
  currentState,
  transactionState,
}) => (Object.is(currentState, transactionState) ? beforeState : currentState)

/**
 * Creates an isolated transaction context with rollback capabilities.
 *
 * Use this to create feature-specific transaction scopes. For most cases, use
 * the global `withRollback` and `withTransaction` exports instead.
 *
 * @example
 *   // Create a custom transaction scope for a specific feature
 *   const formTransaction = reatomTransaction({ name: 'form' })
 *
 *   const formData = atom({ name: '', email: '' }, 'formData').extend(
 *     formTransaction.withRollback(),
 *   )
 *
 *   const submitForm = action(async () => {
 *     // ... form submission logic
 *   }, 'submitForm').extend(withAsync(), formTransaction.withTransaction())
 *
 * @example
 *   // Custom default rollback strategy for all atoms in the scope
 *   const alwaysRestoreTransaction = reatomTransaction({
 *     name: 'alwaysRestore',
 *     defaultRollback: ({ beforeState }) => beforeState, // Always restore
 *   })
 *
 * @param options.name - Unique name for the transaction scope (used in debug)
 * @param options.defaultRollback - Custom rollback strategy applied to all
 *   atoms using `withRollback()` from this transaction scope. Defaults to
 *   {@link defaultRollback} which only restores state if it hasn't changed since
 *   the transaction. Can be overridden per-atom via the `onRollback` option in
 *   `withRollback()`.
 * @returns Transaction variable with `withRollback`, `withTransaction`, and
 *   `rollback` methods
 * @see {@link defaultRollback} The default rollback strategy
 * @see {@link withRollback} Extension for atoms
 * @see {@link withTransaction} Extension for actions
 */
export let reatomTransaction = ({
  defaultRollback: onRollbackDefault = defaultRollback,
  name,
}: {
  /**
   * Unique name for the transaction scope.
   *
   * Used for debugging and identifying transaction contexts.
   */
  name: string
  /**
   * Custom rollback strategy applied to all atoms using `withRollback()` from
   * this transaction scope.
   *
   * @default defaultRollback
   * @see {@link defaultRollback}
   */
  defaultRollback?: Rollback
}): TransactionVariable => {
  let findRollbacks = (frame: null | Frame = top()): undefined | Rollbacks => {
    let visited = new Set<Frame>()

    while (frame && !visited.has(frame)) {
      visited.add(frame)

      let rollbacks = transactionVar.first(frame)
      if (rollbacks !== undefined) return rollbacks

      frame = frame.pubs[0]
    }

    return undefined
  }

  /**
   * Queues currently being drained by a rollback flush.
   *
   * A write performed by the flush itself must not register an "undo of the
   * undo" into the queue it is draining — otherwise a repeated `rollback()`
   * would re-apply the rolled-back state instead of being a no-op. Marking the
   * queue (instead of inspecting the write's cause chain) keeps unrelated
   * scopes intact by construction: a fresh transaction owns a fresh queue, so
   * its writes always register no matter what ancestry the caller carries —
   * subscriber callbacks run in the atom's live frame, so a handler created
   * inside one (what UI bindings do on every render) may well have a past
   * rollback in its chain (see the "subscriber-created wrap" test).
   */
  let flushing = new WeakSet<Rollbacks>()

  let flushRollbacks = (rollbacks: undefined | Rollbacks) => {
    if (!rollbacks) return
    flushing.add(rollbacks)
    try {
      rollbacks
        .splice(0)
        .reverse()
        .forEach((rollback) => rollback())
    } finally {
      flushing.delete(rollbacks)
    }
  }

  let transactionVar = Object.assign(
    variable((rollbacks: Array<Fn> = []) => rollbacks, `transaction#${name}`),
    {
      withRollback:
        <Target extends Atom>(options?: {
          onRollback?: Rollback<AtomState<Target>>
        }): Ext<Target> =>
        (target: Target): Target => {
          if (isAction(target) as any) {
            throw new Error(
              'withRollback is for atoms only, use withTransaction for actions',
            )
          }

          let { onRollback = onRollbackDefault } = options ?? {}

          withMiddleware(
            () =>
              function withRollback(next: Fn, ...params: any[]) {
                let prevState = top().state
                let nextState = next(...params)

                if (!Object.is(prevState, nextState)) {
                  let rollbacks = findRollbacks()
                  if (rollbacks && !flushing.has(rollbacks)) {
                    rollbacks.push(() =>
                      target.set((state) =>
                        onRollback({
                          beforeState: prevState,
                          currentState: state,
                          transactionState: nextState,
                        }),
                      ),
                    )
                  }
                }
                return nextState
              },
          )(target)

          return target
        },

      withTransaction<Target extends Action>(options?: {
        shouldRollback?: (error: unknown) => boolean
      }): (target: Target) => TransactionExt {
        let filter = options?.shouldRollback ?? ((_error: unknown) => true)

        return (target: Target): TransactionExt => {
          if (!isAction(target)) {
            throw new Error(
              'withTransaction is for actions only, use withRollback for atoms',
            )
          }

          let triggerRollback = (error: unknown) => {
            if (!isAbort(error) && filter(error)) {
              transactionVar.rollback(error)
            }
          }

          if ('onReject' in target) {
            ;(target.onReject as AsyncExt['onReject']).extend(
              withCallHook(({ error }) => triggerRollback(error)),
            )
          }

          withActionMiddleware(
            () =>
              function withTransaction(next: Fn, ...params: any[]) {
                let parentRollbacks = findRollbacks(top().pubs[0])
                let selfRollbacks = transactionVar.set()

                parentRollbacks?.push(() => flushRollbacks(selfRollbacks))

                try {
                  let result = next(...params)
                  if (!('onReject' in target) && result instanceof Promise) {
                    result.catch(bind(triggerRollback))
                  }
                  return result
                } catch (error) {
                  triggerRollback(error)
                  throw error
                }
              },
          )(target)

          let actionRollback = action<[error?: any], void>(
            (/* just for debug: */ error) => {
              _read(target)?.run(transactionVar.rollback, error)
            },
            `${target.name}.rollback`,
          )

          let actionStop = action<[], void>(() => {
            _read(target)?.run(() => findRollbacks()?.splice(0))
          }, `${target.name}.stop`)

          return { rollback: actionRollback, stop: actionStop }
        }
      },

      rollback: action<[error?: any], void>(() => {
        flushRollbacks(findRollbacks())
      }, 'transactionVar.rollback'),
    },
  )

  return transactionVar
}

/**
 * Global transaction variable instance.
 *
 * @see {@link reatomTransaction} To create isolated transaction contexts
 */
export let transactionVar = /* @__PURE__ */ reatomTransaction({
  name: 'default',
})

const initWithRollback = () => transactionVar.withRollback
const initWithTransaction = () => transactionVar.withTransaction
const initRollback = () => transactionVar.rollback

/** @see {@link TransactionVariable.withRollback} */
export let withRollback = /* @__PURE__ */ initWithRollback()

/** @see {@link TransactionVariable.withTransaction} */
export let withTransaction = /* @__PURE__ */ initWithTransaction()

/** @see {@link TransactionVariable.rollback} */
export let rollback = /* @__PURE__ */ initRollback()
