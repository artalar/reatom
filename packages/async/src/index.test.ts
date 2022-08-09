import { test } from 'uvu'
import * as assert from 'uvu/assert'
import fetch from 'cross-fetch'
import { atom, createContext } from '@reatom/core'
import { mapAsync, toAtom, toPromise } from '@reatom/lens'
import { onUpdate } from '@reatom/hooks'
import { mockFn } from '@reatom/testing'

import { atomizeAsync, withAbort, withRetry } from './'

test(`base API`, async () => {
  let i = 1
  const dataResource = atomizeAsync(async (ctx, v: number) => v + i).pipe(
    mapAsync((ctx, value) => ({ value })),
    toAtom({ value: 0 }),
  )
  const ctx = createContext()
  ctx.subscribe(dataResource, () => {})

  assert.is(ctx.get(dataResource).value, 0)

  dataResource(ctx, 1)

  assert.is(await dataResource.toPromise(ctx), 2)
  assert.is(ctx.get(dataResource).value, 2)

  i++
  assert.is(await dataResource.retry(ctx), 3)
  ;`👍` //?
})

test('retry', async () => {
  let attempts = 0
  const fetchData = atomizeAsync(async (ctx, v: number) => {
    if (attempts++ < 2) throw new Error('test error')
    return v
  }).pipe(withRetry())

  const failTimesAtom = atom(0)
  onUpdate(fetchData.onReject, (ctx) => {
    if (failTimesAtom(ctx, (s) => ++s) > 4) return failTimesAtom(ctx, 0)
    fetchData.retry(ctx)
  })

  const ctx = createContext()
  const cb = mockFn()

  ctx.subscribe(
    fetchData.pipe(
      mapAsync((ctx, v) => v),
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

  const ctx = createContext()

  ctx.subscribe(a1.pipe(mapAsync((ctx, v) => v)), valueSubscriber)
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

  const ctx = createContext()

  ctx.subscribe(async1.pipe(mapAsync((ctx, v) => v)), valueSubscriber)
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

  const ctx = createContext()
  const cb = mockFn()

  ctx.subscribe(fetchData.pipe(mapAsync((ctx, resp) => resp.status)), cb)

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

test.run()
