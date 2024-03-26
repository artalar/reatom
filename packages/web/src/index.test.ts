import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx, mockFn } from '@reatom/testing'
import { onConnect } from '@reatom/hooks'
import { atom } from '@reatom/core'

import { onEvent } from './'

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

test.run()
