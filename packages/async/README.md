This package is helping you to manage async requests by adding additional meta information, like `pendingAtom` with count pending caused promises and action hooks `onFulfill`, `onReject`, `onSettle`.

> included in [@reatom/framework](https://www.reatom.dev/packages/framework)

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
