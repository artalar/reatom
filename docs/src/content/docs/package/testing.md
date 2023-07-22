---
title: testing
description: Reatom testing package
---

Small context wrapper simplify your mocking and testing.

## Installation

```sh
npm i @reatom/testing
```

## Usage

We recommend to use [uvu](https://github.com/lukeed/uvu) as helper library for test description, as it could be used in any runtime (and even browser!) and super fast. To clarify, with uvu you allow to run your test files with node / deno / bun / graalvm / [esbuild-kit/tsx](https://github.com/esbuild-kit/tsx) and browser just out of the box. But `@reatom/testing` is not coupled to uvu, you could use any testing framework.

```ts
import { createTestCtx, mockFn } from '@reatom/testing'
```

```ts
export interface TestCtx extends Ctx {
  mock<T>(anAtom: Atom<T>, fallback: T): Unsubscribe

  mockAction<T>(anAction: Action<any[], T>, cb: Fn<[Ctx], T>): Unsubscribe

  subscribeTrack<T, F extends Fn<[T]>>(
    anAtom: Atom<T>,
    cb?: F,
  ): F & {
    unsubscribe: Unsubscribe
    calls: ReturnType<typeof mockFn<[T], any>>['calls']
    lastInput: ReturnType<typeof mockFn<[T], any>>['lastInput']
  }
}

declare function mockFn<I extends any[], O>(
  fn?: (...input: I) => O,
): ((...input: I) => O) & {
  calls: Array<{ i: I; o: O }>
  lastInput: Fn<[], I[0]>
}
```

## Story test

[source](https://github.com/artalar/reatom/blob/v3/packages/testing/src/index.story.test.ts)

```ts
import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { action, atom } from '@reatom/core'
import { createTestCtx } from '@reatom/testing'

test('createTestCtx', async () => {
  const add = action<number>()
  const countAtom = atom((ctx, state = 0) => {
    ctx.spy(add, ({ payload }) => (state += payload))
    return state
  })
  const ctx = createTestCtx()
  const track = ctx.subscribeTrack(countAtom)

  assert.is(track.calls.length, 1)
  assert.is(track.lastInput(), 0)

  add(ctx, 10)
  assert.is(track.calls.length, 2)
  assert.is(track.lastInput(), 10)

  ctx.mockAction(add, (ctx, param) => 100)
  add(ctx, 10)
  assert.is(track.calls.length, 3)
  assert.is(track.lastInput(), 110)

  const unmock = ctx.mock(countAtom, 123)
  assert.is(track.calls.length, 4)
  assert.is(track.lastInput(), 123)
  add(ctx, 10)
  assert.is(track.calls.length, 4)
  assert.is(track.lastInput(), 123)

  unmock()
  add(ctx, 10)
  assert.is(track.calls.length, 5)
  assert.is(track.lastInput(), 223)
})

test.run()
```
