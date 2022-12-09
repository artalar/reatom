---
layout: ../../layouts/Layout.astro
title: async
description: Reatom for async
---

This package is helping you to manage async requests by adding additional meta information, like `pendingAtom` with count pending caused promises and action hooks `onFulfill`, `onReject`, `onSettle`.

> included in [@reatom/framework](/packages/framework)

`reatomAsync` accepts effect function which returns a promise (it could be just `async` function) and call it in effects queue. `ctx` already includes `controller` which is [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).

```ts
import { reatomAsync } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx, page: number) => fetch(`/api/list?page={page}`, ctx.controller),
  'fetchList',
)
```

You could handle promise states to update other stuff during it batch in the second parameter.

```ts
import { reatomAsync } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx, page: number) => fetch(`/api/list?page={page}`, ctx.controller),
  {
    name: 'fetchList',
    onEffect(ctx, promise, params) {
      notify(ctx, 'fetch start')
    },
    onFulfill(ctx, result) {
      notify(ctx, 'fetch end')
    },
    onReject(ctx, error) {
      notify(ctx, 'fetch error')
    },
    onSettle(ctx) {},
  },
)
```

Also, there are few additional operators which you could plug for extra features - grow as you need, unused operators will be treeshaked.

## `withDataAtom`

Adds property `dataAtom` which updates by `onFulfill` or manually. It is like a tiny cache level. `reset` action included by default.

### Fetch data on demand

```ts
import { reatomAsync, withDataAtom } from '@reatom/async'
import { onConnect } from '@reatom/hooks'

export const fetchList = reatomAsync((ctx) => fetch('...'), 'fetchList').pipe(
  withDataAtom([]),
)

onConnect(fetchList.dataAtom, fetchList)
```

### Cache timeout

```ts
import { reatomAsync, withDataAtom } from '@reatom/async'
import { onConnect, onDisconnect } from '@reatom/hooks'

export const fetchList = reatomAsync((ctx) => fetch('...'), 'fetchList').pipe(
  withDataAtom([]),
)

const staleTime = 1000 * 60 * 5 // 5 min
onConnect(fetchList.dataAtom, (ctx) => {
  fetchList(ctx)
  return () =>
    setTimeout(() => {
      if (!ctx.isConnected()) fetchList.dataAtom.reset(ctx)
    }, staleTime)
})
```

### Invalidate backend data on mutation

```ts
import { reatomAsync, withDataAtom, onUpdate } from '@reatom/framework'

export const fetchList = reatomAsync((ctx) => api.getList()).pipe(
  withDataAtom(),
)
export const updateList = reatomAsync((ctx, newList) => api.updateList(newList))
onUpdate(updateList, (ctx, newList) => {
  // optimistic update
  fetchList.dataAtom(ctx, newList)
  fetchList(ctx)
})
```

## `withErrorAtom`

Adds `errorAtom` which updates by `onReject` and clears by `onFulfill`. You could add a mapper function and reset trigger: `null | 'onEffect' | 'onFulfill'` (`onEffect` by default).

```ts
import { reatomAsync, withErrorAtom } from '@reatom/async'

export const fetchSome = reatomAsync(async (ctx) =>
  fetch('/api/some').then((r) => {
    if (r.status !== 200) throw r
    return r.json()
  }),
).pipe(
  withErrorAtom((ctx, error) =>
    error instanceof Response
      ? error.status
      : error?.message || 'unknown error',
  ),
)
```

## `withAbort`

Allow to configure concurrency strategy ("last in win" by default) for `ctx.controller.abort` call and adds `onAbort` action. Added `abortControllerAtom` witch stores AbortController of the last effect call, which you could abort by `abort` action.

```ts
import { reatomAsync, withAbort } from '@reatom/async'
import { onDisconnect, onUpdate } from '@reatom/hooks'

const reatomResource = (initState, url, concurrent = true) => {
  const effect = reatomAsync((ctx) => fetch(url, ctx.controller)).pipe(
    withAbort({ strategy: concurrent ? 'last-in-win' : 'none' }),
    withDataAtom(initState),
  )

  // abort unneeded request
  onDisconnect(effect.dataAtom, effect.abort)

  return effect
}
```

## `withRetry`

Adds `retry` action and `paramsAtom` to store last params of the effect call.

### Retry request on failure

`withRetry` accept optional `onReject` parameter which is a hook which is called with context, payload error and retries count parameters. This hook could return a number which will be used as a timer for scheduling `retry` action. To skip the retry scheduling return nothing or negative number.

```ts
import { reatomAsync, withRetry } from '@reatom/async'

const fetchData = reatomAsync((ctx) => fetch('...')).pipe(
  withRetry({
    onReject(ctx, error, retries) {
      if (retries < 4) return 0
    },
  }),
)
```

```ts
import { reatomAsync, withRetry } from '@reatom/async'

const fetchData = reatomAsync((ctx) => fetch('...')).pipe(
  withRetry({
    onReject(ctx, error, retries) {
      return 100 * Math.min(500, retries ** 2)
    },
  }),
)
```

You could specify `fallbackParams` for ability to call `retry` before first effect call (it will throw an error either).

```ts
import { reatomAsync, withRetry } from '@reatom/async'

const fetchData = reatomAsync((ctx, page: number) =>
  fetch(`/api?page=${page}`),
).pipe(withRetry({ fallbackParams: 1 }))

// will call fetch(`/api?page=1`)
fetchData.retry(ctx)
```

### Periodic refresh for used data

```ts
import { reatomAsync, withDataAtom, withRetry, sleep } from '@reatom/framework'

export const fetchList = reatomAsync((ctx) => fetch('...')).pipe(
  withDataAtom([]),
  withRetry(),
)
onConnect(fetchList.dataAtom, async (ctx) => {
  while (ctx.isConnected()) {
    await fetchList.retry(ctx).catch(() => {})
    await sleep(5000)
  }
})
```

## Story test

[source](https://github.com/artalar/reatom/blob/v3/packages/async/src/index.story.test.ts)

```ts
import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { onConnect } from '@reatom/hooks'
import { createTestCtx } from '@reatom/testing'
import { isShallowEqual, sleep } from '@reatom/utils'

import { reatomAsync, withDataAtom } from '@reatom/async'

test('optimistic update without extra updates on invalidation', async () => {
  //#region backend
  let mock = [{ id: 1, value: 1 }]
  const getData = async () => mock
  const putData = async (id: number, value: number) => {
    await sleep()
    mock = mock.slice()
    mock.find((item) => item.id === id)!.value = value
  }
  //#endregion

  // this is short for test purposes, use ~5000 in real code
  const INTERVAL = 15

  const fetchData = reatomAsync(getData, 'fetchData').pipe(
    withDataAtom([], (ctx, payload, state) => {
      const isEqual = payload.every((item, i) => isShallowEqual(item, state[i]))
      if (isEqual) return state
      const result = state.slice()
      result.splice(0, payload.length, ...payload)
      return result
    }),
  )
  const updateData = reatomAsync(
    (ctx, id: number, value: number) => putData(id, value),
    {
      name: 'updateData',
      onEffect: (ctx, [id, value]) =>
        fetchData.dataAtom(ctx, (state) =>
          state.map((item) => (item.id === id ? { ...item, value } : item)),
        ),
    },
  )

  onConnect(fetchData.dataAtom, async (ctx) => {
    while (ctx.isConnected()) {
      await fetchData(ctx)
      await sleep(INTERVAL)
    }
  })

  const ctx = createTestCtx()
  const effectTrack = ctx.subscribeTrack(fetchData.onFulfill)
  const dataTrack = ctx.subscribeTrack(fetchData.dataAtom)

  assert.is(dataTrack.calls.length, 1)
  assert.equal(dataTrack.lastInput(), [])
  await sleep()
  assert.is(dataTrack.calls.length, 2)
  assert.equal(dataTrack.lastInput(), [{ id: 1, value: 1 }])

  updateData(ctx, 1, 2)
  assert.is(dataTrack.calls.length, 3)
  assert.equal(dataTrack.lastInput(), [{ id: 1, value: 2 }])

  assert.is(effectTrack.calls.length, 2)
  await sleep(INTERVAL)
  // the effect is called again, but dataAtom is not updated
  assert.is(effectTrack.calls.length, 3)
  assert.is(dataTrack.calls.length, 3)

  // cleanup test
  dataTrack.unsubscribe()
})

test.run()
```
