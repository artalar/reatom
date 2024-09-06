import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { isDeepEqual, toAbortError } from './'

test('isDeepEqual Set', () => {
  assert.ok(isDeepEqual(new Set([{ a: 1 }, { a: 2 }]), new Set([{ a: 1 }, { a: 2 }])))
  assert.not.ok(isDeepEqual(new Set([{ a: 1 }, { a: 2 }]), new Set([{ a: 2 }, { a: 1 }])))
  ;('👍') //?
})

test('isDeepEqual Map', () => {
  assert.ok(
    isDeepEqual(
      new Map([[{ a: 1 }, 1], [{ a: 2 }, 2]]) /* prettier-ignore */,
      new Map([[{ a: 1 }, 1], [{ a: 2 }, 2]]) /* prettier-ignore */,
    ),
  )
  assert.not.ok(
    isDeepEqual(
      new Map([[{ a: 1 }, 1], [{ a: 2 }, 2]]) /* prettier-ignore */,
      new Map([[{ a: 2 }, 2], [{ a: 1 }, 1]]) /* prettier-ignore */,
    ),
  )
  assert.ok(
    isDeepEqual(
      new Map([[{ a: 1 }, 1], [{ a: 2 }, 2]]) /* prettier-ignore */,
      new Map([[{ a: 1 }, 1], [{ a: 2 }, 2]]) /* prettier-ignore */,
    ),
  )
  assert.not.ok(
    isDeepEqual(
      new Map([[1, { a: 1 }], [2, { a: 2 }]]) /* prettier-ignore */,
      new Map([[2, { a: 2 }], [1, { a: 1 }]]) /* prettier-ignore */,
    ),
  )
  assert.ok(
    isDeepEqual(
      new Map([[1, { a: 1 }], [2, { a: 2 }]]) /* prettier-ignore */,
      new Map([[1, { a: 1 }], [2, { a: 2 }]]) /* prettier-ignore */,
    ),
  )
  ;('👍') //?
})

test('toAbortError', () => {
  const err = new Error('test')
  const abortErr = toAbortError(err)
  assert.is(abortErr.name, 'AbortError')
  assert.is(abortErr.message, 'test')
  assert.is(abortErr.cause, err)
  ;('👍') //?
})

test.run()
