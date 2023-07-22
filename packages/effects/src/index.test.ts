import { action, atom, createCtx, Ctx, Fn } from '@reatom/core'
import { sleep } from '@reatom/utils'
import { createTestCtx } from '@reatom/testing'
import { mapPayloadAwaited } from '@reatom/lens'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { disposable, take, takeNested } from './'

test('disposable async branch', async () => {
  const act = action((ctx, v: number) => ctx.schedule(() => Promise.resolve(v)))
  const actRes = act.pipe(mapPayloadAwaited((ctx, v) => v))
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
  let resolve1: Fn
  const promise1 = new Promise<void>((r) => (resolve1 = r))
  let resolve2: Fn
  const promise2 = new Promise<void>((r) => (resolve2 = r))
  let resolve3: Fn
  const promise3 = new Promise<void>((r) => (resolve3 = r))

  const effect1 = action((ctx) =>
    ctx.schedule(async (ctx) => {
      effect2(ctx)
      await promise1
    }),
  )
  const effect2 = action((ctx) => ctx.schedule(() => promise2))
  const effect3 = action((ctx) => ctx.schedule(() => promise3))

  const ctx = createCtx()

  let nestedResolved = false
  let effect3Resolved = false
  takeNested(ctx, effect1).then(() => {
    nestedResolved = true
  })
  effect3(ctx).then(() => {
    effect3Resolved = true
  })

  resolve1!()
  await sleep()
  assert.is(nestedResolved, false)
  assert.is(effect3Resolved, false)

  resolve2!()
  await sleep()
  assert.is(nestedResolved, true)
  assert.is(effect3Resolved, false)

  resolve3!()
  await sleep()
  assert.is(effect3Resolved, true)
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
