import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { action, atom, createContext } from '@reatom/core'
import { mapAsync, toAtom } from '@reatom/lens'
import { mockFn, sleep } from '@reatom/internal-utils'

import { connectLogger } from '.'

test(`base`, async () => {
  const asyncResAtom = atom(0)
  const a2 = atom(0, `test`)
  const ctx = createContext()
  const log = mockFn()

  ctx.get(asyncResAtom)
  ctx.get(a2)

  connectLogger(ctx, { log })

  ctx.get(() => {
    asyncResAtom(ctx, 1)
    a2(ctx, 2)
  })

  assert.equal(log.lastInput().changes, {
    [a2.__reatom.name!]: { cause: `self`, state: 2 },
  })

  ctx.get(() => {
    a2(ctx, 10)
    a2(ctx, 20)
  })

  assert.equal(log.lastInput().changes, {
    [a2.__reatom.name!]: [
      { cause: `self`, state: 10 },
      { cause: `self`, state: 20 },
    ],
  })
  ;`👍` //?
})

test(`cause`, async () => {
  // should correct calculate cause for complex async transactions
  const doAsync = action(
    (ctx, v: number) => ctx.schedule(() => Promise.resolve(v)),
    `doAsync`,
  )
  const doAsyncRes = doAsync.pipe(mapAsync((ctx, v) => v, `doAsyncRes`))
  const asyncResAtom = doAsyncRes.pipe(toAtom(0, (ctx, v) => v, `asyncResAtom`))

  const ctx = createContext()
  const log = mockFn()

  connectLogger(ctx, { log })

  ctx.subscribe(asyncResAtom, () => {})

  doAsync(ctx, 123)

  await sleep(5)

  assert.equal(log.lastInput().changes, {
    doAsyncRes: { state: [123], cause: 'self <-- doAsync' },
    asyncResAtom: { state: 123, cause: 'self <-- doAsyncRes <-- doAsync' },
  })
  ;`👍` //?
})

test.run()
