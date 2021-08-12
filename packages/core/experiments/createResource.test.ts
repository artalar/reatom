import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { createStore } from '@reatom/core'

import { mockFn, parseCauses, sleep } from '../test_utils'

import { createResource } from './createResource'

test(`createResource`, async () => {
  const resourceAtom = createResource(
    ($, state = [0]) => state,
    (param: number) =>
      typeof param === 'number'
        ? Promise.resolve([param])
        : Promise.reject(new Error(param)),
    `testResource`,
  )

  const store = createStore()
  const cb = mockFn()

  store.subscribe(resourceAtom, cb)
  assert.is(cb.calls.length, 1)
  assert.equal(cb.lastInput(), { data: [0], error: null, isLoading: false })

  store.dispatch(resourceAtom.refetch(42))
  assert.is(cb.calls.length, 2)
  assert.equal(cb.lastInput(), { data: [0], error: null, isLoading: true })
  await sleep()
  assert.is(cb.calls.length, 3)
  assert.equal(cb.lastInput(), { data: [42], error: null, isLoading: false })

  // `get` with same params should do nothing
  const state = store.getCache(resourceAtom)!.state
  store.dispatch(resourceAtom.refetch(42))
  assert.is(cb.calls.length, 3)
  assert.equal(cb.lastInput(), state)

  // `req` with same params should force refetch
  store.dispatch(resourceAtom.fetch(42))
  assert.is(cb.calls.length, 4)
  await sleep()
  assert.is(cb.calls.length, 5)
  assert.equal(cb.lastInput(), state)

  // error should handled and stored
  store.dispatch(resourceAtom.fetch('42' as any))
  assert.is(cb.calls.length, 6)
  await sleep()
  assert.is(cb.calls.length, 7)
  assert.equal(cb.lastInput(), {
    data: [42],
    error: new Error('42'),
    isLoading: false,
  })

  // concurrent requests should proceed only one response
  store.dispatch(resourceAtom.fetch(1))
  store.dispatch(resourceAtom.fetch(2))
  store.dispatch(resourceAtom.fetch(3))
  assert.is(cb.calls.length, 8)
  await sleep()
  assert.is(cb.calls.length, 9)
  assert.equal(cb.lastInput(), { data: [3], error: null, isLoading: false })

  assert.equal(parseCauses(cb.lastInput(1)), [
    'DISPATCH: testResource - fetch',
    'testResource - fetch handler',
    'DISPATCH: testResource - done',
    'testResource - done',
  ])
  ;`👍` //?
})
