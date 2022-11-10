import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { fetch } from 'cross-fetch'
import { atom } from '@reatom/core'
import { mapPayloadAwaited, toAtom } from '@reatom/lens'
import { take } from '@reatom/effects'
import { onConnect, onUpdate } from '@reatom/hooks'
import { createTestCtx, mockFn } from '@reatom/testing'
import { sleep } from '@reatom/utils'

import { reatomAsync, withAbort, withDataAtom, withRetryAction } from './'

test(`base API`, async () => {
  const fetchData = reatomAsync(async (ctx, v: number) => v).pipe(
    withDataAtom(0),
  )
  const ctx = createTestCtx()

  assert.is(ctx.get(fetchData.dataAtom), 0)

  setTimeout(fetchData, 0, ctx, 123)
  assert.is(await take(ctx, fetchData), 123)
  assert.is(ctx.get(fetchData.dataAtom), 123)
  ;`👍` //?
})

test('withRetryAction', async () => {
  const fetchData = reatomAsync(async (ctx, v: number) => {
    if (1) throw new Error('TEST')
  }).pipe(
    withRetryAction({
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

test('withAbort', async () => {
  const a1 = reatomAsync((ctx, v: number) =>
    sleep().then(() => {
      ctx.controller.signal.throwIfAborted()
      return v
    }),
  ).pipe(withAbort())

  const ctx = createTestCtx()

  const valueSubscriber = ctx.subscribeTrack(
    a1.pipe(mapPayloadAwaited((ctx, v) => v)),
  )
  const errorSubscriber = ctx.subscribeTrack(a1.onReject)

  assert.equal(valueSubscriber.calls.length, 1)
  assert.equal(errorSubscriber.calls.length, 1)

  const promise1 = a1(ctx, 1)
  const promise2 = a1(ctx, 2)

  assert.equal(valueSubscriber.calls.length, 1)

  await Promise.any([promise1, promise2])

  assert.equal(valueSubscriber.calls.length, 2)
  assert.equal(valueSubscriber.lastInput().at(-1)?.payload, 2)
  assert.equal(errorSubscriber.calls.length, 2)
  ;`👍` //?
})

test('withAbort user abort', async () => {
  const a1 = reatomAsync(async (ctx) => {
    ctx.controller.abort()
    ctx.controller.signal.throwIfAborted()
  }).pipe(withAbort())

  const ctx = createTestCtx()

  const valueSubscriber = ctx.subscribeTrack(
    a1.pipe(mapPayloadAwaited((ctx, v) => v)),
  )
  const errorSubscriber = ctx.subscribeTrack(a1.onReject)

  assert.equal(valueSubscriber.calls.length, 1)
  assert.equal(errorSubscriber.calls.length, 1)

  await a1(ctx).catch((v) => {})

  assert.equal(valueSubscriber.calls.length, 1)
  assert.equal(errorSubscriber.calls.length, 2)
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
  fetchData(ctx)
  fetchData(ctx)

  await take(ctx, fetchData.onFulfill)

  assert.is(cb.calls.length, 2)
  assert.equal(cb.lastInput().at(-1)?.payload, 404)
  assert.is(handleError.calls.length, 2)
  assert.ok(handleError.calls.every(({ o }: any) => o.name === 'AbortError'))
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

test.run()
