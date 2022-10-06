---
layout: ../../layouts/Layout.astro
title: persist
description: Reatom for persist
---  

There is no docs yet, but you could check tests instead:
```ts
import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createCtx, atom, Rec } from '@reatom/core'

import { PersistRecord, reatomPersist } from './'
import { sleep } from '@reatom/utils'

test(`withPersist`, async () => {
  const { withPersist } = reatomPersist({
    get(ctx, { name }) {
      const snapshot: Rec<PersistRecord> = {
        a1: { data: 1, version: 0 },
        a2: { data: 2, version: 0 },
      }
      return snapshot[name!] ?? null
    },
    set() {},
  })
  const a1 = atom(0, 'a1').pipe(withPersist())
  const a2 = atom(0, 'a2').pipe(withPersist())

  assert.throws(() => atom(0).pipe(withPersist()))

  const ctx = createCtx()

  assert.is(ctx.get(a1), 1)
  assert.is(ctx.get(a2), 2)
  ;('👍') //?
})

test(`withPersist offline like`, async () => {
  const { withPersist } = reatomPersist({
    get(ctx, { name }) {
      return storage[name!] ?? null
    },
    async set(ctx, { name }, payload) {
      while (!isOnline) await sleep(10)
      storage[name!] = payload
    },
  })
  const numberAtom = atom(0, 'number').pipe(withPersist())
  const storage: Rec<PersistRecord> = {}
  let isOnline = true

  const ctx = createCtx()

  assert.is(ctx.get(numberAtom), 0)

  numberAtom(ctx, 1)
  assert.is(ctx.get(numberAtom), 1)
  assert.is(storage.number?.data, 1)

  isOnline = false

  numberAtom(ctx, 2)

  assert.is(storage.number?.data, 1)

  await sleep(10)

  assert.is(storage.number?.data, 1)

  isOnline = true

  assert.is(storage.number?.data, 1)

  await sleep(10)

  assert.is(storage.number?.data, 2)
  ;('👍') //?
})

test.run()

```
