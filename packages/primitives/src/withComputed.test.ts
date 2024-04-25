import { atom, createCtx } from '@reatom/core'
import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { withComputed } from './withComputed'

const test = suite('withComputed')

test('withComputed', () => {
  const a = atom(0)
  const b = atom(0).pipe(withComputed((ctx) => ctx.spy(a)))
  const ctx = createCtx()

  assert.is(ctx.get(b), 0)
  b(ctx, 1)
  assert.is(ctx.get(b), 1)
  a(ctx, 2)
  assert.is(ctx.get(b), 2)
})

test.run()
