import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { Action, action, atom, Ctx, Fn } from '@reatom/core'
import { noop, sleep } from '@reatom/utils'
import { createTestCtx, mockFn } from '@reatom/testing'
import { onConnect } from '@reatom/hooks'
import { mapPayloadAwaited } from '@reatom/lens'

import {
  concurrent,
  disposable,
  spawn,
  take,
  takeNested,
  withAbortableSchedule,
} from '.'

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

  const ctx = createTestCtx()

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

test('withAbortableSchedule', async () => {
  const asyncAction = <I extends any[], O>(
    cb: Fn<[Ctx, ...I], O>,
    name: string,
  ): Action<I, O> =>
    action((ctx, ...a) => cb(withAbortableSchedule(ctx), ...a), name)

  const track = mockFn()
  const doSome = asyncAction((ctx, ms: number) => {
    ctx
      .schedule(() => sleep(ms))
      .then((v) => {
        v //?
        track(v)
      })
      .catch(noop)
  }, 'doSome')
  const someAtom = atom(null, 'someAtom')
  const ctx = createTestCtx()

  onConnect(someAtom, (ctx) => {
    doSome(ctx, 1)
  })

  const un = ctx.subscribe(someAtom, () => {})
  await sleep(10)
  assert.is(track.calls.length, 1)

  un()

  ctx.subscribe(someAtom, () => {})()
  await sleep(10)
  assert.is(track.calls.length, 1)
  ;`👍` //?
})

test('take filter', async () => {
  const act = action((ctx, v: number) => ctx.schedule(() => Promise.resolve(v)))
  const track = mockFn()
  const ctx = createTestCtx()

  take(ctx, act, (ctx, v, skip) => {
    return v < 4 ? skip : v.toString()
  }).then(track)
  act(ctx, 1)
  await null
  act(ctx, 2)
  act(ctx, 3)
  await null
  act(ctx, 4)
  await sleep()
  assert.is(track.calls.length, 1)
  assert.is(track.lastInput(), '4')
  ;`👍` //?
})

test('concurrent', async () => {
  const countAtom = atom(0)
  const results = [] as any[]
  countAtom.onChange(
    concurrent(async (ctx, count) => {
      try {
        await ctx.schedule(noop)
        results.push(count)
      } catch (error) {
        results.push(error)
      }
    }),
  )
  const ctx = createTestCtx()

  countAtom(ctx, 1)
  countAtom(ctx, 2)
  await sleep()
  assert.is(results.length, 2)
  assert.is(results[0]?.name, 'AbortError')
  assert.is(results[1], 2)

  const anAtom = atom(null)
  onConnect(anAtom, (ctx) => countAtom(ctx, 3))
  ctx.subscribeTrack(anAtom).unsubscribe()
  await sleep()
  assert.is(results.length, 3)
  assert.is(results.at(-1).name, 'AbortError')
  ;`👍` //?
})

test('spawn', async () => {
  const countAtom = atom(0)
  const results = [] as any[]
  countAtom.onChange(
    concurrent((ctx, count) =>
      spawn(ctx, async (ctx) => {
        try {
          await ctx.schedule(noop)
          results.push(count)
        } catch (error) {
          results.push(error)
        }
      }),
    ),
  )
  const ctx = createTestCtx()

  countAtom(ctx, 1)
  countAtom(ctx, 2)

  await sleep()
  assert.equal(results, [1, 2])
  ;`👍` //?
})

test.run()
