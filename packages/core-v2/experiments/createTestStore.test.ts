import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { createNumberAtom } from '@reatom/core/primitives'
import { createAtom } from '@reatom/core-v2'

import { mockFn } from '../test_utils'

import { createTestStore } from './createTestStore'

test(`createTestStore`, async () => {
  const a1 = createNumberAtom(1)
  const a2 = createAtom({ a1 }, (track) => track.get(`a1`))
  const a3 = createAtom({ a2 }, (track) => track.get(`a2`))
  const store = createTestStore()
  const cb = mockFn()

  store.subscribe(a3, (newState) => cb(newState))

  assert.is(store.getState(a1), 1)
  assert.is(store.getState(a2), 1)
  assert.is(store.getState(a3), 1)

  store.dispatch(store.setState(a2, 2))
  assert.is(store.getState(a1), 1)
  assert.is(store.getState(a2), 2)
  assert.is(store.getState(a3), 2)
  ;`👍` //?
})

test(`createTestStore stale atom`, async () => {
  const a1 = createNumberAtom(1)
  const store = createTestStore()

  store.dispatch(store.setState(a1, 123))

  assert.is(store.getState(a1), 123)
  ;`👍` //?
})

test.run()
