import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createContext, atom, Rec } from '@reatom/core'

import { persistStorageAtom, withPersist } from './'
import { sleep } from '@reatom/utils'

test(`withPersist`, async () => {
  const a1 = atom(0, 'a1').pipe(withPersist())
  const a2 = atom(0).pipe(withPersist({ key: 'a2' }))

  assert.throws(() => atom(0).pipe(withPersist()))

  const ctx = createContext()

  persistStorageAtom(ctx, {
    throttle: 0,
    get(name) {
      return { a1: { data: 1 }, a2: { data: 2 } }[name] ?? null
    },
    set() {},
  })

  assert.is(ctx.get(a1), 1)
  assert.is(ctx.get(a2), 2)
  ;('👍') //?
})

test(`withPersist throttle`, async () => {
  const throttle = 150
  const a1 = atom(0, 'a1').pipe(withPersist({ throttle }))
  const ctx = createContext()
  const storage: Rec = {}

  persistStorageAtom(ctx, {
    throttle: 0,
    get(name) {
      return null
    },
    set(name, payload) {
      storage[name] = payload
    },
  })

  assert.is(ctx.get(a1), 0)

  a1(ctx, 2) //?
  assert.is(ctx.get(a1), 2)
  assert.equal(storage, {})

  await sleep(throttle / 2)

  assert.equal(storage, {})

  await sleep(throttle / 2)

  assert.equal(storage.a1, { data: 2, version: undefined })
  ;('👍') //?
})

test.run()
