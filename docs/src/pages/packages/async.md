---
layout: ../../layouts/Layout.astro
title: async
description: Reatom for async
---

This package is helping you to manage async requests by adding additional meta information, like `pendingAtom` with count pending caused promises and action hooks `onFulfill`, `onReject`, `onSettle`.

> included in [@reatom/framework](/packages/framework)

```ts
import { reatomAsync } from '@reatom/async'

const fetchList = reatomAsync((ctx, page: number) =>
  fetch(`/api/list?page={page}`),
)
```

Also, there are few additional operators which you could plug for extra features - grow as you need:

> all this imports available in one `@reatom/framework`

## `withDataAtom`

Adds `dataAtom` which updates by `onFulfill` or manually.

### Fetch data on demand

```ts
import { reatomAsync, withDataAtom } from '@reatom/async'
import { onConnect } from '@reatom/hooks'

const fetchData = reatomAsync((ctx) => fetch('...')).pipe(withDataAtom([]))

onConnect(fetchData.dataAtom, fetchData)
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
