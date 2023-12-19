import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx } from '@reatom/testing'
import { effectScope } from '@vue/reactivity'
import { reatomRef } from './'
import { atom } from '@reatom/core'

test('reatomRef', async () => {
  const ctx = createTestCtx()
  const state = atom(0)

  let connected = false
  state.__reatom.connectHooks = new Set([() => (connected = true)])
  state.__reatom.disconnectHooks = new Set([() => (connected = false)])

  const scope = effectScope()
  scope.run(() => {
    const stateRef = reatomRef(ctx, state)

    assert.is(connected, false)
    assert.is(stateRef.value, 0)
    assert.is(connected, true)
    assert.is((stateRef.value = 1), 1)
    assert.is(stateRef.value, 1)
    assert.is(ctx.get(state), 1)
    state(ctx, 2)
    assert.is(stateRef.value, 2)
  })

  scope.stop()

  assert.is(connected, false)
})

test.run()
