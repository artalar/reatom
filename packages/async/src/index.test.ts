import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { action, atom } from '@reatom/core'
import { mapPayloadAwaited } from '@reatom/lens'
import { take } from '@reatom/effects'
import { onConnect } from '@reatom/hooks'
import { createTestCtx, mockFn } from '@reatom/testing'
import { sleep } from '@reatom/utils'

import {
  reatomAsync,
  withAbort,
  withDataAtom,
  withRetry,
  withErrorAtom,
} from './'

import './index.story.test'
import './withCache.test'

test(`base API`, async () => {
  const fetchData = reatomAsync(async (ctx, v: number) => v).pipe(
    withDataAtom(0, (ctx, v) => v),
  )
  const ctx = createTestCtx()

  assert.is(ctx.get(fetchData.dataAtom), 0)

  setTimeout(fetchData, 0, ctx, 123)
  assert.is(await take(ctx, fetchData), 123)
  assert.is(ctx.get(fetchData.dataAtom), 123)
  ;`👍` //?
})

test('withRetry', async () => {
  const fetchData = reatomAsync(async (ctx, v: number) => {
    if (1) throw new Error('TEST')
  }).pipe(
    withRetry({
      onReject(ctx, error: any, retries) {
        if (error?.message === 'TEST' && retries < 2) return 0
      },
    }),
  )

  const ctx = createTestCtx()

  const track = ctx.subscribeTrack(fetchData)

  assert.is(track.calls.length, 1)

  fetchData(ctx, 123)

  assert.is(track.calls.length, 2)

  await sleep()

  assert.is(track.calls.length, 4)
  ;`👍` //?
})

test('withRetry fallbackParams', async () => {
  const ctx = createTestCtx()

  assert.throws(() =>
    reatomAsync(async () => {})
      .pipe(withRetry())
      .retry(ctx),
  )

  assert.not.throws(() =>
    reatomAsync(async () => {})
      .pipe(withRetry({ fallbackParams: [] }))
      .retry(ctx),
  )

  const fallback = await reatomAsync(async (ctx, v: number) => v)
    .pipe(withRetry({ fallbackParams: [123] }))
    .retry(ctx)

  assert.is(fallback, 123)
  ;`👍` //?
})

test('withRetry delay', async () => {
  const fetchData = reatomAsync(async (ctx, v: number) => {
    await sleep(5)
    if (1) throw new Error('TEST')
  }).pipe(
    withRetry({
      onReject(ctx, error: any, retries) {
        if (error?.message === 'TEST' && retries < 1) return 6
      },
    }),
  )

  const ctx = createTestCtx()

  const track = ctx.subscribeTrack(fetchData)

  assert.is(track.calls.length, 1)

  fetchData(ctx, 123)
  fetchData(ctx, 123)

  assert.is(track.calls.length, 3)

  await sleep(30)

  assert.is(track.calls.length, 4)
  ;`👍` //?
})

test('withAbort', async () => {
  const a1 = reatomAsync((ctx, v: number) =>
    sleep().then(() => {
      ctx.controller.signal.throwIfAborted()
      return v
    }),
  ).pipe(withAbort())

  const ctx = createTestCtx()

  const valueTrack = ctx.subscribeTrack(
    a1.pipe(mapPayloadAwaited((ctx, v) => v)),
  )
  const errorTrack = ctx.subscribeTrack(a1.onReject)
  const abortTrack = ctx.subscribeTrack(a1.onAbort)

  assert.equal(valueTrack.calls.length, 1)
  assert.equal(errorTrack.calls.length, 1)
  assert.equal(abortTrack.calls.length, 1)

  const promise1 = a1(ctx, 1)
  assert.equal(abortTrack.calls.length, 1)
  const promise2 = a1(ctx, 2)
  assert.equal(valueTrack.calls.length, 1)
  assert.equal(abortTrack.calls.length, 2)

  await Promise.any([promise1, promise2])

  assert.equal(valueTrack.calls.length, 2)
  assert.equal(valueTrack.lastInput().at(-1)?.payload, 2)
  assert.equal(errorTrack.calls.length, 2)
  assert.equal(abortTrack.calls.length, 2)
  ;`👍` //?
})

test('withAbort user abort', async () => {
  const a1 = reatomAsync(async (ctx, shouldAbort: boolean) => {
    if (shouldAbort) {
      ctx.controller.abort()
      ctx.controller.signal.throwIfAborted()
    }
    return 42
  }).pipe(withAbort())

  const ctx = createTestCtx()

  const valueSubscriber = ctx.subscribeTrack(
    a1.pipe(mapPayloadAwaited((ctx, v) => v)),
  )
  const errorSubscriber = ctx.subscribeTrack(a1.onReject)

  assert.equal(valueSubscriber.calls.length, 1)
  assert.equal(errorSubscriber.calls.length, 1)

  await a1(ctx, true).catch((v) => {})

  assert.equal(valueSubscriber.calls.length, 1)
  assert.equal(errorSubscriber.calls.length, 2)

  const promise = a1(ctx, false)
  assert.equal(valueSubscriber.calls.length, 1)
  await promise
  assert.equal(valueSubscriber.calls.length, 2)
  assert.equal(valueSubscriber.lastInput().at(-1)?.payload, 42)
  ;`👍` //?
})

test('withAbort and fetch', async () => {
  const handleError = mockFn((e) => {
    throw e
  })
  const fetchData = reatomAsync((ctx) =>
    fetch('https://www.google.ru/404', ctx.controller).catch(handleError),
  ).pipe(withAbort())

  const ctx = createTestCtx()

  const cb = ctx.subscribeTrack(
    fetchData.pipe(mapPayloadAwaited((ctx, resp) => resp.status)),
  )

  assert.is(cb.calls.length, 1)
  assert.is(handleError.calls.length, 0)

  fetchData(ctx)
  await sleep()
  fetchData(ctx)
  await sleep()
  fetchData(ctx)

  await take(ctx, fetchData.onFulfill)

  assert.is(cb.calls.length, 2)
  assert.equal(cb.lastInput().at(-1)?.payload, 404)
  assert.is(handleError.calls.length, 2)
  assert.ok(handleError.calls.every(({ o }: any) => o.name === 'AbortError'))
  ;`👍` //?
})

test('hooks', async () => {
  let onEffect = 0
  let onFulfill = 0
  let onReject = 0
  let onSettle = 0
  const effect = reatomAsync(
    async (ctx, v: number) => {
      if (v) return v
      throw v
    },
    {
      onEffect: () => onEffect++,
      onFulfill: () => onFulfill++,
      onReject: () => onReject++,
      onSettle: () => onSettle++,
    },
  )
  const ctx = createTestCtx()

  assert.equal([onEffect, onFulfill, onReject, onSettle], [0, 0, 0, 0])

  const promise1 = effect(ctx, 1)
  assert.equal([onEffect, onFulfill, onReject, onSettle], [1, 0, 0, 0])

  await promise1
  assert.equal([onEffect, onFulfill, onReject, onSettle], [1, 1, 0, 1])

  const promise2 = effect(ctx, 0)
  assert.equal([onEffect, onFulfill, onReject, onSettle], [2, 1, 0, 1])
  await promise2.catch(() => {})
  assert.equal([onEffect, onFulfill, onReject, onSettle], [2, 1, 1, 2])
  ;`👍` //?
})

test('fetch on connect', async () => {
  const fetchData = reatomAsync(async (ctx, payload: number) => payload).pipe(
    withDataAtom(0),
  )
  const ctx = createTestCtx()
  onConnect(fetchData.dataAtom, (ctx) => fetchData(ctx, 123))
  const track = ctx.subscribeTrack(fetchData.dataAtom)

  await sleep()
  assert.is(track.lastInput(), 123)
  ;`👍` //?
})

test('resetTrigger', async () => {
  const effect = reatomAsync(async () => {
    if (1) throw 42
    return 42
  }).pipe(
    withDataAtom(),
    withErrorAtom(undefined, { resetTrigger: 'dataAtom' }),
  )
  const ctx = createTestCtx()

  await effect(ctx).catch(() => {})

  assert.is(ctx.get(effect.errorAtom)?.message, '42')

  effect.dataAtom(ctx, 42)
  assert.is(ctx.get(effect.errorAtom), undefined)
  ;`👍` //?
})

test('nested abort', async () => {
  let result = false
  let thrown = false
  const do1 = reatomAsync(async (ctx) => {
    await sleep()
    ctx.controller.signal.throwIfAborted()
    result = true
  }).pipe(withAbort())
  const do2 = reatomAsync(do1)
  const do3 = reatomAsync(action(do2)).pipe(withAbort())
  const ctx = createTestCtx()

  do3(ctx).catch(() => {
    thrown = true
  })
  assert.is(result, false)
  await sleep(5)
  assert.is(result, true)
  assert.is(thrown, false)

  result = false
  do3(ctx).catch(() => {
    thrown = true
  })
  do3.abort(ctx)
  assert.is(result, false)
  await sleep(5)
  assert.is(result, false)
  assert.is(thrown, true)
  ;`👍` //?
})

test('onConnect and take ', async () => {
  const act = action()
  const res = atom(false)
  const effect = reatomAsync(async (ctx) => {
    // extra action to check that the controller could be read even between NO async primitives
    await action((ctx) => take(ctx, act))(ctx)
    res(ctx, true)
  })
  onConnect(res, effect)

  const ctx = createTestCtx()

  const track = ctx.subscribeTrack(res)
  act(ctx)
  await sleep()
  assert.is(ctx.get(res), true)

  res(ctx, false)
  track.unsubscribe()

  ctx.subscribeTrack(res).unsubscribe()
  act(ctx)
  await sleep()
  assert.is(ctx.get(res), false)
  ;`👍` //?
})

test.run()
