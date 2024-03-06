import { action, atom, CtxSpy } from '@reatom/core'
import { createTestCtx, mockFn } from '@reatom/testing'
import { sleep } from '@reatom/utils'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { withInit, controlConnection, isConnected, onConnect, isInit } from './'

test('withInit', () => {
  const a = atom(0).pipe(withInit(() => 123))
  const ctx = createTestCtx()
  assert.is(ctx.get(a), 123)
  ;`👍` //?
})

test('controlledConnection', () => {
  const aAtom = atom(0)
  const track = mockFn((ctx: CtxSpy) => ctx.spy(aAtom))
  const bAtom = atom(track)
  const bAtomControlled = bAtom.pipe(controlConnection())
  const ctx = createTestCtx()

  ctx.subscribe(bAtomControlled, () => {})
  assert.is(track.calls.length, 1)
  assert.is(isConnected(ctx, bAtom), true)

  aAtom(ctx, (s) => (s += 1))
  assert.is(track.calls.length, 2)
  assert.is(isConnected(ctx, bAtom), true)

  bAtomControlled.toggleConnection(ctx)
  aAtom(ctx, (s) => (s += 1))
  assert.is(track.calls.length, 2)
  assert.is(isConnected(ctx, bAtom), false)
  ;`👍` //?
})

test('onConnect ctx.isConnect', async () => {
  const a = atom(0)
  const ctx = createTestCtx()
  const delay = 5
  let i = 0

  onConnect(a, async (ctx) => {
    while (ctx.isConnected()) {
      i++
      await sleep(delay)
    }
  })

  const track = ctx.subscribeTrack(a)
  assert.is(i, 1)

  await sleep(delay)
  assert.is(i, 2)

  track.unsubscribe()
  await sleep(delay)
  assert.is(i, 2)
  ;`👍` //?
})

test('onConnect ctx.controller', async () => {
  const a = atom(0)
  const ctx = createTestCtx()
  let delay = 0
  let aborted: boolean
  let connected: boolean

  onConnect(a, async (ctx) => {
    await sleep(delay)
    aborted = ctx.controller.signal.aborted
    connected = ctx.isConnected()
  })

  const track = ctx.subscribeTrack(a)
  track.unsubscribe()
  delay = 5
  ctx.subscribeTrack(a)
  await sleep()

  assert.is(aborted!, true)
  assert.is(connected!, true)
  ;`👍` //?
})

test('isInit', () => {
  const ctx = createTestCtx()

  const trigger = atom(0, 'trigger')
  const computation = atom((ctx) => {
    ctx.spy(trigger)
    // call isInit twice to ensure that returned value is always the same within an call
    isInit(ctx)
    return isInit(ctx)
  }, 'computation')

  assert.is(ctx.get(computation), true)
  assert.is(ctx.get(computation), true)
  trigger(ctx, 1)
  assert.is(ctx.get(computation), false)
  assert.is(ctx.get(computation), false)

  const work = action((ctx) => {
    isInit(ctx)
    return isInit(ctx)
  })

  assert.is(work(ctx), true)
  assert.is(work(ctx), false)
})

test.run()
