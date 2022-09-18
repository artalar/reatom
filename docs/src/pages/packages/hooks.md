---
layout: ../../layouts/Layout.astro
title: hooks
description: Reatom for hooks
---  

There is no docs yet, but you could check tests instead:
```ts
import { atom, createCtx, CtxSpy } from '@reatom/core'
import { mockFn } from '@reatom/testing'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { withInit, controlConnection, isConnected } from './'

test('withInit', () => {
  const a = atom(0).pipe(withInit(() => 123))
  const ctx = createCtx()
  assert.is(ctx.get(a), 123)
  ;`👍` //?
})

test('controlledConnection', () => {
  const aAtom = atom(0)
  const track = mockFn((ctx: CtxSpy) => ctx.spy(aAtom))
  const bAtom = atom(track)
  const bAtomControlled = bAtom.pipe(controlConnection())
  const ctx = createCtx()

  ctx.subscribe(bAtomControlled, () => {})
  assert.is(track.calls.length, 1)
  assert.is(isConnected(ctx, bAtom), true)

  aAtom(ctx, (s) => (s += 1))
  assert.is(track.calls.length, 2)
  assert.is(isConnected(ctx, bAtom), true)

  bAtomControlled.toggleConnection(ctx)
  aAtom(ctx, (s) => (s += 1))
  assert.is(track.calls.length, 2)
  assert.is(isConnected(ctx, bAtom), false)
  ;`👍` //?
})

test.run()

```
