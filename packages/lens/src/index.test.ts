import { action, atom, createContext } from '@reatom/core'
import { sleep } from '@reatom/utils'
import { atomizeNumber } from '@reatom/primitives'
import { mockFn } from '@reatom/testing'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import {
  readonly,
  mapState,
  mapAsync,
  mapInput,
  filter,
  plain,
  toAtom,
  toPromise,
} from './'

test(`map and mapInput`, async () => {
  const a = atomizeNumber(0)
  const aMap = a.pipe(mapState((ctx, v, u) => v + 1))
  const aMapInput = a.pipe(mapInput((ctx, v: string) => [ctx, Number(v)]))
  const aMapMapInput = a.pipe(
    mapState((ctx, v) => v + 1),
    mapInput((ctx, v: string) => [ctx, Number(v)]),
  )
  const ctx = createContext()

  assert.is(a.__reatom, aMapInput.__reatom)
  assert.is(ctx.get(a), 0)
  assert.is(ctx.get(aMap), 1)
  assert.is(ctx.get(aMapInput), 0)
  assert.is(ctx.get(aMapMapInput), 1)

  aMapInput(ctx, '1')
  assert.is(ctx.get(a), 1)
  assert.is(ctx.get(aMap), 2)
  assert.is(ctx.get(aMapInput), 1)
  assert.is(ctx.get(aMapMapInput), 2)

  aMapMapInput(ctx, '2')
  assert.is(ctx.get(a), 2)
  assert.is(ctx.get(aMap), 3)
  assert.is(ctx.get(aMapInput), 2)
  assert.is(ctx.get(aMapMapInput), 3)
  ;`👍` //?
})

test(`map action`, () => {
  // TODO
})

test(`readonly and plain`, () => {
  const a = atomizeNumber(0)
  const a1 = a.pipe(readonly, plain)
  const ctx = createContext()
  assert.is(a(ctx, 1), 1)
  // @ts-expect-error
  assert.throws(() => a1(ctx, 1))
  assert.not.ok('increment' in a1)
  ;`👍` //?
})

test(`mapAsync and toAtom`, async () => {
  const a = action((ctx) => ctx.schedule(() => sleep(10).then(() => 10)))
  const aMaybeString = a.pipe(mapAsync((ctx, v) => v + 1))
  const aString = a.pipe(
    mapAsync((ctx, v) => v + 1),
    toAtom(0),
  )
  const ctx = createContext()
  const cb = mockFn()

  ctx.subscribe(aMaybeString, cb)
  ctx.subscribe(aString, () => {})

  assert.equal(ctx.get(a), [])
  assert.is(cb.calls.length, 1)
  assert.is(ctx.get(aString), 0)

  const promise = a(ctx)

  assert.equal(ctx.get(a), [])
  assert.is(cb.calls.length, 1)
  assert.is(ctx.get(aString), 0)

  await promise

  assert.is(cb.calls.length, 2)
  assert.equal(cb.lastInput(), [11])
  assert.is(ctx.get(aString), 11)
  ;`👍` //?
})

test(`filter`, () => {
  const a = atom(1)
  const a1 = a.pipe(filter((v) => v !== 2))
  const ctx = createContext()
  const cb = mockFn()

  ctx.subscribe(a1, cb)
  assert.is(cb.calls.length, 1)
  assert.equal(cb.lastInput(), 1)

  a(ctx, 2)
  assert.is(cb.calls.length, 1)
  assert.equal(cb.lastInput(), 1)

  a(ctx, 3)
  assert.is(cb.calls.length, 2)
  assert.equal(cb.lastInput(), 3)
  ;`👍` //?
})

test('toPromise', async () => {
  const a = action((ctx) => ctx.schedule(() => sleep(10).then(() => 123)))
  const ctx = createContext()

  assert.equal(await Promise.all([a.pipe(toPromise(ctx)), a(ctx)]), [123, 123])
  ;`👍` //?
})

test.run()
