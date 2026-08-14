import { expect, test } from 'test'

import { isDeepEqual, mockRandom, toStringKey } from './utils'

test('toStringKey is stable for the same mutable object reference', () => {
  let nextRandom = 0
  const restoreRandom = mockRandom(() => ++nextRandom)
  const params = { a: 1 }

  try {
    expect(toStringKey(params, false)).toBe(toStringKey(params, false))
  } finally {
    restoreRandom()
  }
})

test('isDeepEqual handles shared references symmetrically', () => {
  const shared = { value: 1 }
  const withSharedReferences = { x: shared, y: shared }
  const withDuplicatedReferences = { x: { value: 1 }, y: { value: 1 } }

  expect(isDeepEqual(withSharedReferences, withDuplicatedReferences)).toBe(true)
  expect(isDeepEqual(withDuplicatedReferences, withSharedReferences)).toBe(true)
})
