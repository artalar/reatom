import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { action, atom } from '@reatom/core'

import { createTestCtx } from './'

test('createTestCtx', async () => {
  const act = action((ctx) => ctx.schedule(() => 123))
  const ctx = createTestCtx()
  const listener = ctx.subscribeTrack(act)

  assert.is(listener.calls.length, 1)
  ctx.mock(act, [{ params: [], payload: Promise.resolve(42) }])
  assert.is(listener.calls.length, 2)

  listener.calls.length = 0
  await act(ctx)
  assert.is(listener.calls.length, 1)

  listener.calls.length = 0
  ctx.mock(act, [{ params: [], payload: Promise.resolve(43) }])
  assert.is(listener.calls.length, 1)
  assert.is(await listener.lastInput()[0]?.payload, 43)
  ;`👍` //?
})

test('mockAction', () => {
  const a1 = atom(0)
  const act = action((ctx) => {
    return a1(ctx, (s) => ++s)
  })
  const a2 = atom((ctx) =>
    ctx.spy(act).reduce((state, { payload }) => payload, 0),
  )
  const ctx = createTestCtx()

  const track1 = ctx.subscribeTrack(a1)
  const track2 = ctx.subscribeTrack(a2)
  assert.is(track1.lastInput(), 0)
  assert.is(track2.lastInput(), 0)

  act(ctx)
  assert.is(track1.lastInput(), 1)
  assert.is(track2.lastInput(), 1)

  ctx.mockAction(act, () => 2)
  assert.is(track1.lastInput(), 1)
  assert.is(track2.lastInput(), 1)
  act(ctx)
  assert.is(track1.lastInput(), 1)
  assert.is(track2.lastInput(), 2)

  ;`👍` //?
})

test.run()
