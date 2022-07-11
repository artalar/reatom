import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { atom, createContext } from '@reatom/core'
import { mockFn } from '@reatom/internal-utils'

import { connectLogger } from './'

test(`base API`, async () => {
  const a1 = atom(0)
  const a2 = atom(0, `test`)
  const ctx = createContext()
  const log = mockFn()

  connectLogger(ctx, { log })

  ctx.run(() => {
    a1(ctx, 1)
    a2(ctx, 2)
  })

  assert.equal(log.lastInput(), { [a2.__reatom.name!]: 2 })
  ;`👍` //?
})

test.run()
