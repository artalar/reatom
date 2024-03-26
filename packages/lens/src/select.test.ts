import { createTestCtx } from '@reatom/testing'
import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { atom } from '@reatom/core'
import { select } from './select'

const test = suite('select')

test('should not recompute the end atom if the source atom changed', () => {
  let track = 0
  const a = atom(0)
  const b = atom((ctx) => {
    track++
    return select(ctx, (ctx) => ctx.spy(a) % 3)
  })
  const ctx = createTestCtx()

  ctx.subscribeTrack(b)
  assert.is(ctx.get(b), 0)
  assert.is(track, 1)

  a(ctx, 3)
  a(ctx, 6)
  assert.is(ctx.get(b), 0)
  assert.is(track, 1)

  a(ctx, 10)
  assert.is(ctx.get(b), 1)
  assert.is(track, 2)
  ;`👍` //?
})

test.run()
