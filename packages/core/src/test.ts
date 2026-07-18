import { type Mock, test as viTest, vi } from 'vitest'

import type { Action, AtomLike } from './core'
import { clearStack, context, top } from './core'
import { type Fn, noop, type Unsubscribe } from './utils'

clearStack()

export const silentQueuesErrors = () => {
  top().root.pushQueue = function pushQueue(cb, queue) {
    this[queue].push(async () => {
      try {
        await cb()
      } catch {
        // nothing
      }
    })
  }
}

const wrapTestCallback = (name: string, fn: Fn) => {
  return (...args: Array<unknown>) => {
    Reflect.defineProperty(fn, 'name', { value: name })
    return context.start(() => fn(...args))
  }
}

const wrapTestArgs = (args: Array<unknown>) => {
  if (typeof args[0] !== 'string') return args

  const next = args.slice()
  for (let i = next.length - 1; i >= 1; i--) {
    if (typeof next[i] === 'function') {
      next[i] = wrapTestCallback(args[0], next[i] as Fn)
      break
    }
  }
  return next
}

const wrappedTestApis = new WeakMap<object, object>()

const wrapVitestTestApi = <T extends object>(api: T): T => {
  const cached = wrappedTestApis.get(api)
  if (cached) return cached as T

  const proxy = new Proxy(api, {
    apply(target, thisArg, argArray) {
      const args = argArray as Array<unknown>
      const result = Reflect.apply(
        target as (...args: Array<unknown>) => unknown,
        thisArg,
        wrapTestArgs(args),
      )
      return typeof result === 'function' ? wrapVitestTestApi(result) : result
    },
    get(target, prop) {
      const value = Reflect.get(target, prop)
      return typeof value === 'function' ? wrapVitestTestApi(value) : value
    },
  })

  wrappedTestApis.set(api, proxy)
  return proxy
}

/**
 * Enhanced version of Vitest's test function that automatically wraps test
 * callbacks in Reatom's context to ensure proper atom tracking and execution
 * within Reatom's reactive system.
 *
 * This wrapper preserves all Vitest modifiers (`skip`, `only`, `todo`, `each`,
 * `skipIf`, …) while adding Reatom-specific context handling, which prevents
 * "missed context" errors when testing Reatom atoms and actions.
 *
 * @example
 *   import { test, expect } from '@reatom/core/test'
 *   import { atom } from '@reatom/core'
 *
 *   test('atom updates correctly', () => {
 *     const counter = atom(0, 'counter')
 *     counter.set(5)
 *     expect(counter()).toBe(5)
 *   })
 *
 * @param name - The name of the test case
 * @param fn - The test function to execute within Reatom context
 * @returns The result of the Vitest test execution
 */
export const test = wrapVitestTestApi(viTest)

export { viTest }

/**
 * Creates a mock subscriber for an atom that tracks all atom updates using
 * Vitest's mock functionality.
 *
 * This utility combines Reatom's subscription mechanism with Vitest's mocking
 * capabilities, providing an easy way to verify atom updates during tests. The
 * returned object is both a Vitest mock function (with call tracking) and has
 * an attached unsubscribe method.
 *
 * @example
 *   import { test, expect, subscribe } from '@reatom/core/test'
 *   import { atom } from '@reatom/core'
 *
 *   test('subscribe captures all updates', () => {
 *     const counter = atom(0, 'counter')
 *     const sub = subscribe(counter)
 *
 *     counter.set(1)
 *     counter.set(2)
 *
 *     expect(sub).toHaveBeenCalledTimes(3) // Initial + 2 updates
 *     expect(sub).toHaveBeenLastCalledWith(2)
 *
 *     sub.unsubscribe() // Stop listening to updates
 *   })
 *
 * @param target - The Reatom atom or computed value to subscribe to
 * @param cb - Optional callback function to execute on each atom update
 * @returns A Vitest mock function with unsubscribe method attached
 */
export function subscribe<Params extends any[], Payload, Result = void>(
  target: Action<Params, Payload>,
  cb?: (payload: Payload, params: Params) => Result,
): Mock<(payload: Payload, params: Params) => Result> & {
  unsubscribe: Unsubscribe
}
export function subscribe<State, T extends (state: State) => any>(
  target: AtomLike<State>,
  cb?: T,
): Mock<T> & { unsubscribe: Unsubscribe }
export function subscribe<State, T extends (state: State) => any>(
  target: AtomLike<State>,
  cb: T = noop as T,
): Mock<T> & { unsubscribe: Unsubscribe } {
  const mock = vi.fn(cb)
  const unsubscribe = target.subscribe(
    // @ts-ignore TODO
    mock,
  )
  return Object.assign(mock, { unsubscribe })
}

/**
 * Re-exports from Vitest for convenient testing.
 *
 * These exports provide all standard Vitest testing utilities while ensuring
 * compatibility with Reatom's testing utilities defined in this file.
 */
export { expectTypeOf } from 'expect-type'
export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  vi,
} from 'vitest'

/**
 * Re-exports all type definitions from Vitest.
 *
 * This ensures that Vitest types are available when importing from
 * '@reatom/core/test'.
 */
export type * from 'vitest'
