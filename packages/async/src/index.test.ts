import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { fetch } from 'cross-fetch'
import { atom, createCtx } from '@reatom/core'
import { mapPayloadAwaited, toAtom, toPromise } from '@reatom/lens'
import { onUpdate } from '@reatom/hooks'
import { mockFn } from '@reatom/testing'
import { sleep } from '@reatom/utils'

import {
  atomizeAsync,
  withAbort,
  withDataAtom,
  withFetchOnConnect,
  withRetryAction,
} from './'

test(`base API`, async () => {
  let i = 1
  const fetchData = atomizeAsync(async (ctx, v: number) => v + i).pipe(
    withRetryAction(),
    withDataAtom(0),
  )
  const ctx = createCtx()
  // ctx.subscribe(fetchData, () => {})

  assert.is(ctx.get(fetchData.dataAtom), 0)

  fetchData.pipe(toPromise(ctx)).then((v) => assert.is(v, 2))

  assert.is(await fetchData(ctx, 1), 2)
  assert.is(ctx.get(fetchData.dataAtom), 2)

  i++
  assert.is(await fetchData.retry(ctx), 3)
  ;`👍` //?
})

test('withRetryAction', async () => {
  let attempts = 0
  const fetchData = atomizeAsync(async (ctx, v: number) => {
    if (attempts++ < 2) throw new Error('test error')
    return v
  }).pipe(withRetryAction())

  const failTimesAtom = atom(0)
  onUpdate(fetchData.onReject, (ctx) => {
    if (failTimesAtom(ctx, (s) => ++s) > 4) return failTimesAtom(ctx, 0)
    fetchData.retry(ctx)
  })

  const ctx = createCtx()
  const cb = mockFn()

  ctx.subscribe(
    fetchData.pipe(
      mapPayloadAwaited((ctx, v) => v),
      toAtom(),
    ),
    cb,
  )

  assert.is(cb.calls.length, 1)

  fetchData(ctx, 123)

  await fetchData.onFulfill.pipe(toPromise(ctx))

  assert.is(cb.calls.length, 2)
  ;`👍` //?
})

test('withAbort', async () => {
  const a1 = atomizeAsync(withAbort(async (ctx, controller, v: number) => v))
  const valueSubscriber = mockFn()
  const errorSubscriber = mockFn()

  const ctx = createCtx()

  ctx.subscribe(a1.pipe(mapPayloadAwaited((ctx, v) => v)), valueSubscriber)
  ctx.subscribe(a1.onReject, errorSubscriber)

  assert.equal(valueSubscriber.calls.length, 1)
  assert.equal(valueSubscriber.lastInput(), [])
  assert.equal(errorSubscriber.calls.length, 1)

  const promise1 = a1(ctx, 1)
  const promise2 = a1(ctx, 2)

  assert.equal(valueSubscriber.calls.length, 1)

  await Promise.all([promise1, promise2]).catch((v) => {})

  assert.equal(valueSubscriber.calls.length, 2)
  assert.equal(valueSubscriber.lastInput(), [2])
  assert.equal(errorSubscriber.calls.length, 1)
  ;`👍` //?
})

test('withAbort user abort', async () => {
  const async1 = atomizeAsync(
    withAbort(async (ctx, controller) => controller.abort()),
  )
  const valueSubscriber = mockFn()
  const errorSubscriber = mockFn()

  const ctx = createCtx()

  ctx.subscribe(async1.pipe(mapPayloadAwaited((ctx, v) => v)), valueSubscriber)
  ctx.subscribe(async1.onReject, errorSubscriber)

  assert.equal(valueSubscriber.calls.length, 1)
  assert.equal(errorSubscriber.calls.length, 1)

  await async1(ctx).catch(() => {})

  assert.equal(valueSubscriber.calls.length, 1)
  assert.equal(errorSubscriber.calls.length, 1)
  ;`👍` //?
})

test('withAbort and fetch', async () => {
  const handleError = mockFn((e) => {
    throw e
  })
  const fetchData = atomizeAsync(
    withAbort(async (ctx, { signal }) =>
      fetch('https://www.google.ru/404', { signal }).catch(handleError),
    ),
  )

  const ctx = createCtx()
  const cb = mockFn()

  ctx.subscribe(
    fetchData.pipe(mapPayloadAwaited((ctx, resp) => resp.status)),
    cb,
  )

  assert.is(cb.calls.length, 1)
  assert.is(handleError.calls.length, 0)

  fetchData(ctx)
  fetchData(ctx)
  fetchData(ctx)

  await fetchData.onFulfill.pipe(toPromise(ctx))

  assert.is(cb.calls.length, 2)
  assert.equal(cb.lastInput(), [404])
  assert.is(handleError.calls.length, 2)
  assert.ok(handleError.calls.every(({ o }: any) => o.name === 'AbortError'))
  ;`👍` //?
})

test('withFetchOnConnect', async () => {
  const fetchData = atomizeAsync(async (ctx, payload) => payload + 1).pipe(
    withDataAtom(0),
    withFetchOnConnect(['dataAtom'], (ctx): [number] => [123]),
  )
  const ctx = createCtx()
  const cb = mockFn()

  fetchData.onFulfill.pipe(toPromise(ctx)).then(cb)

  await sleep(0)
  assert.is(cb.calls.length, 0)

  ctx.subscribe(fetchData.dataAtom, () => {})
  await sleep(0)
  assert.is(cb.calls.length, 1)
  assert.is(cb.lastInput(), 124)
  ;`👍` //?
})

test.run()
