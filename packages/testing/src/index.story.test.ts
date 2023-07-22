import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { action, atom } from '@reatom/core'
import { createTestCtx } from './'

test('createTestCtx', async () => {
  const add = action<number>()
  const countAtom = atom((ctx, state = 0) => {
    ctx.spy(add, ({ payload }) => (state += payload))
    return state
  })
  const ctx = createTestCtx()
  const track = ctx.subscribeTrack(countAtom)

  assert.is(track.calls.length, 1)
  assert.is(track.lastInput(), 0)

  add(ctx, 10)
  assert.is(track.calls.length, 2)
  assert.is(track.lastInput(), 10)

  ctx.mockAction(add, (ctx, param) => 100)
  add(ctx, 10)
  assert.is(track.calls.length, 3)
  assert.is(track.lastInput(), 110)

  const unmock = ctx.mock(countAtom, 123)
  assert.is(track.calls.length, 4)
  assert.is(track.lastInput(), 123)
  add(ctx, 10)
  assert.is(track.calls.length, 4)
  assert.is(track.lastInput(), 123)

  unmock()
  add(ctx, 10)
  assert.is(track.calls.length, 5)
  assert.is(track.lastInput(), 223)
  ;`👍` //?
})

test.run()
