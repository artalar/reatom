import { action, atom, createCtx, Ctx, Fn } from '@reatom/core'
import { sleep } from '@reatom/utils'
import { createTestCtx, mockFn } from '@reatom/testing'
import { mapPayloadAwaited, toAtom } from '@reatom/lens'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { disposable, take, takeNested } from './'

test('disposable async branch', async () => {
  const act = action((ctx, v: number) => ctx.schedule(() => Promise.resolve(v)))
  const actRes = act.pipe(mapPayloadAwaited())
  const ctx = createTestCtx()
  const track = ctx.subscribeTrack(actRes)

  track.calls.length = 0
  act(ctx, 1)
  act(ctx, 2)
  assert.is(track.calls.length, 0)
  await sleep()
  assert.is(track.calls.length, 2)

  track.calls.length = 0
  const disposableCtx = disposable(ctx)
  act(disposableCtx, 1)
  act(disposableCtx, 2)
  disposableCtx.dispose()
  await sleep()
  assert.is(track.calls.length, 0)
  ;`👍` //?
})

test('take', async () => {
  const act = action((ctx, v: number) => ctx.schedule(() => Promise.resolve(4)))
  const at = atom(0)
  const ctx = createTestCtx()

  setTimeout(act, 0, ctx, 4)
  assert.is(await take(ctx, act), 4)

  setTimeout(at, 0, ctx, 4)
  assert.is(await take(ctx, at), 4)
  ;`👍` //?
})

test('await transaction', async () => {
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

  const ctx = createCtx()

  const start = Date.now()

  const flow1Promise = takeNested(ctx, flow1_0)
  const flow2Promise = flow2_0(ctx)

  await flow1Promise

  const flow1Duration = Date.now() - start

  assert.ok(flow1Duration >= targetMs && flow1Duration < longestMs)

  await flow2Promise
  const flow2Duration = Date.now() - start
  assert.ok(flow2Duration >= longestMs && flow2Duration < targetMs + longestMs)
  ;`👍` //?
})

// test('unstable_actionizeAllChanges', async () => {
//   const act1 = action()
//   const act2 = act1
//     .pipe(mapPayload(() => Promise.resolve(0)))
//     .pipe(mapPayloadAwaited())
//   const a1 = atom(0)
//   const sum = unstable_actionizeAllChanges({
//     a1,
//     act1,
//     act2,
//   })
//   const ctx = createCtx()
//   const cb = mockFn()

//   sum.pipe(toPromise(ctx)).then(cb)

//   a1(ctx, 2)

//   assert.is(cb.calls.length, 0)

//   act1(ctx)

//   assert.is(cb.calls.length, 0)

//   await act2.pipe(toPromise(ctx))

//   await sleep()

//   assert.equal(cb.lastInput(), { a1: 2, act1: undefined, act2: 0 })
//   ;`👍` //?
// })

test.run()
