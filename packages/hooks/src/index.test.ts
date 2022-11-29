import { atom, CtxSpy } from '@reatom/core'
import { createTestCtx, mockFn } from '@reatom/testing'
import { sleep } from '@reatom/utils'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { withInit, controlConnection, isConnected, onConnect } from './'

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

test.run()
