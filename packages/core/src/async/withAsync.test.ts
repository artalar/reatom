import { expect, test, vi } from 'test'

import { _read, action, atom, computed, mock } from '../core'
import { withCallHook } from '../extensions'
import { retryComputed, wrap } from '../methods'
import { noop, sleep, throwAbort } from '../utils'
import { withAsync } from './withAsync'

test('action', async () => {
  const name = 'actionAsync'
  let fetchTrack = vi.fn()
  let fulfilLTrack = vi.fn()
  let settleTrack = vi.fn()
  const fetch = action(async (param: number) => param, `${name}.fetch`).extend(
    withAsync(),
    withCallHook((payload, params) => fetchTrack({ payload, params })),
  )
  fetch.onFulfill.extend(withCallHook((call) => fulfilLTrack(call)))
  fetch.onSettle.extend(withCallHook((call) => settleTrack(call)))

  const promise = fetch(1)
  await wrap(promise)

  expect(fetchTrack).toBeCalledTimes(1)
  expect(fetchTrack).toBeCalledWith({ payload: promise, params: [1] })
  expect(fulfilLTrack).toBeCalledTimes(1)
  expect(fulfilLTrack).toBeCalledWith({ payload: 1, params: [1] })
  expect(settleTrack).toBeCalledTimes(1)
  expect(settleTrack).toBeCalledWith({ payload: 1, params: [1] })
})

test('atom', async () => {
  const name = 'atomAsync'
  const params = atom(0, `${name}.params`)
  const data = computed(async () => params(), `${name}.data`).extend(
    withAsync(),
  )

  expect(data.pending()).toBe(1)
  expect(data.ready()).toBe(false)
  expect(_read(data.pending)?.state).toBe(1)
  expect(data.pending()).toBe(1)
  // the async target should run by a computed
  expect(_read(data)?.state).instanceOf(Promise)

  expect(await wrap(data())).toBe(0)
  expect(data.pending()).toBe(0)
  expect(data.ready()).toBe(true)
})

test('action error handling', async () => {
  const name = 'atomAsyncError'
  const fetch = action(async (shouldFail: boolean) => {
    await wrap(sleep())
    if (shouldFail) throw 'TEST'
    return 'Success'
  }, `${name}.data`).extend(withAsync())

  const onReject = vi.fn()
  fetch.onReject.extend(withCallHook((call) => onReject(call)))
  const onFulfill = vi.fn()
  fetch.onFulfill.extend(withCallHook((call) => onFulfill(call)))

  expect(fetch.error()).toBeUndefined()

  await wrap(fetch(true).catch(noop))

  expect(fetch.ready()).toBe(true)
  expect(fetch.error()).instanceOf(Error)
  expect(fetch.error()?.message).toBe('TEST')
  expect(onReject).toHaveBeenCalledWith({
    error: new Error('TEST'),
    params: [true],
  })
  expect(onFulfill).not.toHaveBeenCalled()

  const promise = fetch(false)
  expect(fetch.ready()).toBe(false)
  await wrap(promise)

  expect(fetch.ready()).toBe(true)
  expect(fetch.error()).toBeUndefined()
  expect(onReject).toHaveBeenCalledTimes(1)
  expect(onFulfill).toHaveBeenCalledWith({
    payload: 'Success',
    params: [false],
  })
})

// https://github.com/reatom/reatom/issues/1291
test('mocked rejection reaches the caller without an unhandled rejection', async () => {
  const name = 'mockAsyncReject'
  const fetchSmth = action(async () => 'real', name).extend(withAsync())
  const unmock = mock(fetchSmth, () => Promise.reject(new Error('mocked')))

  const rejections: unknown[] = []
  const listener = (reason: unknown) => rejections.push(reason)
  process.on('unhandledRejection', listener)

  try {
    let caught: unknown
    try {
      await wrap(fetchSmth())
    } catch (error) {
      caught = error
    }
    expect((caught as Error).message).toBe('mocked')

    expect(fetchSmth.error()?.message).toBe('mocked')
    expect(fetchSmth.ready()).toBe(true)

    // let a possible unhandledRejection event fire
    await new Promise((resolve) => setTimeout(resolve))
    expect(
      rejections.filter((reason) => (reason as Error)?.message === 'mocked'),
    ).toEqual([])
  } finally {
    process.off('unhandledRejection', listener)
    unmock()
  }
})

// the reactive counterpart of the mocked action case above
test('mocked computed rejection is processed by withAsync without an unhandled rejection', async () => {
  const name = 'mockComputedReject'
  const data = computed(async () => 'real', name).extend(withAsync())
  const unmock = mock(data, () => Promise.reject(new Error('mocked-reactive')))

  const rejections: unknown[] = []
  const listener = (reason: unknown) => rejections.push(reason)
  process.on('unhandledRejection', listener)

  try {
    // connection triggers the mocked computation, nobody consumes the promise
    expect(data.ready()).toBe(false)

    // let the rejection processing and the unhandledRejection event pass
    await wrap(sleep())

    expect(data.error()?.message).toBe('mocked-reactive')
    expect(data.ready()).toBe(true)
    expect(
      rejections.filter(
        (reason) => (reason as Error)?.message === 'mocked-reactive',
      ),
    ).toEqual([])
  } finally {
    process.off('unhandledRejection', listener)
    unmock()
  }
})

test('abort rejection settles without calling onReject', async () => {
  const fetch = action(async (shouldAbort: boolean) => {
    await wrap(sleep())
    if (shouldAbort) throwAbort('aborted')
    return 'Success'
  }, 'abortAsync.data').extend(withAsync())

  const onReject = vi.fn()
  fetch.onReject.extend(withCallHook((call) => onReject(call)))
  const onSettle = vi.fn()
  fetch.onSettle.extend(withCallHook((call) => onSettle(call)))

  await wrap(fetch(true).catch(noop))

  // the abort settles the async lifecycle but is not a business rejection
  expect(onReject).not.toHaveBeenCalled()
  expect(onSettle).toHaveBeenCalledTimes(1)
  expect(fetch.error()).toBeUndefined()
  expect(fetch.pending()).toBe(0)

  // a real rejection still reaches onReject
  await wrap(fetch(false))
  expect(onReject).not.toHaveBeenCalled()
  expect(onSettle).toHaveBeenCalledTimes(2)
})

test('rejection with a nullish reason does not produce a phantom Error("undefined")', async () => {
  const fetchSmth = action(async () => 'real', 'phantomAbortError').extend(
    withAsync(),
  )
  const unmock = mock(fetchSmth, () => Promise.reject(undefined))

  try {
    try {
      await wrap(fetchSmth())
    } catch {}

    expect(fetchSmth.error()).toBeUndefined()
  } finally {
    unmock()
  }
})

test('computed retry', async () => {
  const name = 'computedRetry'
  let shouldFail = true
  const params = atom(0, `${name}.params`)
  const resource = computed(async () => {
    params() // dependency
    if (shouldFail) {
      throw new Error('Initial failure')
    }
    return 'Success'
  }, `${name}.resource`).extend(withAsync())

  const onReject = vi.fn()
  resource.onReject.extend(withCallHook((call) => onReject(call)))
  const onFulfill = vi.fn()
  resource.onFulfill.extend(withCallHook((call) => onFulfill(call)))

  // Initial evaluation should fail
  await wrap(resource().catch(noop))

  expect(resource.ready()).toBe(true)
  expect(resource.error()).instanceOf(Error)
  expect(resource.error()?.message).toBe('Initial failure')
  expect(onReject).toHaveBeenCalledTimes(1)
  expect(onFulfill).not.toHaveBeenCalled()

  // Retry should succeed
  shouldFail = false
  await wrap(retryComputed(resource).catch(noop))

  expect(resource.ready()).toBe(true)
  expect(resource.error()).toBeUndefined()
  expect(onReject).toHaveBeenCalledTimes(1) // Should not be called again
  expect(onFulfill).toHaveBeenCalledTimes(1)
  expect(onFulfill).toHaveBeenCalledWith({
    payload: 'Success',
    params: [0], // params from the initial computed evaluation
  })
})

test('computed retry without params', async () => {
  const name = 'computedRetry'
  let shouldFail = true
  const resource = computed(async () => {
    if (shouldFail) {
      throw new Error('Initial failure')
    }
    return 'Success'
  }, `${name}.resource`).extend(withAsync())

  const onReject = vi.fn()
  resource.onReject.extend(withCallHook((call) => onReject(call)))
  const onFulfill = vi.fn()
  resource.onFulfill.extend(withCallHook((call) => onFulfill(call)))

  // Initial evaluation should fail
  await wrap(resource().catch(noop))

  expect(resource.ready()).toBe(true)
  expect(resource.error()).instanceOf(Error)
  expect(resource.error()?.message).toBe('Initial failure')
  expect(onReject).toHaveBeenCalledTimes(1)
  expect(onFulfill).not.toHaveBeenCalled()

  // Retry should succeed
  shouldFail = false
  await wrap(retryComputed(resource).catch(noop))

  expect(resource.ready()).toBe(true)
  expect(resource.error()).toBeUndefined()
  expect(onReject).toHaveBeenCalledTimes(1) // Should not be called again
  expect(onFulfill).toHaveBeenCalledTimes(1)
  expect(onFulfill).toHaveBeenCalledWith({
    payload: 'Success',
    params: [], // params from the initial computed evaluation
  })
})

test('action retry with cacheParams enabled', async () => {
  const name = 'actionRetryWithCacheParams'
  let callCount = 0
  const fetch = action(async (param: number) => {
    callCount++
    await wrap(sleep())
    return param * 2
  }, `${name}.fetch`).extend(withAsync({ cacheParams: true }))

  expect(() => fetch.retry()).toThrow('Nothing to retry, params is empty')

  // First call
  await wrap(fetch(5))
  expect(callCount).toBe(1)

  // Check that params are cached
  expect(fetch.params()).toEqual([5])

  // Retry should use cached params
  await wrap(fetch.retry())
  expect(callCount).toBe(2)
})

test('action retry with cacheParams disabled throws error', async () => {
  const name = 'actionRetryWithoutCacheParams'
  const fetch = action(async (param: number) => {
    await wrap(sleep())
    return param * 2
  }, `${name}.fetch`).extend(withAsync())

  await wrap(fetch(5))

  // Retry should throw error when cacheParams is not enabled
  expect(() => fetch.retry()).toThrow(
    'You should enable params caching in the options to use retry',
  )
})

test('atom retry works without cacheParams', async () => {
  const name = 'atomRetryWithoutCacheParams'
  let callCount = 0
  const params = atom(1, `${name}.params`)
  const resource = computed(async () => {
    callCount++
    const value = params()
    await wrap(sleep())
    return value * 2
  }, `${name}.resource`).extend(withAsync())

  // Subscribe to trigger the computed
  resource.pending.subscribe()
  await wrap(sleep())

  expect(callCount).toBe(1)
  expect(resource.error()).toBeUndefined()

  // Retry should work for atoms even without cacheParams
  expect(await wrap(resource.retry())).toBe(2)
  expect(callCount).toBe(2)
  expect(resource.error()).toBeUndefined()
})
