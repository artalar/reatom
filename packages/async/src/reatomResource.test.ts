import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx, mockFn } from '@reatom/testing'
import { atom } from '@reatom/core'
import { noop, sleep } from '@reatom/utils'
import { isConnected, onConnect } from '@reatom/hooks'
import { withCache, withDataAtom, withErrorAtom, withRetry } from '.'
import { reatomResource } from './reatomResource'

export const test = suite('reatomResource')

test('base', async () => {
  const paramsAtom = atom(0, 'paramsAtom')
  const async1 = reatomResource(async (ctx) => {
    const argument = ctx.spy(paramsAtom)
    await ctx.schedule(() => sleep())
    return argument
  }, 'async1').promiseAtom
  const async2 = reatomResource(async (ctx) => {
    const n = await ctx.spy(async1)
    return n
  }, 'async2').promiseAtom
  const track = mockFn()
  const ctx = createTestCtx()

  ctx.subscribe(async2, (p) => p.then(track, noop))
  await sleep()
  assert.is(track.calls.length, 1)
  assert.is(track.lastInput(), 0)

  paramsAtom(ctx, 1)
  paramsAtom(ctx, 2)
  paramsAtom(ctx, 3)
  await sleep()
  assert.is(track.lastInput(), 3)
  assert.is(track.calls.length, 2)
  ;`👍` //?
})

test('withCache', async () => {
  const sleepTrack = mockFn(sleep)
  const paramsAtom = atom(0, 'paramsAtom')
  const aAtom = reatomResource(async (ctx) => {
    const params = ctx.spy(paramsAtom)
    await ctx.schedule(() => sleepTrack())
    return params
  }, 'aAtom').pipe(withCache({ swr: false }))
  const bAtom = reatomResource(async (ctx) => {
    const n = await ctx.spy(aAtom.promiseAtom)
    return n
  }, 'bAtom')
  const track = mockFn()
  const ctx = createTestCtx()

  ctx.subscribe(bAtom.promiseAtom, (p) => p.then(track, noop))
  await sleep()
  assert.is(track.calls.length, 1)
  assert.is(track.lastInput(), 0)

  paramsAtom(ctx, 1)
  paramsAtom(ctx, 2)
  paramsAtom(ctx, 3)
  await sleep()
  assert.is(track.lastInput(), 3)
  assert.is(track.calls.length, 2)
  assert.is(sleepTrack.calls.length, 4)

  paramsAtom(ctx, 1)
  paramsAtom(ctx, 2)
  await sleep()
  assert.is(track.lastInput(), 3)
  assert.is(track.calls.length, 2)
  assert.is(sleepTrack.calls.length, 4)

  paramsAtom(ctx, 1)
  paramsAtom(ctx, 2)
  await sleep()
  assert.is(track.lastInput(), 3)
  assert.is(track.calls.length, 2)
  assert.is(sleepTrack.calls.length, 4)
  ;`👍` //?
})

test('controller', async () => {
  let collision = false
  const controllerTrack = mockFn()
  const paramsAtom = atom(0, 'paramsAtom')
  const someResource = reatomResource(async (ctx) => {
    const argument = ctx.spy(paramsAtom)
    ctx.controller.signal.addEventListener('abort', controllerTrack)
    await ctx.schedule(() => sleep())
    // the `schedule` should  not propagate the aborted signal
    collision ||= ctx.controller.signal.aborted
    return argument
  }, 'someResource')
  const ctx = createTestCtx()

  ctx.subscribeTrack(someResource.promiseAtom)
  await sleep()
  assert.is(controllerTrack.calls.length, 0)
  assert.not.ok(collision)

  paramsAtom(ctx, 1)
  assert.is(controllerTrack.calls.length, 1)
  await sleep()
  assert.is(controllerTrack.calls.length, 1)
  assert.not.ok(collision)
  paramsAtom(ctx, 2)
  paramsAtom(ctx, 3)
  assert.is(controllerTrack.calls.length, 3)
  await sleep()
  assert.is(controllerTrack.calls.length, 3)
  assert.not.ok(collision)
  ;`👍` //?
})

test('withDataAtom', async () => {
  const paramsAtom = atom(0, 'paramsAtom')
  const someResource = reatomResource(async (ctx) => {
    const params = ctx.spy(paramsAtom)
    await ctx.schedule(() => sleep())
    return params
  }, 'someResource').pipe(withDataAtom(0))
  const ctx = createTestCtx()

  assert.not.ok(isConnected(ctx, paramsAtom))
  const un = ctx.subscribe(someResource.dataAtom, noop)
  assert.ok(isConnected(ctx, paramsAtom))
  un()
  assert.not.ok(isConnected(ctx, paramsAtom))
  ;`👍` //?
})

test('withErrorAtom withRetry', async () => {
  let throwOnce = true
  const paramsAtom = atom(123, 'paramsAtom')
  const someResource = reatomResource(async (ctx) => {
    const params = ctx.spy(paramsAtom)
    if (throwOnce) {
      throwOnce = false
      throw new Error('test error')
    }
    await ctx.schedule(() => sleep())
    console.log('ctx.controller.signal.aborted', ctx.controller.signal.aborted);
    return params
  }, 'someResource').pipe(
    withDataAtom(0),
    withErrorAtom((ctx, e) => (e instanceof Error ? e : new Error(String(e))), {
      resetTrigger: 'onFulfill',
    }),
    withRetry({
      onReject(ctx, error, retries) {
        if (retries === 0) return 0
      },
    }),
  )
  const ctx = createTestCtx()

  ctx.subscribeTrack(someResource.dataAtom)
  await sleep()
  assert.is(ctx.get(someResource.dataAtom), 0)
  assert.is(ctx.get(someResource.errorAtom)?.message, 'test error')
  assert.is(ctx.get(someResource.pendingAtom), 1)

  await sleep()
  assert.is(ctx.get(someResource.dataAtom), 123)
  assert.is(ctx.get(someResource.errorAtom), undefined)
  assert.is(ctx.get(someResource.pendingAtom), 0)
  ;`👍` //?
})

test('abort should not stale', async () => {
  const paramsAtom = atom(123, 'paramsAtom')
  const someResource = reatomResource(async (ctx) => {
    const params = ctx.spy(paramsAtom)
    await ctx.schedule(() => sleep())
    return params
  }, 'someResource').pipe(withDataAtom(0))
  const ctx = createTestCtx()

  ctx.subscribe(someResource.dataAtom, noop)()
  ctx.subscribe(someResource.dataAtom, noop)

  await sleep()
  assert.is(ctx.get(someResource.dataAtom), 123)
  ;`👍` //?
})

test('direct retry', async () => {
  const paramsAtom = atom(123, 'paramsAtom')
  const someResource = reatomResource(async (ctx) => {
    ctx.spy(paramsAtom)
    await ctx.schedule(() => calls++)
  }, 'someResource')
  let calls = 0
  const ctx = createTestCtx()

  ctx.get(someResource.promiseAtom)
  ctx.get(someResource.promiseAtom)
  ctx.get(someResource.promiseAtom)
  assert.is(calls, 1)

  someResource(ctx)
  assert.is(calls, 2)
  ctx.get(someResource.promiseAtom)
  assert.is(calls, 2)
  ;`👍` //?
})

test('withCache stale abort', async () => {
  const someResource = reatomResource(async (ctx) => {
    await ctx.schedule(() => sleep())
    return 1
  }, 'someResource').pipe(withDataAtom(0), withCache())
  const ctx = createTestCtx()

  ctx.subscribe(someResource.dataAtom, noop)()
  ctx.subscribe(someResource.dataAtom, noop)
  await sleep()
  assert.is(ctx.get(someResource.dataAtom), 1)
  ;`👍` //?
})

test('do not rerun without deps on read', async () => {
  let i = 0
  const someResource = reatomResource(async (ctx) => {
    ++i
    await ctx.schedule(() => sleep())
  }, 'someResource')
  const ctx = createTestCtx()

  ctx.get(someResource.promiseAtom)
  ctx.get(someResource.promiseAtom)
  assert.is(i, 1)

  someResource(ctx)
  assert.is(i, 2)
  ;`👍` //?
})

test('sync retry in onConnect', async () => {
  const getEventsSoon = reatomResource(async () => 1).pipe(
    withDataAtom(0, (ctx, payload, state) => payload + state),
    withRetry(),
  )
  onConnect(getEventsSoon.dataAtom, async (ctx) => {
    while (ctx.isConnected()) {
      await getEventsSoon.retry(ctx)
      await sleep()
    }
  })
  const ctx = createTestCtx()
  ctx.get(getEventsSoon.dataAtom)
  const track = ctx.subscribeTrack(getEventsSoon.dataAtom)

  await sleep()
  await sleep()
  track.unsubscribe()
  assert.ok(ctx.get(getEventsSoon.dataAtom) > 1)
  ;`👍` //?
})

test('do not drop the cache of an error', async () => {
  let calls = 0
  const shouldThrowAtom = atom(true, 'shouldThrowAtom')
  const someResource = reatomResource(async (ctx) => {
    calls++
    if (ctx.spy(shouldThrowAtom)) throw new Error('test error')
    return null
  }, 'someResource')
  const ctx = createTestCtx()

  const track = ctx.subscribeTrack(someResource.promiseAtom)
  assert.is(calls, 1)

  await sleep()
  track.unsubscribe()
  ctx.get(someResource.promiseAtom)
  assert.is(calls, 1)

  shouldThrowAtom(ctx, false)
  ctx.get(someResource.promiseAtom)
  assert.is(calls, 2)
  ;`👍` //?
})

test.run()
