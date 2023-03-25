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

  await timerAtom.startTimer(ctx, 50)
  assert.equal(track.inputs(), [0, 0.2, 0.4, 0.6, 0.8, 1])
  ;`👍` //?
})

test('pauseAtom', async () => {
  const timerAtom = reatomTimer({ interval: 10, delayMultiplier: 1 })
  const ctx = createTestCtx()

  const track = ctx.subscribeTrack(timerAtom.progressAtom)
  track.calls.length = 0

  timerAtom.startTimer(ctx, 100)
  let target = Date.now() + 100

  let i = 5
  while (i--) {
    await sleep(5)
  }

  assert.equal(track.inputs(), [0.1, 0.2])

  timerAtom.pauseAtom(ctx, true)
  await sleep(25)
  target += 25
  assert.equal(track.inputs(), [0.1, 0.2])

  timerAtom.pauseAtom(ctx, false)
  await sleep(10)
  console.log(track.inputs())
  assert.equal(track.inputs(), [0.1, 0.2, 0.3])

  await sleep(target - Date.now() - 5)
  console.log(track.inputs())
  assert.equal(track.inputs(), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])

  await sleep(10)
  console.log(track.inputs())
  assert.equal(track.inputs(), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1])
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

// TODO
test.run()
