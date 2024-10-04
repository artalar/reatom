import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { isDeepEqual, toAbortError, toStringKey, random, mockRandom } from './'

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

test('toStringKey', () => {
  const CLASS = new AbortController()

  const obj: Record<string, any> = {}
  obj.obj = obj
  obj.one = { two: { CLASS } }
  obj.list = [undefined, false, true, 0, '0', Symbol('0'), Symbol.for('0'), 0n, () => 0, new Map([['key', 'val']])]

  const target = `[object Object][object Array][string]list[object Array][number]1[number]2[number]3[object Map][object Array][string]key[string]val[object Array][string]obj[object Object#1][object Array][string]one[object Object][object Array][string]two[object Object][object Array][string]CLASS[object AbortController#12]`

  let i = 1
  const unmock = mockRandom(() => i++)

  assert.is(toStringKey(obj), target)
  assert.is(toStringKey(obj), toStringKey(obj))

  unmock()
  assert.is(toStringKey(obj), toStringKey(obj))
})

test.run()
