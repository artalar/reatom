import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { createAtom, createStore, getState } from '@reatom/core'
import { createPrimitiveAtom } from '@reatom/core/primitives'

import { mockFn, sleep } from '../test_utils'

import { debounce } from './debounce'

test(`debounce atom without tracks`, async () => {
  const delay = 10
  const a = createPrimitiveAtom(0, null, { decorators: [debounce(delay)] })
  const store = createStore()
  const cb = mockFn()

  store.subscribe(a, cb)

  assert.is(cb.calls.length, 1)
  assert.is(cb.lastInput(), 0)

  store.dispatch(a.change((s) => s + 1))

  assert.is(cb.calls.length, 1)
  assert.is(cb.lastInput(), 0)

  await sleep(delay)

  assert.is(cb.calls.length, 2)
  assert.is(cb.lastInput(), 1)
  ;`👍` //?
})

test(`behavior of middle (warm) atom besides leafs atom and debounced atom`, async () => {
  const delay = 10
  const a = createPrimitiveAtom(0)
  const bTrack = mockFn()
  const b = createAtom({ a }, ({ get }) => {
    bTrack()
    return get(`a`)
  })
  const c = createAtom({ b }, ({ get }) => get(`b`), {
    decorators: [debounce(delay)],
  })
  const store = createStore()
  const bCb = mockFn()

  const un = store.subscribe(b, bCb)
  store.subscribe(c, () => {})
  assert.is(getState(a, store), 0)
  assert.is(bTrack.calls.length, 1)
  assert.is(bCb.calls.length, 1)

  store.dispatch(a.change((s) => s + 1))
  assert.is(getState(a, store), 1)
  assert.is(
    bTrack.calls.length,
    2,
    `hot atom should receive dispatch immediately`,
  )
  assert.is(bCb.calls.length, 2)

  await sleep(delay)

  assert.is(getState(a, store), 1)
  assert.is(
    bTrack.calls.length,
    2,
    `hot atom should not receive dispatch from child atom invalidation`,
  )

  un()

  store.dispatch(a.change((s) => s + 1))
  assert.is(getState(a, store), 2)
  assert.is(
    bTrack.calls.length,
    2,
    `cold atom should not receive dispatch immediately`,
  )

  await sleep(delay)

  assert.is(getState(a, store), 2)
  assert.is(
    bTrack.calls.length,
    3,
    `cold atom should receive dispatch from child atom invalidation`,
  )
  ;`👍` //?
})

test.run()
