import { action, atom } from '@reatom/core'
import { sleep } from '@reatom/utils'
import { reatomNumber } from '@reatom/primitives'
import { createTestCtx, mockFn } from '@reatom/testing'
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
  mapPayload,
} from './'

test(`map and mapInput`, async () => {
  const a = reatomNumber(0)
  const aMap = a.pipe(mapState((ctx, v, u) => v + 1))
  const aMapInput = a.pipe(mapInput((ctx, v: string) => Number(v)))
  const ctx = createTestCtx()

  const aMapInputTrack = ctx.subscribeTrack(aMapInput, () => {})

  assert.is(ctx.get(a), 0)
  assert.is(ctx.get(aMap), 1)
  assert.equal(ctx.get(aMapInput), [])

  aMapInput(ctx, '1')
  assert.is(ctx.get(a), 1)
  assert.is(ctx.get(aMap), 2)
  assert.equal(aMapInputTrack.lastInput(), [{ params: ['1'], payload: 1 }])
  ;`👍` //?
})

test(`readonly and plain`, () => {
  const a = reatomNumber(0)
  const aReadonly = a.pipe(readonly, plain)
  const aPlain = a.pipe(readonly, plain)
  const ctx = createTestCtx()
  assert.is(a(ctx, 1), 1)
  assert.is(a.increment(ctx, 1), 2)
  // @ts-expect-error
  assert.throws(() => aReadonly(ctx, 1))
  // @ts-expect-error
  assert.throws(() => aPlain.increment(ctx, 1))
  ;`👍` //?
})

test(`mapPayload, mapPayloadAwaited, toAtom`, async () => {
  const a = action(
    (ctx, v: number) => ctx.schedule(() => sleep(10).then(() => v)),
    'a',
  )
  const aMaybeString = a.pipe(mapPayloadAwaited((ctx, v) => v.toString()))
  const aString = aMaybeString.pipe(toAtom('0'))
  const aNumber = aMaybeString.pipe(
    mapPayload((ctx, v) => Number(v)),
    toAtom(0),
  )
  const ctx = createTestCtx()

  const trackMaybeString = ctx.subscribeTrack(aMaybeString)
  const trackString = ctx.subscribeTrack(aString)
  const trackNumber = ctx.subscribeTrack(aNumber)

  assert.equal(ctx.get(a), [])
  assert.equal(ctx.get(aMaybeString), [])
  assert.is(ctx.get(aString), '0')
  assert.is(ctx.get(aNumber), 0)

  const promise = a(ctx, 4)

  assert.is(trackMaybeString.calls.length, 1)
  assert.is(trackString.calls.length, 1)
  assert.is(trackNumber.calls.length, 1)

  await promise

  assert.equal(trackMaybeString.lastInput(), [{ params: [4], payload: '4' }])
  assert.is(trackString.lastInput(), '4')
  assert.is(trackNumber.lastInput(), 4)
  ;`👍` //?
})

test(`mapPayloadAwaited sync resolution`, async () => {
  const act = action((ctx) => ctx.schedule(async () => 0))
  const act1 = act.pipe(mapPayloadAwaited((ctx, v) => v + 1))
  const act2 = act.pipe(mapPayloadAwaited((ctx, v) => v + 2))
  const sumAtom = atom((ctx, state: Array<any> = []) => {
    state = [...state]
    ctx.spy(act1).forEach(({ payload }) => state.push(payload))
    ctx.spy(act2).forEach(({ payload }) => state.push(payload))

    return state
  })
  const ctx = createTestCtx()
  const cb = mockFn()

  ctx.subscribe(sumAtom, cb)

  assert.equal(cb.calls.length, 1)
  assert.equal(cb.lastInput(), [])

  await act(ctx)

  assert.equal(cb.calls.length, 2)
  assert.equal(cb.lastInput(), [1, 2])
  ;`👍` //?
})

test('filter atom', () => {
  const a = atom(1)
  const a1 = a.pipe(filter((ctx, v) => v !== 2))
  const ctx = createTestCtx()

  const track = ctx.subscribeTrack(a1)
  assert.is(track.calls.length, 1)
  assert.is(track.lastInput(), 1)

  a(ctx, 2)
  assert.is(track.calls.length, 1)

  a(ctx, 3)
  assert.is(track.calls.length, 2)
  assert.is(track.lastInput(), 3)
  ;`👍` //?
})

test('filter action', () => {
  const act = action<number>()
  const act1 = act.pipe(filter((ctx, v) => v !== 2))
  const ctx = createTestCtx()

  const track = ctx.subscribeTrack(act1)
  assert.is(track.calls.length, 1)
  assert.equal(track.lastInput(), [])

  act(ctx, 2)
  assert.is(track.calls.length, 1)

  act(ctx, 3)
  assert.is(track.calls.length, 2)
  assert.equal(track.lastInput()[0]?.payload, 3)
  ;`👍` //?
})

test('mapPayload atom', () => {
  const act = action((ctx, v: number) => v)
  const actAtom = act.pipe(mapPayload(0))
  const actMapAtom = act.pipe(mapPayload(0, (ctx, v) => v + 1))
  const ctx = createTestCtx()
  const atomTrack = ctx.subscribeTrack(actAtom)
  const actMapTrack = ctx.subscribeTrack(actMapAtom)

  assert.is(atomTrack.lastInput(), 0)
  assert.is(actMapTrack.lastInput(), 0)

  act(ctx, 1)
  assert.is(atomTrack.lastInput(), 1)
  assert.is(actMapTrack.lastInput(), 2)
  ;`👍` //?
})
test('mapPayloadAwaited atom', async () => {
  const act = action((ctx, v: number) => ctx.schedule(() => v))
  const actAtom = act.pipe(mapPayloadAwaited(0))
  const actMapAtom = act.pipe(mapPayloadAwaited(0, (ctx, v) => v + 1))
  const ctx = createTestCtx()
  const atomTrack = ctx.subscribeTrack(actAtom)
  const actMapTrack = ctx.subscribeTrack(actMapAtom)

  assert.is(atomTrack.lastInput(), 0)
  assert.is(actMapTrack.lastInput(), 0)

  await act(ctx, 1)
  assert.is(atomTrack.lastInput(), 1)
  assert.is(actMapTrack.lastInput(), 2)
  ;`👍` //?
})

test.run()
