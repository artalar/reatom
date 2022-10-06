import { action, atom, createCtx } from '@reatom/core'
import { sleep } from '@reatom/utils'
import { reatomNumber } from '@reatom/primitives'
import { mockFn } from '@reatom/testing'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import {
  readonly,
  mapState,
  mapPayloadAwaited,
  mapInput,
  filter,
  plain,
  toAtom,
  toPromise,
  mapPayload,
  unstable_actionizeAllChanges,
} from './'

test(`map and mapInput`, async () => {
  const a = reatomNumber(0)
  const aMap = a.pipe(mapState((ctx, v, u) => v + 1))
  const aMapInput = a.pipe(mapInput((ctx, v: string) => Number(v)))
  const aMapMapInput = a.pipe(
    mapState((ctx, v) => v + 1),
    mapInput((ctx, v: string) => Number(v)),
  )
  const ctx = createCtx()

  assert.is(a.__reatom, aMapInput.__reatom)
  assert.is(ctx.get(a), 0)
  assert.is(ctx.get(aMap), 1)
  assert.is(ctx.get(aMapInput), 0)
  assert.is(ctx.get(aMapMapInput), 1)

  aMapInput(ctx, '1')
  assert.is(ctx.get(a), 1)
  assert.is(ctx.get(aMap), 2)
  assert.is(ctx.get(aMapInput), 1)
  assert.is(ctx.get(aMapMapInput), 2)

  aMapMapInput(ctx, '2')
  assert.is(ctx.get(a), 2)
  assert.is(ctx.get(aMap), 3)
  assert.is(ctx.get(aMapInput), 2)
  assert.is(ctx.get(aMapMapInput), 3)
  ;`👍` //?
})

test(`readonly and plain`, () => {
  const a = reatomNumber(0)
  const a1 = a.pipe(readonly, plain)
  const ctx = createCtx()
  assert.is(a(ctx, 1), 1)
  // @ts-expect-error
  assert.throws(() => a1(ctx, 1))
  assert.not.ok('increment' in a1)
  ;`👍` //?
})

test(`mapPayload, mapPayloadAwaited, toAtom`, async () => {
  const a = action((ctx) => ctx.schedule(() => sleep(10).then(() => 10)))
  const aMaybeString = a.pipe(
    mapPayloadAwaited((ctx, v) => v + 1),
    mapPayload((ctx, v) => v),
  )
  const aString = a.pipe(
    mapPayloadAwaited((ctx, v) => v + 1),
    toAtom(0),
  )
  const ctx = createCtx()
  const cb = mockFn()

  ctx.subscribe(aMaybeString, cb)
  ctx.subscribe(aString, () => {})

  assert.equal(ctx.get(a), [])
  assert.is(cb.calls.length, 1)
  assert.is(ctx.get(aString), 0)

  const promise = a(ctx)

  assert.equal(ctx.get(a), [])
  assert.is(cb.calls.length, 1)
  assert.is(ctx.get(aString), 0)

  await promise

  assert.is(cb.calls.length, 2)
  assert.equal(cb.lastInput(), [11])
  assert.is(ctx.get(aString), 11)
  ;`👍` //?
})

test(`mapPayloadAwaited sync resolution`, async () => {
  const act = action((ctx) => ctx.schedule(async () => 0))
  const act1 = act.pipe(mapPayloadAwaited((ctx, v) => v + 1))
  const act2 = act.pipe(mapPayloadAwaited((ctx, v) => v + 2))
  const sumAtom = atom((ctx, state: Array<any> = []) => {
    state = [...state]
    ctx.spy(act1).forEach((v) => state.push(v))
    ctx.spy(act2).forEach((v) => state.push(v))

    return state
  })
  const ctx = createCtx()
  const cb = mockFn()

  ctx.subscribe(sumAtom, cb)

  assert.equal(cb.calls.length, 1)
  assert.equal(cb.lastInput(), [])

  await act(ctx)

  assert.equal(cb.calls.length, 2)
  assert.equal(cb.lastInput(), [1, 2])
  ;`👍` //?
})

test(`filter`, () => {
  const a = atom(1)
  const a1 = a.pipe(filter((v) => v !== 2))
  const ctx = createCtx()
  const cb = mockFn()

  ctx.subscribe(a1, cb)
  assert.is(cb.calls.length, 1)
  assert.equal(cb.lastInput(), 1)

  a(ctx, 2)
  assert.is(cb.calls.length, 1)
  assert.equal(cb.lastInput(), 1)

  a(ctx, 3)
  assert.is(cb.calls.length, 2)
  assert.equal(cb.lastInput(), 3)
  ;`👍` //?
})

test('toPromise', async () => {
  const a = action((ctx) => ctx.schedule(() => sleep(10).then(() => 123)))
  const ctx = createCtx()

  assert.equal(await Promise.all([a.pipe(toPromise(ctx)), a(ctx)]), [123, 123])
  ;`👍` //?
})

test(`actionizeAllChanges`, async () => {
  const act1 = action()
  const act2 = act1
    .pipe(mapPayload(() => Promise.resolve(0)))
    .pipe(mapPayloadAwaited())
  const a1 = atom(0)
  const sum = unstable_actionizeAllChanges({
    a1,
    act1,
    act2,
  })
  const ctx = createCtx()
  const cb = mockFn()

  sum.pipe(toPromise(ctx)).then(cb)

  a1(ctx, 2)

  assert.is(cb.calls.length, 0)

  act1(ctx)

  assert.is(cb.calls.length, 0)

  await act2.pipe(toPromise(ctx))

  await sleep()

  assert.equal(cb.lastInput(), { a1: 2, act1: undefined, act2: 0 })
  ;`👍` //?
})

test.run()
