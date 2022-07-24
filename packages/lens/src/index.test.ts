import { atom, createContext } from '@reatom/core'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { lens } from './'

test(`lens`, async () => {
  const a = atom(0)
  const aGet = a.pipe(lens({ get: (v) => v + 1 }))
  const aSet = a.pipe(lens({ set: (v: string) => Number(v) }))
  const aGetSet = a.pipe(
    lens({ get: (v) => v + 1, set: (v: string) => Number(v) }),
  )
  const ctx = createContext()

  assert.is(a.__reatom, aSet.__reatom)
  assert.is(ctx.get(a), 0)
  assert.is(ctx.get(aGet), 1)
  assert.is(ctx.get(aSet), 0)
  assert.is(ctx.get(aGetSet), 1)

  aSet(ctx, '1')
  assert.is(ctx.get(a), 1)
  assert.is(ctx.get(aGet), 2)
  assert.is(ctx.get(aSet), 1)
  assert.is(ctx.get(aGetSet), 2)

  aGetSet(ctx, '2')
  assert.is(ctx.get(a), 2)
  assert.is(ctx.get(aGet), 3)
  assert.is(ctx.get(aSet), 2)
  assert.is(ctx.get(aGetSet), 3)
  ;`👍` //?
})

test.run()
