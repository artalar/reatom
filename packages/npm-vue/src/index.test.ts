import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx } from '@reatom/testing'
import { effectScope } from 'vue'
import { reatomRef } from './'
import { atom } from '@reatom/core'
import { onConnect, onDisconnect } from '@reatom/hooks'

test('reatomRef', async () => {
  const ctx = createTestCtx()
  const state = atom(0)

  let connected = false
  onConnect(state, () => (connected = true))
  onDisconnect(state, () => (connected = false))

  assert.is(connected, false)

  const scope = effectScope()
  scope.run(() => {
    const stateRef = reatomRef(state, ctx)
    assert.is(connected, true)
    assert.is(stateRef.value, 0)
    assert.is(connected, true)
    assert.is((stateRef.value = 1), 1)
    assert.is(stateRef.value, 1)
    assert.is(ctx.get(state), 1)
    state(ctx, 2)
    assert.is(stateRef.value, 2)
  })

  assert.is(connected, true)
  scope.stop()
  assert.is(connected, false)
})

test.run()
