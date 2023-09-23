import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx, mockFn } from '@reatom/testing'
import { atom } from '@reatom/core'
import { reatomAsyncReaction } from './reatomAsyncReaction'
import { noop, sleep } from '@reatom/utils'
import { withCache, withDataAtom, withErrorAtom, withRetry } from '.'
import { isConnected } from '@reatom/hooks'

export const test = suite('reatomAsyncReaction')

test('base', async () => {
  const paramsAtom = atom(0, 'paramsAtom')
  const async1 = reatomAsyncReaction(async (ctx) => {
    const argument = ctx.spy(paramsAtom)
    await ctx.schedule(() => sleep())
    return argument
  }, 'async1').promiseAtom
  const async2 = reatomAsyncReaction(async (ctx) => {
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
  const aAtom = reatomAsyncReaction(async (ctx) => {
    const argument = ctx.spy(paramsAtom)
    await ctx.schedule(() => sleepTrack())
    return argument
  }, 'aAtom').pipe(withCache()).promiseAtom
  const bAtom = reatomAsyncReaction(async (ctx) => {
    const n = await ctx.spy(aAtom)
    return n
  }, 'bAtom').promiseAtom
  const track = mockFn()
  const ctx = createTestCtx()

  ctx.subscribe(bAtom, (p) => p.then(track, noop))
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
  assert.is(track.lastInput(), 2)
  assert.is(track.calls.length, 3)
  assert.is(sleepTrack.calls.length, 4)
  ;`👍` //?
})

test('controller', async () => {
  const controllerTrack = mockFn()
  const paramsAtom = atom(0, 'paramsAtom')
  const someReaction = reatomAsyncReaction(async (ctx) => {
    const argument = ctx.spy(paramsAtom)
    ctx.controller.signal.addEventListener('abort', controllerTrack)
    await ctx.schedule(() => sleep())
    return argument
  }, 'someReaction')
  const ctx = createTestCtx()

  ctx.subscribe(someReaction.promiseAtom, noop)
  await sleep()
  assert.is(controllerTrack.calls.length, 0)

  paramsAtom(ctx, 1)
  assert.is(controllerTrack.calls.length, 1)
  await sleep()
  assert.is(controllerTrack.calls.length, 1)
  paramsAtom(ctx, 2)
  paramsAtom(ctx, 3)
  assert.is(controllerTrack.calls.length, 3)
  await sleep()
  assert.is(controllerTrack.calls.length, 3)
  ;`👍` //?
})

test('withDataAtom', async () => {
  const paramsAtom = atom(0, 'paramsAtom')
  const someReaction = reatomAsyncReaction(async (ctx) => {
    const params = ctx.spy(paramsAtom)
    await ctx.schedule(() => sleep())
    return params
  }, 'someReaction').pipe(withDataAtom(0))
  const ctx = createTestCtx()

  assert.not.ok(isConnected(ctx, paramsAtom))
  ctx.subscribeTrack(someReaction.dataAtom)
  assert.ok(isConnected(ctx, paramsAtom))
  ;`👍` //?
})

test('withErrorAtom withRetry', async () => {
  const paramsAtom = atom(0, 'paramsAtom')
  const someReaction = reatomAsyncReaction(async (ctx) => {
    const params = ctx.spy(paramsAtom)
    if (params === 0) throw new Error('test error')
    await ctx.schedule(() => sleep())
    return params
  }, 'someReaction').pipe(
    withDataAtom(0),
    withErrorAtom(),
    withRetry({
      onReject(ctx, error, retries) {
        if (retries === 0) return 1
      },
    }),
  )
  const ctx = createTestCtx()

  ctx.subscribeTrack(someReaction.dataAtom)
  await sleep()
  assert.is(ctx.get(someReaction.errorAtom)?.message, 'test error')

  paramsAtom(ctx, 1)
  await sleep()
  assert.is(ctx.get(someReaction.errorAtom), undefined)
  ;`👍` //?
})

test.run()
