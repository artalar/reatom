import { expect, test, vi } from 'test'

import { action, atom, computed } from '../core'
import { wrap } from '../methods'
import { noop, sleep } from '../utils'
import { withAsync } from './withAsync'
import { withAsyncData } from './withAsyncData'
import {
  exponentialBackoff,
  retryOnReject,
  retryQueue,
  revalidateOnFulfill,
  withRetry,
} from './withRetry'

test('default retry waits one second and runs only while connected', async () => {
  const name = 'withRetryDefault'
  let calls = 0
  const fetch = action(async () => {
    calls++
    if (calls === 1) throw new Error('fail')
    return calls
  }, `${name}.fetch`).extend(withRetry())

  let unsubscribe = fetch.subscribe()

  await wrap(fetch().catch(noop))

  expect(calls).toBe(1)

  await wrap(sleep(1_010))

  expect(calls).toBe(2)

  unsubscribe()
})

test('skips hooks while disconnected by default', async () => {
  const name = 'withRetryDisconnected'
  let calls = 0
  const fetch = action(async () => {
    calls++
    throw new Error('fail')
  }, `${name}.fetch`).extend(
    withRetry({ onReject: retryOnReject({ delay: 0 }) }),
  )

  await wrap(fetch().catch(noop))
  await wrap(sleep())

  expect(calls).toBe(1)
})

test('can retry disconnected targets by option', async () => {
  const name = 'withRetryAlways'
  let calls = 0
  const fetch = action(async () => {
    calls++
    if (calls === 1) throw new Error('fail')
    return calls
  }, `${name}.fetch`).extend(
    withRetry({ connected: false, onReject: retryOnReject({ delay: 0 }) }),
  )

  await wrap(fetch().catch(noop))
  await wrap(sleep())

  expect(calls).toBe(2)
})

test('works with async computeds and custom hooks', async () => {
  const name = 'withRetryComputed'
  let calls = 0
  let rejects = 0
  let fulfills = 0
  const param = atom(1, `${name}.param`)
  const resource = computed(async () => {
    calls++
    let state = param()
    if (calls === 1) throw new Error('fail')
    return state + calls
  }, `${name}.resource`).extend(
    withAsyncData({ initState: 0 }),
    withRetry({
      onReject: [
        (event) => {
          rejects++
          retryOnReject({ delay: 0, budget: 1 })(event)
        },
      ],
      onFulfill: [
        () => {
          fulfills++
        },
      ],
    }),
  )

  let unsubscribe = resource.data.subscribe()

  await wrap(sleep())
  await wrap(sleep())

  expect(resource.data()).toBe(3)
  expect(rejects).toBe(1)
  expect(fulfills).toBe(1)

  unsubscribe()
})

test('supports exponential backoff with deterministic jitter', () => {
  const random = Math.random
  Math.random = () => 0.5

  try {
    const delay = exponentialBackoff({
      base: 10,
      factor: 2,
      max: 30,
      jitter: 0.5,
    })

    expect(delay(1, undefined)).toBe(10)
    expect(delay(2, undefined)).toBe(20)
    expect(delay(3, undefined)).toBe(30)
  } finally {
    Math.random = random
  }
})

test('supports retry budgets', async () => {
  const name = 'withRetryBudget'
  let calls = 0
  const fetch = action(async () => {
    calls++
    throw new Error('fail')
  }, `${name}.fetch`).extend(
    withRetry({
      connected: false,
      onReject: retryOnReject({ budget: 2, delay: 0 }),
    }),
  )

  await wrap(fetch().catch(noop))
  await wrap(sleep(10))

  expect(calls).toBe(3)
})

test('supports retry queues', async () => {
  let active = 0
  let maxActive = 0
  const queue = retryQueue({ maxParallel: 1 })

  let task = async () => {
    active++
    maxActive = Math.max(maxActive, active)
    await sleep(5)
    active--
  }

  await wrap(Promise.all([queue.push(task), queue.push(task)]))

  expect(maxActive).toBe(1)
})

test('revalidates fulfilled data after stale time while connected', async () => {
  const name = 'withRetryStale'
  let calls = 0
  const resource = computed(async () => ++calls, `${name}.resource`).extend(
    withAsyncData({ initState: 0 }),
    withRetry({
      onReject: false,
      onFulfill: revalidateOnFulfill({ staleTime: 5 }),
    }),
  )

  let unsubscribe = resource.data.subscribe()

  await wrap(sleep())
  expect(resource.data()).toBe(1)

  await wrap(sleep(20))
  expect(resource.data()).toBeGreaterThan(1)

  unsubscribe()
})

test('works with targets already extended by withAsync', async () => {
  const name = 'withRetryWithAsync'
  const track = vi.fn()
  let calls = 0
  const fetch = action(async () => {
    calls++
    if (calls === 1) throw new Error('fail')
    return calls
  }, `${name}.fetch`).extend(
    withAsync(),
    withRetry({
      connected: false,
      onReject: retryOnReject({ delay: 0, budget: 1 }),
      onFulfill: track,
    }),
  )

  await wrap(fetch().catch(noop))
  await wrap(sleep())

  expect(track).toBeCalledTimes(1)
})
