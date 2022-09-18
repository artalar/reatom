import { createCtx } from '@reatom/core'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { reatomString } from './reatomString'

test(`reatomString. reset`, () => {
  const a = reatomString(`string`)
  const ctx = createCtx()

  assert.is(ctx.get(a), `string`)

  a(ctx, (s) => `s`)

  assert.is(ctx.get(a), `s`)
  a.reset(ctx)
  assert.is(ctx.get(a), `string`)
  ;`👍` //?
})

test.run()
