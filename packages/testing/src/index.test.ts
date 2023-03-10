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
  const countAtom = atom(0)
  const add = action((ctx, value: number) => {
    return countAtom(ctx, value)
  })
  const paramsAtom = atom((ctx) => ctx.spy(add).map(({ params }) => params[0]))
  const payloadAtom = atom((ctx) => ctx.spy(add).map(({ payload }) => payload))
  const ctx = createTestCtx()

  const countTrack = ctx.subscribeTrack(countAtom)
  const paramsTrack = ctx.subscribeTrack(paramsAtom)
  const payloadTrack = ctx.subscribeTrack(payloadAtom)

  add(ctx, 1)
  assert.is(countTrack.lastInput(), 1)
  assert.equal(paramsTrack.lastInput(), [1])
  assert.equal(payloadTrack.lastInput(), [1])

  const unmock = ctx.mockAction(add, (ctx, value) => {
    assert.is(value, 10)
    return countAtom(ctx, 2)
  })
  ctx.get(() => {
    add(ctx, 10)
    add(ctx, 10)
  })
  assert.is(countTrack.lastInput(), 2)
  assert.equal(paramsTrack.lastInput(), [10, 10])
  assert.equal(payloadTrack.lastInput(), [2, 2])

  unmock()
  add(ctx, 10)
  assert.is(countTrack.lastInput(), 10)
  assert.equal(paramsTrack.lastInput(), [10])
  assert.equal(payloadTrack.lastInput(), [10])
  ;`👍` //?
})

test.run()
