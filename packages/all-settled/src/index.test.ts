import { action, createContext, Ctx, Fn } from '@reatom/core'
import { sleep } from '@reatom/utils'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { allSettled } from './'

test(`await transaction`, async () => {
  const effect = (cb: Fn<[Ctx]>) => action((ctx) => ctx.schedule(cb))

  const targetMs = 10
  const longestMs = targetMs * 2
  const smallestMS = targetMs / 2

  const flow1_0 = effect(async (ctx) => {
    flow1_1(ctx)
    await sleep(smallestMS)
  })
  const flow1_1 = effect(() => sleep(targetMs))
  const flow2_0 = effect(() => sleep(longestMs))

  const ctx = createContext()

  const start = Date.now()

  const flow1Promise = allSettled(ctx, flow1_0)
  const flow2Promise = flow2_0(ctx)

  await flow1Promise

  const flow1Duration = Date.now() - start

  assert.ok(flow1Duration >= targetMs && flow1Duration < longestMs)

  await flow2Promise
  const flow2Duration = Date.now() - start
  assert.ok(flow2Duration >= longestMs && flow2Duration < targetMs + longestMs)
  ;`👍` //?
})

test.run()
