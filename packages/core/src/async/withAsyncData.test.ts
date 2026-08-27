import { expect, expectTypeOf, subscribe, test, vi } from 'test'

import type { Atom } from '../core'
import { action, atom, computed, context, mock } from '../core'
import { isInit, withCallHook, withConnectHook } from '../extensions'
import { abortVar, effect, retryComputed, wrap } from '../methods'
import { createMemStorage, reatomPersist } from '../persist'
import { noop, sleep, throwAbort } from '../utils'
import { withAsyncData } from './withAsyncData'

test('action', async () => {
  const name = 'actionAsyncData'

  let aborts = 0
  const fetch = action(async (param: number) => {
    abortVar.require().signal.addEventListener('abort', () => aborts++)
    return param + 1
  }, `${name}.fetch`).extend(withAsyncData())

  expectTypeOf(fetch.data).toExtend<Atom<undefined | number>>()

  const onFulfill = vi.fn()
  fetch.onFulfill.extend(withCallHook((call) => onFulfill(call)))

  expect(fetch.data()).toBeUndefined()
  expect(fetch.ready()).toBe(true)

  const promise = fetch(1)
  expect(fetch.pending()).toBe(1)
  expect(fetch.ready()).toBe(false)

  await wrap(promise)
  expect(fetch.pending()).toBe(0)
  expect(fetch.ready()).toBe(true)
  expect(fetch.data()).toBe(2)
  expect(onFulfill).toBeCalledTimes(1)
  expect(onFulfill).toBeCalledWith({ payload: 2, params: [1] })

  expect(aborts).toBe(0)

  fetch(1)
  // prev promise already resolved and controller outdated
  expect(aborts).toBe(0)
  fetch(1)
  fetch(1)
  expect(aborts).toBe(2)
})

test('action with mappings', async () => {
  const name = 'actionAsyncDataMap'
  const fetch = action(
    async (param: number) => param + 1,
    `${name}.fetch`,
  ).extend(
    withAsyncData({
      initState: new Array<number>(),
      mapPayload: (payload, _params, _state) => {
        expectTypeOf(payload).toBeNumber()
        expectTypeOf(_params).toEqualTypeOf<[number]>()
        expectTypeOf(_state).toEqualTypeOf<number[]>()

        return [payload]
      },
    }),
  )

  expectTypeOf(fetch.data).toExtend<Atom<number[]>>()

  expect(fetch.data()).toEqual([])

  await wrap(fetch(1))
  expect(fetch.pending()).toBe(0)
  expect(fetch.ready()).toBe(true)
  expect(fetch.data()).toEqual([2])
})

test('atom', async () => {
  const name = 'atomAsyncData'
  const param = atom(0, `${name}.param`)
  const resource = computed(async () => param() + 1, `${name}.resource`).extend(
    withAsyncData(),
  )
  const onFulfill = vi.fn()
  resource.onFulfill.extend(withCallHook((payload) => onFulfill(payload)))

  expect(resource.data()).toBeUndefined()
  expect(resource.ready()).toBe(false)

  await wrap(sleep())
  expect(resource.ready()).toBe(true)
  expect(resource.data()).toBe(1)
  expect(onFulfill).toBeCalledTimes(1)
  expect(onFulfill).toBeCalledWith({ payload: 1, params: [0] })
})

test('atom with mappings', async () => {
  const name = 'atomAsyncDataMap'
  const param = atom(1, `${name}.param`)
  const resource = computed(async () => param() + 1, `${name}.resource`).extend(
    withAsyncData({
      initState: new Array<number>(),
      mapPayload: (payload, _params, _state) => [payload],
    }),
  )

  expect(resource.data()).toEqual([])

  await wrap(resource())
  expect(resource.ready()).toBe(true)
  expect(resource.data()).toEqual([2])
})

test('withAsyncData action concurrent', async () => {
  const name = 'actionAsyncDataConcurrency'
  const fetch = action(async (param: number) => {
    await wrap(sleep())
    return param + 1
  }, `${name}.resource`).extend(withAsyncData({ initState: 0 }))

  expectTypeOf(fetch.data).toExtend<Atom<number>>()

  const onFulfill = vi.fn()
  fetch.onFulfill.extend(withCallHook((call) => onFulfill(call)))

  const track = subscribe(fetch.data)

  fetch(1)
  fetch(2)
  await wrap(Promise.resolve())
  fetch(3)

  await wrap(sleep())
  expect(fetch.pending()).toBe(0)
  expect(fetch.ready()).toBe(true)
  expect(fetch.data()).toBe(4)
  expect(track).toBeCalledTimes(2)
  expect(track).toBeCalledWith(4)
  expect(onFulfill).toBeCalledTimes(1)
  expect(onFulfill).toBeCalledWith({ payload: 4, params: [3] })
})

test('withAsyncData atom concurrent', async () => {
  const name = 'atomAsyncDataConcurrency'
  const param = atom(0, `${name}.param`)
  const resource = computed(async () => {
    let paramState = param()
    await wrap(sleep(10))
    return paramState + 1
  }, `${name}.resource`).extend(withAsyncData({ initState: 0 }))

  expectTypeOf(resource.data).toExtend<Atom<number>>()

  const onFulfill = vi.fn()
  resource.onFulfill.extend(withCallHook((call) => onFulfill(call)))

  const track = subscribe(resource.pending)

  expect(track).toBeCalledWith(1)

  param.set((s) => s + 1)
  await wrap(sleep())
  expect(track.mock.calls.flat()).toEqual([1, 2, 1])
  param.set((s) => s + 1)
  await wrap(sleep())
  expect(track.mock.calls.flat()).toEqual([1, 2, 1, 2, 1])
  param.set((s) => s + 1)
  await wrap(sleep())
  expect(track.mock.calls.flat()).toEqual([1, 2, 1, 2, 1, 2, 1])

  await wrap(resource())

  expect(track.mock.calls.flat()).toEqual([1, 2, 1, 2, 1, 2, 1, 0])
  expect(resource.ready()).toBe(true)
  expect(resource.data()).toBe(4)
  expect(onFulfill).toBeCalledTimes(1)
  expect(onFulfill).toBeCalledWith({ payload: 4, params: [3] })
})

test('atom error handling', async () => {
  const name = 'atomAsyncError'
  const errorMessage = 'TEST'
  const shouldFail = atom(true, `${name}.shouldFail`)
  const resource = computed(async () => {
    const shouldFailState = shouldFail()
    await wrap(sleep())
    if (shouldFailState) throw new Error(errorMessage)
    return 'Success'
  }, `${name}.resource`).extend(
    withAsyncData({
      parseError: (thing) =>
        thing instanceof Error ? thing.message : String(thing),
      initState: null,
    }),
  )

  expectTypeOf(resource.data).toExtend<Atom<null | string>>()

  const onReject = vi.fn()
  resource.onReject.extend(withCallHook((call) => onReject(call)))
  const onFulfill = vi.fn()
  resource.onFulfill.extend(withCallHook((call) => onFulfill(call)))

  expect(resource.error()).toBeUndefined()
  expect(resource.data()).toBe(null)
  expectTypeOf(resource.data).toExtend<Atom<null | string>>()

  await wrap(sleep())

  expect(resource.ready()).toBe(true)
  expect(resource.error()).toBe(errorMessage)
  expect(onReject).toHaveBeenCalledWith({
    error: errorMessage,
    params: [true],
  })
  expect(onFulfill).not.toHaveBeenCalled()

  shouldFail.set(false)
  expect(resource.ready()).toBe(false)
  await wrap(resource())

  expect(resource.ready()).toBe(true)
  expect(resource.error()).toBeUndefined()
  expect(resource.data()).toBe('Success')
  expect(onReject).toHaveBeenCalledTimes(1)
  expect(onFulfill).toHaveBeenCalledWith({
    payload: 'Success',
    params: [false],
  })

  expect(resource.error.set('test')).toBe('test')
})

test('withAsyncData for computed retry', async () => {
  const name = 'computedRetry'
  let shouldFail = true
  const params = atom(0, `${name}.params`)
  const resource = computed(async () => {
    params() // dependency
    if (shouldFail) {
      throw new Error('Initial failure')
    }
    return 'Success'
  }, `${name}.resource`).extend(withAsyncData())

  const onReject = vi.fn()
  resource.onReject.extend(withCallHook((call) => onReject(call)))
  const onFulfill = vi.fn()
  resource.onFulfill.extend(withCallHook((call) => onFulfill(call)))

  resource.data.subscribe()

  // Initial evaluation should fail
  await wrap(sleep())

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

test('Circle subscription', async () => {
  const name = 'circleSubscription'

  const externalResource = atom(0, `${name}.externalResource`).extend(
    withConnectHook(() => {
      effect(() => {
        resource.data()
      })
    }),
  )

  const resource = computed(async () => {
    await wrap(sleep())
    return 'done'
  }, `${name}.resource`).extend(withAsyncData({ initState: 'init' }))

  resource.data.extend(withConnectHook(() => externalResource.subscribe()))

  const track = subscribe(resource.data)

  await wrap(resource())

  expect(track.mock.calls.flat()).toEqual(['init', 'done'])
})

test('abort propagation', async () => {
  const name = 'abortPropagation'

  const counter = atom(0, `${name}.counter`)
  const resource = computed(async () => {
    const value = counter()
    await wrap(sleep(value))
    return value
  }, `${name}.resource`).extend(withAsyncData())

  const getDataFrame = () => context().state.store.get(resource.data)

  resource.data.subscribe()

  expect(() =>
    getDataFrame()?.run(() => {
      abortVar.subscribe()
    }),
  ).not.toThrow()

  await wrap(sleep())

  counter.set((s) => s + 1)
  resource.data()
  expect(() =>
    getDataFrame()?.run(() => {
      abortVar.subscribe()
    }),
  ).not.toThrow()

  await wrap(sleep())

  counter.set((s) => s + 1)
  resource.data()
  expect(() =>
    getDataFrame()?.run(() => {
      abortVar.subscribe()
    }),
  ).not.toThrow()

  await wrap(sleep())

  counter.set((s) => s + 1)
  resource.data()
  expect(() =>
    getDataFrame()?.run(() => {
      abortVar.subscribe()
    }),
  ).not.toThrow()
})

test('few calls in a row', async () => {
  const name = 'fewCallsInRow'

  const counter = atom(0, `${name}.counter`)
  const resource = computed(async () => {
    const value = counter()
    await wrap(sleep(value))
    return value
  }, `${name}.resource`).extend(withAsyncData())

  await wrap(resource())

  counter.set((s) => s + 1)
  resource()
  // do NOT uncomment next line and read pending atom, as it removes the initial problem
  // expect(resource.pending()).toBe(1)
  counter.set((s) => s + 1)
  const promise = resource()
  await wrap(promise)

  expect(resource.pending()).toBe(0)
})

test('status includes data property', async () => {
  const name = 'statusWithData'
  const fetch = action(
    async (param: number) => param + 1,
    `${name}.fetch`,
  ).extend(withAsyncData({ status: true }))

  expectTypeOf(fetch.data).toExtend<Atom<undefined | number>>()

  const status = fetch.status()

  expectTypeOf(status.data).toExtend<number | undefined>()
  if (status.isFulfilled) {
    expectTypeOf(status.data).toExtend<number>()
  }

  const statusInitial = fetch.status()

  expect(statusInitial.data).toBeUndefined()
  expect(statusInitial.isPending).toBe(false)
  expect(statusInitial.isEverPending).toBe(false)

  const promise = fetch(5)
  const statusPending = fetch.status()
  expect(statusPending.data).toBeUndefined()
  expect(statusPending.isPending).toBe(true)
  expect(statusPending.isFirstPending).toBe(true)

  await wrap(promise)
  const statusFulfilled = fetch.status()
  expect(statusFulfilled.data).toBe(6)
  expect(statusFulfilled.isPending).toBe(false)
  expect(statusFulfilled.isFulfilled).toBe(true)
  expect(statusFulfilled.isSettled).toBe(true)
})

test('status includes data property with initState', async () => {
  const name = 'statusWithDataInitState'
  const fetch = action(
    async (param: number) => param + 1,
    `${name}.fetch`,
  ).extend(withAsyncData({ initState: 0, status: true }))

  expectTypeOf(fetch.data).toExtend<Atom<number>>()

  const statusInitial = fetch.status()
  expect(statusInitial.data).toBe(0)
  expect(statusInitial.isPending).toBe(false)

  const promise = fetch(10)
  const statusPending = fetch.status()
  expect(statusPending.data).toBe(0)
  expect(statusPending.isPending).toBe(true)

  await wrap(promise)
  const statusFulfilled = fetch.status()
  expect(statusFulfilled.data).toBe(11)
  expect(statusFulfilled.isFulfilled).toBe(true)
})

test('rejection with a nullish reason stays consistent between error() and status().error', async () => {
  const name = 'phantomAbortErrorData'
  const fetchSmth = action(async () => 'real', `${name}.fetch`).extend(
    withAsyncData({ status: true }),
  )
  const unmock = mock(fetchSmth, () => Promise.reject(undefined))

  try {
    try {
      await wrap(fetchSmth())
    } catch {}

    expect(fetchSmth.error()).toBeUndefined()
    expect(fetchSmth.status().error).toBeUndefined()
    expect(fetchSmth.data()).toBeUndefined()
  } finally {
    unmock()
  }
})

test('reset action resets dependencies and data', async () => {
  const name = 'resetAction'
  let callCount = 0
  const param = atom(1, `${name}.param`)
  const resource = computed(async () => {
    callCount++
    const value = param()
    await wrap(sleep())
    return value * 10
  }, `${name}.resource`).extend(withAsyncData({ initState: 0 }))

  resource.data.subscribe()
  await wrap(sleep())

  expect(resource.data()).toBe(10)
  expect(callCount).toBe(1)

  resource.reset()

  expect(resource.data()).toBe(0)

  await wrap(resource())

  expect(resource.data()).toBe(10)
  expect(callCount).toBe(2)
})

test('retry action after error', async () => {
  const name = 'retryActionAfterError'
  let shouldFail = true
  const resource = computed(async () => {
    await wrap(sleep())
    if (shouldFail) throw new Error('Test error')
    return 'Success'
  }, `${name}.resource`).extend(withAsyncData())

  resource()
  await wrap(sleep())

  expect(resource.error()).instanceOf(Error)
  expect(resource.data()).toBeUndefined()

  shouldFail = false
  await wrap(resource.retry())

  expect(resource.error()).toBeUndefined()
  expect(resource.data()).toBe('Success')
})

test('reset action does not auto re-fetch', async () => {
  const name = 'resetActionNoAutoFetch'
  let callCount = 0
  const resource = computed(async () => {
    callCount++
    await wrap(sleep())
    return callCount
  }, `${name}.resource`).extend(withAsyncData({ initState: 0 }))

  resource.data.subscribe()
  await wrap(sleep())

  expect(resource.data()).toBe(1)
  expect(callCount).toBe(1)

  resource.reset()

  expect(resource.data()).toBe(0)
  expect(callCount).toBe(1)

  await wrap(resource())

  expect(callCount).toBe(2)
  expect(resource.data()).toBe(2)
})

test('persist for data atom', async () => {
  const name = 'persistForDataAtom'

  const withSomePersist = reatomPersist(
    createMemStorage({
      name: 'somePersist',
      snapshot: {
        'resource.data': 123,
      },
    }),
  )

  const param = atom(0, `${name}.param`)
  const resource = computed(async () => {
    const value = param()
    if (isInit()) throwAbort()
    await wrap(sleep())
    return value
  }, `${name}.resource`).extend(withAsyncData())
  resource.data.extend(withSomePersist('resource.data'))

  expect(resource.data()).toBe(123)
  param.set(200)
  expect(resource.data()).toBe(123)
  await wrap(Promise.resolve())
  expect(resource.data()).toBe(123)
  await wrap(sleep())
  expect(resource.data()).toBe(200)
})

// TODO just predefine actions WITH PERSIST CACHE and you get a nicer version of FSM.
/*
const askProfileSurvey = reatomFSM(
  ['name', 'age', 'permission', 'sex'],
  async (state) => {
    const name = await wrap(state.name(() => prompt('What is your name?')))

    const age = await wrap(state.age(() => prompt('What is your age?')))

    let permission = true
    if (age < 18) {
      permission = await wrap(
        state.permission(() => confirm('Did you have your parents consent?')),
      )
    }

    const sex = await wrap(
      state.sex(() => prompt('What is your sex? (male/female)')),
    )

    return { name, age, permission, sex }
  },
)
*/
