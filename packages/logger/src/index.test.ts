import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { action, atom, createContext } from '@reatom/core'
import { mapAsync, toAtom } from '@reatom/lens'
import { mockFn, sleep } from '@reatom/internal-utils'

import { connectLogger } from '.'

test(`base`, async () => {
  const a1 = atom(0)
  const a2 = atom(0, `test`)
  const ctx = createContext()
  const log = mockFn()

  ctx.get(a1)
  ctx.get(a2)

  connectLogger(ctx, { log })

  ctx.get(() => {
    a1(ctx, 1)
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
    (ctx, v: number) => ctx.schedule(() => sleep(5).then(() => v)),
    `doAsync`,
  )
  const asyncRes = doAsync.pipe(mapAsync((ctx, v) => v, `asyncRes`))
  const a1 = asyncRes.pipe(toAtom(0, (ctx, v) => v, `a1`))

  const ctx = createContext()
  const log = mockFn()

  connectLogger(ctx, { log })

  ctx.subscribe(a1, () => {})

  doAsync(ctx, 123)

  await sleep(5)

  assert.equal(log.lastInput().changes, {
    [a1.__reatom.name!]: {
      cause: `self <-- ${asyncRes.__reatom.name} <-- ${doAsync.__reatom.name}`,
      state: [123],
    },
  })
  ;`👍` //?
})

test.run()
