import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx, mockFn } from '@reatom/testing'
import { isConnected, onConnect } from '@reatom/hooks'
import { atom } from '@reatom/core'

import { onEvent, reatomEvent } from './'
import { isAbort, sleep } from '@reatom/utils'

// We use the `AbortController` as an event source in these tests to make it portable, as it is available in both Node.js and browsers.

test('onEvent', async () => {
  const a = atom(null)
  const ctx = createTestCtx()
  const cb = mockFn()

  {
    const controller = new AbortController()
    onConnect(a, (ctx) => onEvent(ctx, controller.signal, 'abort', cb))
    const un = ctx.subscribe(a, () => {})
    assert.is(cb.calls.length, 0)
    controller.abort()
    assert.is(cb.lastInput()?.type, 'abort')
    un()
  }

  cb.calls.length = 0

  {
    const controller = new AbortController()
    onConnect(a, (ctx) => onEvent(ctx, controller.signal, 'abort', cb))
    const un = ctx.subscribe(a, () => {})
    un()
    assert.is(cb.calls.length, 0)
    controller.abort()
    assert.is(cb.calls.length, 0)
  }
  ;('👍') //?
})

test('reatomEvent', async () => {
  const source = new AbortController()
  const event = reatomEvent(source.signal, 'abort')
  const ctx = createTestCtx()
  const track = ctx.subscribeTrack(event.promiseAtom)

  source.abort('42')
  const { currentTarget } = await Promise.race([
    track.lastInput(),
    sleep().then(() => Promise.reject('timeout')),
  ])
  assert.is(currentTarget.reason, '42')
  ;('👍') //?
})

test('reatomEvent abort', async () => {
  const controller = new AbortController()
  const event = reatomEvent(controller.signal, 'abort')
  const ctx = createTestCtx()

  const track = ctx.subscribeTrack(event.promiseAtom)
  assert.ok(isConnected(ctx, event))
  assert.ok(isConnected(ctx, event.promiseAtom))

  track.unsubscribe()
  await null
  assert.not.ok(isConnected(ctx, event))
  assert.not.ok(isConnected(ctx, event.promiseAtom))
  ;('👍') //?
})

test.run()
