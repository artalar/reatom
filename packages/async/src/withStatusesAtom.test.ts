import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx } from '@reatom/testing'

import { reatomAsync, withCache } from './'
import {
  AsyncStatusesAnotherPending,
  AsyncStatusesFirstPending,
  AsyncStatusesFulfilled,
  AsyncStatusesNeverPending,
  AsyncStatusesRejected,
  withStatusesAtom,
} from './withStatusesAtom'
import { sleep } from '@reatom/utils'

const neverPending: AsyncStatusesNeverPending = {
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
}

const firstPending: AsyncStatusesFirstPending = {
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
}

const fulfilled: AsyncStatusesFulfilled = {
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
}

const rejected: AsyncStatusesRejected = {
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
}

const anotherPending: AsyncStatusesAnotherPending = {
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
}

test('withStatusesAtom', async () => {
  const fetchData = reatomAsync(async (ctx, shouldTrow = false) => {
    if (shouldTrow) throw new Error('withStatusesAtom test error')
  }).pipe(withStatusesAtom())
  const ctx = createTestCtx()

  assert.equal(ctx.get(fetchData.statusesAtom), neverPending)

  const promise = fetchData(ctx)

  assert.equal(ctx.get(fetchData.statusesAtom), firstPending)

  await promise

  assert.equal(ctx.get(fetchData.statusesAtom), fulfilled)

  const promise2 = fetchData(ctx, true)

  assert.equal(ctx.get(fetchData.statusesAtom), anotherPending)

  await promise2.catch(() => {})

  assert.equal(ctx.get(fetchData.statusesAtom), rejected)
  ;`👍` //?
})

test('withCache and withStatusesAtom', async () => {
  const fetchData = reatomAsync(async (ctx, shouldTrow = false) => {
    if (shouldTrow) throw new Error('withStatusesAtom test error')
  }).pipe(
    withStatusesAtom(),
    withCache(),
  )
  const ctx = createTestCtx()
  const track = ctx.subscribeTrack(fetchData.statusesAtom)

  assert.is(track.calls.length, 1)
  assert.equal(track.lastInput(), neverPending)

  const promise = fetchData(ctx)

  assert.is(track.calls.length, 2)
  assert.equal(track.lastInput(), firstPending)

  await promise

  assert.is(track.calls.length, 3)
  assert.equal(track.lastInput(), fulfilled)

  const promise2 = fetchData(ctx, true)

  assert.is(track.calls.length, 4)
  assert.equal(track.lastInput(), anotherPending)
  fetchData(ctx, true).catch(() => {})
  assert.is(track.calls.length, 4)
  assert.equal(track.lastInput(), anotherPending)

  await promise2.catch(() => {})

  assert.equal(track.lastInput(), rejected)
  ;`👍` //?
})

test('withStatusesAtom parallel requests', async () => {
  const fetchData = reatomAsync(() => sleep(10)).pipe(withStatusesAtom())
  const ctx = createTestCtx()
  const track = ctx.subscribeTrack(fetchData.statusesAtom)

  assert.is(track.calls.length, 1)
  assert.equal(track.lastInput(), neverPending)

  const p1 = fetchData(ctx)
  const p2 = fetchData(ctx)

  assert.equal(track.lastInput(), firstPending)

  await p1

  assert.equal(track.lastInput(), anotherPending)

  await p2

  assert.equal(track.lastInput(), fulfilled)
  ;`👍` //?
})

test.run()
