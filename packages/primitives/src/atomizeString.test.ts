import { createContext } from '@reatom/core'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { atomizeString } from './atomizeString'

test(`atomizeString. reset`, () => {
  const a = atomizeString(`string`)
  const ctx = createContext()

  assert.is(ctx.get(a), `string`)

  a(ctx, (s) => `s`)

  assert.is(ctx.get(a), `s`)
  a.reset(ctx)
  assert.is(ctx.get(a), `string`)
  ;`👍` //?
})

test.run()
