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
  obj.class = { CLASS, class: { CLASS } }
  obj.list = [
    Object.create(null),
    undefined,
    false,
    true,
    0,
    '0',
    Symbol('0'),
    Symbol.for('0'),
    0n,
    () => 0,
    new Map([['key', 'val']]),
    Object.assign(new Date(0), {
      toString(this: Date) {
        return this.toISOString()
      },
    }),
    /regexp/,
  ]

  const target = `[reatom·Object#1][reatom·Array#2][reatom·string]class[reatom·Object#3][reatom·Array#4][reatom·string]class[reatom·Object#5][reatom·Array#6][reatom·string]CLASS[reatom·AbortController#7][reatom·Array#8][reatom·string]CLASS[reatom·AbortController#7][reatom·Array#9][reatom·string]list[reatom·Array#10][reatom·Object#11][reatom·undefined]undefined[reatom·boolean]false[reatom·boolean]true[reatom·number]0[reatom·string]0[reatom·Symbol]0[reatom·Symbol]0[reatom·bigint]0[reatom·Function#12][reatom·Map#13][reatom·Array#14][reatom·string]key[reatom·string]val[reatom·object]1970-01-01T00:00:00.000Z[reatom·object]/regexp/[reatom·Array#15][reatom·string]obj[reatom·Object#1]`

  let i = 1
  const unmock = mockRandom(() => i++)

  assert.is(toStringKey(obj), target)
  assert.is(toStringKey(obj), toStringKey(obj))

  unmock()
  assert.is(toStringKey(obj), toStringKey(obj))
})

test.run()
