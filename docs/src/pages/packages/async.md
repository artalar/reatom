---
layout: ../../layouts/Layout.astro
title: async
description: Reatom for async
---

This package is helping you to manage async requests by adding additional meta information, like `pendingAtom` with count current in pending caused promises and action hooks `onFulfill`, `onReject`, `onSettle`. The basic fabric adds minimum features, but you could increase it by adding additional operators, see below.

> included in [@reatom/framework](/packages/framework)

`reatomAsync` accepts effect function which returns a promise (it could be just `async` function) and call it in effects queue. `ctx` already includes `controller` which is [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).

```ts
import { reatomAsync } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx, page: number) => fetch(`/api/list?page=${page}`, ctx.controller),
  'fetchList',
)
```

You could handle promise states to update other stuff during it batch in the second parameter with a list of optional hooks.

```ts
import { reatomAsync } from '@reatom/async'

const listAtom = atom({ data: [], status: 'idle' })
export const fetchList = reatomAsync(
  (ctx, page: number) => fetch(`/api/list?page=${page}`, ctx.controller),
  {
    name: 'fetchList',
    onEffect(ctx, promise, params) {
      listAtom(ctx, { data: [], status: 'pending' })
    },
    onFulfill(ctx, result) {
      listAtom(ctx, { data: result, status: 'fulfilled' })
    },
    onReject(ctx, error) {
      listAtom(ctx, { data: [], status: 'rejected' })
    },
    onSettle(ctx) {},
  },
)
```

Also, there are few additional operators which you could plug for extra features - grow as you need, unused operators will be treeshaked.

## `withDataAtom`

Adds property `dataAtom` which updates by `onFulfill` or manually. It is like a tiny cache level. `reset` action included by default.

### Fetch data on demand

Fetch data declaratively and lazy only when needed. This is a super simple and useful combine of `async` and `hooks` packages, which shows the power of reatom.

```ts
import { reatomAsync, withDataAtom } from '@reatom/async'
import { onConnect } from '@reatom/hooks'

export const fetchList = reatomAsync((ctx) => fetch('...'), 'fetchList').pipe(
  withDataAtom([]),
)
onConnect(fetchList.dataAtom, fetchList)
```

### Invalidate backend data on mutation

You could use regular atom / action hooks.

```ts
import { reatomAsync, withDataAtom, onUpdate } from '@reatom/framework'

export const fetchList = reatomAsync((ctx) => api.getList()).pipe(
  withDataAtom(),
  'fetchList',
)
export const updateList = reatomAsync(
  (ctx, newList) => api.updateList(newList),
  'updateList',
)
onUpdate(updateList.onFulfill, fetchList)
```

You could use specific async hooks.

```ts
import { reatomAsync, withDataAtom } from '@reatom/async'

export const fetchList = reatomAsync((ctx) => api.getList()).pipe(
  withDataAtom(),
  'fetchList',
)
export const updateList = reatomAsync(
  (ctx, newList) => api.updateList(newList),
  {
    name: 'updateList',
    onEffect(ctx, promise, /*params*/ [newList]) {
      const oldList = fetchList.dataAtom(ctx)
      // optimistic update
      const newList = fetchList.dataAtom(ctx, newList)
      // rollback on error
      promise.catch(() => {
        if (ctx.get(fetchList.dataAtom) === newList) {
          fetchList.dataAtom(ctx, oldList)
        } else {
          // TODO looks like user changed data again
          // need to notify user about conflict.
        }
      })
    },
  },
)
```

## `withStatusesAtom`

Adds property `statusesAtom` with additional statuses, which updates by the effect calling, `onFulfill` and `onReject`.

```ts
import { reatomAsync, withStatusesAtom } from '@reatom/async'

export const fetchList = reatomAsync((ctx) => api.getList(), 'fetchList').pipe(
  withStatusesAtom(),
)

const initStatuses = ctx.get(fetchList.statusesAtom)

initStatuses.isPending // false
initStatuses.isFulfilled // false
initStatuses.isRejected // false
initStatuses.isSettled // false

initStatuses.isEverPending // false
initStatuses.isEverSettled // false
```

`isEverSettled` is like _loaded_ state, `!isEverPending` is like _idle_ state, `isPending && !isEverSettled` is like *first loading* state.

You could import special types of statuses of each effect state and use it for typesafe conditional logic.

```ts
export type AsyncStatusesPending =
  | AsyncStatusesFirstPending
  | AsyncStatusesAnotherPending

export type AsyncStatuses =
  | AsyncStatusesNeverPending
  | AsyncStatusesPending
  | AsyncStatusesFulfilled
  | AsyncStatusesRejected
```

## `withCache`

You could rule cache behavior by optional `length` and `staleTime` parameters. `length` is a number of cached results, `staleTime` is a time in ms after which cache will be dropped. You are not required to use `withDataAtom`, the cache worked for effect results, but if `dataAtom` exists - it will be updated too. You could specify `paramsToKey` option to stabilize your params reference for internal `Map` cache, by default all object properties sorted.

```ts
import { reatomAsync, withDataAtom, withCache } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx, filters) => api.getList(filters),
  'fetchList',
).pipe(
  withDataAtom([]),
  withCache({
    length = /* default: */ 5,
    staleTime = /* default: */ 5 * 60 * 1000,
  }),
)

fetchList(ctx, { query: 'foo', page: 1 }) // call the effect
fetchList(ctx, { page: 1, query: 'foo' }) // returns the prev promise
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
import { reatomAsync, withDataAtom, withAbort } from '@reatom/async'
import { onDisconnect } from '@reatom/hooks'

const reatomResource = (initState, url, concurrent = true) => {
  const resource = reatomAsync((ctx) =>
    fetch(url, ctx.controller).then((response) => {
      if (response.status !== 200) throw response
      return response.json()
    }),
  ).pipe(
    withDataAtom(initState),
    withAbort({ strategy: concurrent ? 'last-in-win' : 'none' }),
  )

  // abort unneeded request
  onDisconnect(resource.dataAtom, resource.abort)

  return resource
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
import { createTestCtx } from '@reatom/testing'

import { onConnect } from '@reatom/hooks'
import { isDeepEqual, jsonClone, sleep } from '@reatom/utils'

import { reatomAsync, withDataAtom } from '@reatom/async'

test('optimistic update without extra updates on invalidation', async () => {
  //#region backend
  let mock = [{ id: 1, value: 1 }]
  const getData = async () => mock
  const putData = async (id: number, value: number) => {
    await sleep()
    mock = jsonClone(mock)
    mock.find((item) => item.id === id)!.value = value
  }
  //#endregion

  // this is short for test purposes, use ~5000 in real code
  const INTERVAL = 5

  const fetchData = reatomAsync(getData, 'fetchData').pipe(
    // add `dataAtom` and map the effect payload into it
    // try to prevent new reference stream if nothing really changed
    withDataAtom([], (ctx, payload, state) =>
      isDeepEqual(payload, state) ? state : payload,
    ),
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

  // every subscription calls passed callback immediately
  assert.is(effectTrack.calls.length, 1)
  assert.is(dataTrack.calls.length, 1)
  assert.equal(dataTrack.lastInput(), [])

  // `onConnect` calls `fetchData`, wait it and check changes
  await sleep()
  assert.is(dataTrack.calls.length, 2)
  assert.equal(dataTrack.lastInput(), [{ id: 1, value: 1 }])

  // call `updateData` and check changes
  updateData(ctx, 1, 2)
  assert.is(dataTrack.calls.length, 3)
  assert.equal(dataTrack.lastInput(), [{ id: 1, value: 2 }])

  // wait for `fetchData` and check changes
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
