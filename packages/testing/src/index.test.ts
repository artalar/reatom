import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { action } from '@reatom/core'

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

test.run()
