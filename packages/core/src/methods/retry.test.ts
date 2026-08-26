import { expect, test } from 'test'

import { withAsync } from '../async'
import { _read, action, atom, computed, isConnected } from '../core'
import { withConnectHook } from '../extensions'
import { sleep } from '../utils'
import { retryComputed } from './retry'
import { wrap } from './wrap'

test('action retry disabled by default', async () => {
  const name = 'actionRetryDisabled'
  const fetch = action(async (param: number) => param, `${name}.fetch`).extend(
    withAsync(),
  )

  expect(() => retryComputed(fetch)).toThrow('Only reactive atoms can be reset')
})

test('retryComputed should recalculate dependent computeds', async () => {
  const computedA = computed(() => Math.random(), 'computedA')
  const computedB = computed(() => computedA() * 10, 'computedB')

  // Subscribe to both to track them
  const valuesA: number[] = []
  const valuesB: number[] = []

  computedA.subscribe((v) => valuesA.push(v))
  computedB.subscribe((v) => valuesB.push(v))

  // Wait for initial subscriptions to settle
  await wrap(Promise.resolve())

  const initialA = valuesA[0]!
  const initialB = valuesB[0]!

  expect(initialB).toBe(initialA * 10)
  expect(valuesA.length).toBe(1)
  expect(valuesB.length).toBe(1)

  // Retry computedA - should recalculate both A and B
  retryComputed(computedA)

  // Wait for notifications to propagate
  await wrap(Promise.resolve())

  const newA = valuesA[1]!
  const newB = valuesB[1]!

  expect(valuesA.length).toBe(2)
  expect(valuesB.length).toBe(2) // This is the bug - computedB is not notified
  expect(newA).not.toBe(initialA) // Should be a new random value
  expect(newB).toBe(newA * 10) // computedB should have recalculated
})

test('retryComputed does not duplicate the target in its dependency subs', () => {
  const source = atom(0, 'leak.source')
  const derived = computed(() => source(), 'leak.derived')

  const unsubscribe = derived.subscribe(() => {})

  expect(_read(source)!.subs.length).toBe(1)

  retryComputed(derived)
  retryComputed(derived)
  retryComputed(derived)

  expect(_read(source)!.subs.length).toBe(1)

  unsubscribe()
})

test('a retried computed still disconnects its dependencies when unsubscribed', async () => {
  let connected = 0
  let disconnected = 0

  const source = atom(0, 'leak2.source').extend(
    withConnectHook(() => {
      connected++
      return () => {
        disconnected++
      }
    }),
  )
  const derived = computed(() => source(), 'leak2.derived')

  const unsubscribe = derived.subscribe(() => {})
  await wrap(sleep())
  expect(connected).toBe(1)

  retryComputed(derived)
  retryComputed(derived)
  await wrap(sleep())

  unsubscribe()
  await wrap(sleep())

  expect(isConnected(source)).toBe(false)
  expect(disconnected).toBe(connected)
})
