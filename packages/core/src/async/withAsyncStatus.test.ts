import { expect, test } from 'test'

import { action, mock } from '../core'
import { wrap } from '../methods'
import { noop, sleep } from '../utils'
import { withAsync } from './withAsync'
import {
  type AsyncStatusAbortedFulfill,
  type AsyncStatusAbortedPending,
  type AsyncStatusAnotherPending,
  type AsyncStatusFirstAborted,
  type AsyncStatusFirstPending,
  type AsyncStatusFulfilled,
  asyncStatusInitState,
  type AsyncStatusNeverPending,
  type AsyncStatusRejected,
} from './withAsyncStatus'

const neverPending: AsyncStatusNeverPending = {
  isPending: false,
  isFulfilled: false,
  isRejected: false,
  isSettled: false,

  isFirstPending: false,
  // isAnotherPending: false,
  isEverPending: false,
  // isNeverPending: true,
  isEverSettled: false,
  // isNeverSettled: true,

  isSWR: false,

  data: undefined as never,
  error: undefined,
}

const firstPending: AsyncStatusFirstPending = {
  isPending: true,
  isFulfilled: false,
  isRejected: false,
  isSettled: false,

  isFirstPending: true,
  // isAnotherPending: false,
  isEverPending: true,
  // isNeverPending: false,
  isEverSettled: false,
  // isNeverSettled: true,

  isSWR: false,

  data: undefined as never,
  error: undefined,
}

const fulfilled: AsyncStatusFulfilled = {
  isPending: false,
  isFulfilled: true,
  isRejected: false,
  isSettled: true,

  isFirstPending: false,
  // isAnotherPending: false,
  isEverPending: true,
  // isNeverPending: false,
  isEverSettled: true,
  // isNeverSettled: false,

  isSWR: false,

  data: undefined as never,
  error: undefined,
}

const testError = new Error('withAsyncStatus test error')

const rejected: AsyncStatusRejected = {
  isPending: false,
  isFulfilled: false,
  isRejected: true,
  isSettled: true,

  isFirstPending: false,
  // isAnotherPending: false,
  isEverPending: true,
  // isNeverPending: false,
  isEverSettled: true,
  // isNeverSettled: false,

  isSWR: false,

  data: undefined as never,
  error: testError,
}

const firstAborted: AsyncStatusFirstAborted = {
  isPending: false,
  isFulfilled: false,
  isRejected: false,
  isSettled: false,

  isFirstPending: false,
  isEverPending: true,
  isEverSettled: false,

  isSWR: false,

  data: undefined as never,
  error: undefined,
}

const anotherPending: AsyncStatusAnotherPending = {
  isPending: true,
  isFulfilled: false,
  isRejected: false,
  isSettled: false,

  isFirstPending: false,
  // isAnotherPending: true,
  isEverPending: true,
  // isNeverPending: false,
  isEverSettled: true,
  // isNeverSettled: false,

  isSWR: false,

  data: undefined as never,
  error: undefined,
}

test('withAsyncStatus', async () => {
  const fetchData = action(async (shouldTrow = false) => {
    if (shouldTrow) throw testError
  }, 'fetchData').extend(withAsync({ status: true }))

  expect(fetchData.status()).toEqual(neverPending)

  const promise = fetchData()

  expect(fetchData.status()).toEqual(firstPending)

  await wrap(promise)

  expect(fetchData.status()).toEqual(fulfilled)

  const promise2 = fetchData(true)

  expect(fetchData.status()).toEqual(anotherPending)

  await wrap(promise2.catch(() => {}))

  expect(fetchData.status()).toEqual(rejected)
})

test('withAsyncStatus parallel requests', async () => {
  const fetchData = action((delay = 10) => sleep(delay), 'fetchData').extend(
    withAsync({ status: true }),
  )

  expect(fetchData.status()).toEqual(neverPending)

  const p1 = fetchData(0)

  expect(fetchData.status()).toEqual(firstPending)

  const p2 = fetchData(100)

  expect(fetchData.status()).toEqual({
    ...firstPending,
    isFirstPending: false,
  })

  await wrap(p1)

  // Debug pending count
  expect(fetchData.pending()).toBe(1)

  expect(fetchData.status()).toEqual(anotherPending)

  await wrap(p2)

  expect(fetchData.status()).toEqual(fulfilled)
})

test('reset during pending', async () => {
  const fetchData = action(async () => {}, 'fetchData').extend(
    withAsync({ status: true }),
  )

  expect(fetchData.status()).toMatchObject(asyncStatusInitState)

  fetchData()
  expect(fetchData.status().isPending).toBe(true)
  fetchData.status.reset()
  expect(fetchData.status().isPending).toBe(false)
  expect(fetchData.status().isEverPending).toBe(false)
  await wrap(sleep())
  expect(fetchData.status().isEverPending).toBe(false)
})

test('do not reject on abort', async () => {
  const fetchData = action(async () => {
    await sleep()
    const err = new Error('Aborted')
    err.name = 'AbortError'
    throw err
  }, 'fetchData').extend(withAsync({ status: true }))

  expect(fetchData.status()).toMatchObject(asyncStatusInitState)

  fetchData().catch(noop)
  fetchData().catch(noop)
  await wrap(sleep())

  expect(fetchData.status()).toEqual(firstAborted)
})

test('isEverSettled after abort', async () => {
  let shouldAbort = false
  const fetchData = action(async () => {
    await sleep()
    if (shouldAbort) {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      throw err
    }
  }, 'fetchData').extend(withAsync({ status: true }))

  expect(fetchData.status()).toMatchObject(asyncStatusInitState)
  await wrap(fetchData())
  expect(fetchData.status().isFulfilled).toBe(true)
  expect(fetchData.status()).toEqual({
    isPending: false,
    isFulfilled: true,
    isRejected: false,
    isSettled: true,

    isFirstPending: false,
    isEverPending: true,
    isEverSettled: true,

    isSWR: false,

    data: undefined as never,
    error: undefined,
  } satisfies AsyncStatusFulfilled)

  shouldAbort = true
  fetchData().catch(noop)
  fetchData().catch(noop)
  await wrap(null)
  expect(fetchData.status()).toEqual({
    isPending: true,
    isFulfilled: false,
    isRejected: false,
    isSettled: false,

    isFirstPending: false,
    isEverPending: true,
    isEverSettled: true,

    isSWR: false,

    data: undefined as never,
    error: undefined,
  } satisfies AsyncStatusAbortedPending)
})

test('restore isFulfilled after abort', async () => {
  let shouldAbort = false
  const fetchData = action(async () => {
    if (shouldAbort) {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      throw err
    }
  }, 'fetchData').extend(withAsync({ status: true }))

  await wrap(fetchData())
  expect(fetchData.status()).toEqual({
    isPending: false,
    isFulfilled: true,
    isRejected: false,
    isSettled: true,

    isFirstPending: false,
    isEverPending: true,
    isEverSettled: true,

    isSWR: false,

    data: undefined as never,
    error: undefined,
  } satisfies AsyncStatusFulfilled)

  shouldAbort = true
  // Trigger abort
  const p = fetchData()
  p.catch(noop)

  await wrap(p.catch(noop))

  expect(fetchData.status()).toEqual({
    isPending: false,
    isFulfilled: true,
    isRejected: false,
    isSettled: true,

    isFirstPending: false,
    isEverPending: true,
    isEverSettled: true,

    isSWR: false,

    data: undefined as never,
    error: undefined,
  } satisfies AsyncStatusAbortedFulfill)
})

test('rejection with a nullish reason stays consistent between error() and status().error', async () => {
  const fetchData = action(
    async () => 'real',
    'phantomAbortErrorStatus',
  ).extend(withAsync({ status: true }))
  const unmock = mock(fetchData, () => Promise.reject(undefined))

  try {
    try {
      await wrap(fetchData())
    } catch {}

    expect(fetchData.error()).toBeUndefined()
    expect(fetchData.status().error).toBeUndefined()
  } finally {
    unmock()
  }
})
