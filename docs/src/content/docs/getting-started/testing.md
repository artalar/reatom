---
title: Testing
description: Explaining how to test reatom code
sidebar:
  order: 4
---

The first thing you need to do is install the test helpers

```
npm i @reatom/testing
```

Let's test this code:

```js
// main.js
import { action, atom } from '@reatom/core'

export const countAtom = atom(0)
export const add = action((ctx, payload) => {
  countAtom(ctx, (state) => state + payload)
})
```

```js
// main.test.js
import { assert, expect, test } from 'vitest'
import { createTestCtx } from '@reatom/testing'

import { add, countAtom } from './main'

test('Test main module', () => {
  const ctx = createTestCtx() // Create test context
  const track = ctx.subscribeTrack(countAtom) // Record atom changes

  // Check initial state
  expect(track.calls.length).toBe(1)
  expect(track.lastInput()).toBe(0)

  // Call some actions
  add(ctx, 5)
  add(ctx, 10)

  // Check that action "add" work properly
  expect(track.calls.length).toBe(3)
  expect(track.lastInput()).toBe(15)
  // same as
  // expect(ctx.get(countAtom)).toBe(15)
})
```

Also you can mock actions if needed. In next example we have an async api.

> Note: In real code, we recommend using the `@reatom/async` to work with asynchronous APIs

```js
// main.js
import { action, atom } from '@reatom/core'

export const dataAtom = atom(null)
export const isLoadingAtom = atom(null)

export const fetchData = action(async (ctx) => {
  const response = await fetch('https://jsonplaceholder.typicode.com/todos/1')
  const data = await response.json()
})

export const loadData = action(async (ctx) => {
  try {
    isLoadingAtom(ctx, true)
    const data = await ctx.spy(fetchData);
    dataAtom(ctx, data)
  } catch (e) {
    console.error(e)
  } finally {
    isLoadingAtom(ctx, false)
  }
})
```

Let's test it without calling real api

```js
import { assert, expect, test } from 'vitest';
import { createTestCtx } from '@reatom/testing';
import { loadTodos, fetchTodos, dataAtom } from './main';

test('Test loadData atom', () => {
  const ctx = createTestCtx()
  const track = ctx.subscribeTrack(loadTodos)

  // Mock action with call
  ctx.mockAction(fetchTodos, (ctx) => Promise.resolve([{ id: 'foo' }]))

  await fetchTodos(ctx)
  expect(track.lastInput()).toStrictEqual([{ id: 'foo' }])
})
```

[Play live at stackblitz](https://stackblitz.com/edit/vitest-dev-vitest-v4pvuq?file=test%2Fbasic.test.ts,package.json)
