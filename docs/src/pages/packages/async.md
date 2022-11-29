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

export const fetchList = reatomAsync((ctx, page: number) =>
  fetch(`/api/list?page={page}`, ctx.controller),
)
```

Also, there are few additional operators which you could plug for extra features - grow as you need, unused operators will be treeshaked.

## `withDataAtom`

Adds property `dataAtom` which updates by `onFulfill` or manually. It is like a tiny cache level.

### Fetch data on demand

```ts
import { reatomAsync, withDataAtom } from '@reatom/async'
import { onConnect } from '@reatom/hooks'

export const fetchList = reatomAsync((ctx) => fetch('...')).pipe(
  withDataAtom([]),
)

onConnect(fetchList.dataAtom, fetchList)
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

Adds `errorAtom` which updates by `onReject` and clears by `onFulfill`.

## `withAbort`

Allow to configure concurrency strategy ("last in win" by default) for `ctx.controller.abort` call and adds `onAbort` action.

## `withRetryAction`

Adds `retry` action and `paramsAtom` to store last params of the effect call.

### Retry request on failure

`withRetryAction` accept optional `onReject` parameter which is a hook which is called with context, payload error and retries count parameters. This hook could return a number which will be used as a timer for scheduling `retry` action. To skip the retry scheduling return nothing or negative number.

```ts
import { reatomAsync, withRetryAction } from '@reatom/async'

const fetchData = reatomAsync((ctx) => fetch('...')).pipe(
  withRetryAction({
    onReject(ctx, error, retries) {
      if (retries < 4) return 0
    },
  }),
)
```

```ts
import { reatomAsync, withRetryAction } from '@reatom/async'

const fetchData = reatomAsync((ctx) => fetch('...')).pipe(
  withRetryAction({
    onReject(ctx, error, retries) {
      return 100 * Math.min(500, retries ** 2)
    },
  }),
)
```

### Periodic refresh for used data

```ts
import {
  reatomAsync,
  withDataAtom,
  withRetryAction,
  sleep,
} from '@reatom/framework'

export const fetchList = reatomAsync((ctx) => fetch('...')).pipe(
  withDataAtom([]),
  withRetryAction(),
)
onConnect(fetchList.dataAtom, async (ctx) => {
  while (ctx.isConnected()) {
    await sleep(5000)
    await fetchList.retry(ctx).catch(() => {})
  }
})
```
