import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx } from '@reatom/testing'
import { onConnect } from '@reatom/hooks'

import { reatomAsync, withDataAtom, withCache } from './'

test('withCache', async () => {
  const fetchData = reatomAsync(
    async (ctx, { a, b }: { a: number; b: number }) => a,
  ).pipe(withDataAtom(0), withCache())
  const ctx = createTestCtx()

  await fetchData(ctx, { a: 400, b: 0 })

  const promise1 = fetchData(ctx, { a: 123, b: 0 })
  assert.is(ctx.get(fetchData.pendingAtom), 1)
  assert.is(ctx.get(fetchData.dataAtom), 400)

  assert.is(await promise1, 123)
  assert.is(ctx.get(fetchData.pendingAtom), 0)
  assert.is(ctx.get(fetchData.dataAtom), 123)

  const promise2 = fetchData(ctx, { b: 0, a: 123 })
  assert.is(ctx.get(fetchData.pendingAtom), 0)
  assert.is(ctx.get(fetchData.dataAtom), 123)
  assert.is(await promise2, 123)

  fetchData(ctx, { a: 400, b: 0 })
  assert.is(ctx.get(fetchData.pendingAtom), 0)
  assert.is(ctx.get(fetchData.dataAtom), 400)
  ;`👍` //?
})

test('withCache dataAtom mapper', async () => {
  let i = 0
  const fetchData = reatomAsync(async (ctx) => [++i]).pipe(
    withDataAtom(0, (ctx, [i]) => i),
    withCache(),
  )
  onConnect(fetchData.dataAtom, fetchData)

  const ctx = createTestCtx()

  await fetchData(ctx)
  assert.is(ctx.get(fetchData.dataAtom), 1)

  await fetchData(ctx)
  assert.is(ctx.get(fetchData.dataAtom), 1)
  ;`👍` //?
})

test.run()
