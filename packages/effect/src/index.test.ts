import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { mapAsync, toAtom } from '@reatom/lens'
import { onUpdate } from '@reatom/utils'

import { effect } from './'
import { atom, createContext } from '@reatom/core'

test(`base API`, async () => {
  let i = 1
  const dataResource = effect(async (ctx, v: number) => v + i).pipe(
    mapAsync((ctx, value) => ({ value })),
    toAtom({ value: 0 }),
  )
  const ctx = createContext()
  ctx.subscribe(dataResource, () => {})

  assert.is(ctx.get(dataResource).value, 0)

  dataResource(ctx, 1)

  assert.is(await dataResource.toPromise(ctx), 2)
  assert.is(ctx.get(dataResource).value, 2)

  i++
  assert.is(await dataResource.retry(ctx), 3)
  ;`👍` //?
})

test('retry', async () => {
  let attempts = 0
  const fetchData = effect(async (ctx, v: number) => {
    if (attempts++ < 2) throw new Error('test error')
    return v
  })

  const failTimesAtom = atom(0)
  onUpdate(fetchData.onReject, (ctx, { state: error }) => {
    if (failTimesAtom(ctx, (s) => ++s) > 4) return failTimesAtom(ctx, 0)
    fetchData.retry(ctx)
  })

  const ctx = createContext()

  ctx.subscribe(
    fetchData.pipe(
      mapAsync((ctx, v) => v),
      toAtom(),
    ),
    (v) => {
      v //?
    },
  )

  fetchData(ctx, 123)
})

test.run()
