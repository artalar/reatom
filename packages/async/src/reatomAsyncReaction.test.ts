import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx, mockFn } from '@reatom/testing'
import { atom } from '@reatom/core'
import { reatomAsyncReaction } from './reatomAsyncReaction'
import { noop, sleep } from '@reatom/utils'
import { withCache } from '.'

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
  const async1 = reatomAsyncReaction(async (ctx) => {
    const argument = ctx.spy(paramsAtom)
    await ctx.schedule(() => sleepTrack())
    return argument
  }, 'async1').pipe(withCache()).promiseAtom
  const async2 = reatomAsyncReaction(async (ctx) => {
    const n = await ctx.spy(async1)
    return n
  }).promiseAtom
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
  assert.is(sleepTrack.calls.length, 4)

  paramsAtom(ctx, 1)
  paramsAtom(ctx, 2)
  paramsAtom(ctx, 3)
  await sleep()
  assert.is(track.lastInput(), 3)
  assert.is(track.calls.length, 2)
  assert.is(sleepTrack.calls.length, 4)
  ;`👍` //?
})

test.run()
