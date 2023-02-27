import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx, getDuration } from '@reatom/testing'
import { sleep } from '@reatom/utils'

import { reatomTimer } from './'

test(`base API`, async () => {
  const timerAtom = reatomTimer(`test`)
  const ctx = createTestCtx()

  timerAtom.intervalAtom.setSeconds(ctx, 0.001)

  var target = 50
  var duration = await getDuration(() =>
    timerAtom.startTimer(ctx, target / 1000),
  )

  assert.ok(duration >= target)

  var target = 50
  var [duration] = await Promise.all([
    getDuration(() => timerAtom.startTimer(ctx, target / 1000)),
    sleep(target / 2).then(() => timerAtom.stopTimer(ctx)),
  ])
  assert.ok(duration >= target / 2 && duration < target)
  ;`👍` //?
})

test('progressAtom', async () => {
  const timerAtom = reatomTimer({ delayMultiplier: 1 })
  const ctx = createTestCtx()

  timerAtom.intervalAtom(ctx, 10)
  const track = ctx.subscribeTrack(timerAtom.progressAtom)
  track.calls.length = 0

  await timerAtom.startTimer(ctx, 60)
  assert.equal(
    track.calls.map(({ i }) => i[0]),
    [0.17, 0.33, 0.5, 0.67, 0.83, 1],
  )
  ;`👍` //?
})

test('pauseAtom', async () => {
  const timerAtom = reatomTimer({ delayMultiplier: 1 })
  const ctx = createTestCtx()

  timerAtom.intervalAtom(ctx, 10)
  const track = ctx.subscribeTrack(timerAtom.progressAtom)
  track.calls.length = 0

  timerAtom.startTimer(ctx, 60)

  await sleep(25)
  assert.equal(
    track.calls.map(({ i }) => i[0]),
    [0.17, 0.33],
  )

  timerAtom.pauseAtom(ctx, true)
  await sleep(40)
  assert.equal(
    track.calls.map(({ i }) => i[0]),
    [0.17, 0.33],
  )

  timerAtom.pauseAtom(ctx, false)
  await sleep(40)

  assert.equal(
    track.calls.map(({ i }) => i[0]),
    [0.17, 0.33, 0.5, 0.67, 0.83, 1],
  )
  ;`👍` //?
})

test('do not allow overprogress', async () => {
  const timerAtom = reatomTimer({ delayMultiplier: 1, interval: 1 })
  const ctx = createTestCtx()

  const target = 10
  const start = Date.now()
  const promise = timerAtom.startTimer(ctx, target)

  await sleep(target / 2)
  while (Date.now() - start < target) {}

  await promise

  assert.is(ctx.get(timerAtom.progressAtom), 1)
  ;`👍` //?
})

test.run()
