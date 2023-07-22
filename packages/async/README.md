This package is all you need to handle async requests / logic / flow effectively and predictable. You could wrap your async functions to the main primitive `reatomAsync` and get basic action hooks: `onFulfill`, `onReject`, `onSettle` and `pendingAtom` with count of pending requests. But you could grow as you need and add extra features by adding additional operators: [withDataAtom](#withdataatom) (resolve payload memoization), [withErrorAtom](#witherroratom) (reject payload memoization), [withStatusesAtom](#withstatusesatom) (`isPending`, `isEverSettled` and so on), [withCache](#withcache) (advanced cache policies), [withAbort](#withabort) (concurrent management), [withRetry](#withretry) (flexible retry management).

> included in [@reatom/framework](https://www.reatom.dev/package/framework)

`reatomAsync` accepts effect function which returns a promise (it could be just `async` function) and call it in effects queue. `ctx` already includes `controller` which is a native [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController). The most cool feature of this package and game changer for your DX and your code reliability is automatic linking of nested abort controllers. It means that if you have concurrent ([abortable](#withabort)) process, like on input search with a few serial requests, when a new search starts, previous search and all generated effects cancel automatically.

Base `reatomAsync` weight is just [1.2KB](https://bundlejs.com/?q=%40reatom%2Fasync&treeshake=%5B%7B+reatomAsync+%7D%5D) and the whole package is only [2.6KB](https://bundlejs.com/?q=%40reatom%2Fasync)!

As the main point of this package is general management of async functions, there is no built in solution for data requests in the web or other environment. Fill free to use any existing library, like tiny [redaxios](https://www.npmjs.com/package/redaxios) or feature-rich [axios](https://www.npmjs.com/package/axios).

### Default request helper

For examples below lets define our own simple helper.

```ts
async function request<T>(...params: Parameters<typeof fetch>): Promise<T> {
  const response = await fetch(...params)
  if (!response.ok) throw new Error(response.statusText)
  return await response.json()
}
```

### Basic usage

```ts
import { reatomAsync } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx, page: number) => request(`/api/list?page=${page}`, ctx.controller),
  'fetchList',
)
```

You could handle promise states by optional hooks of the second parameter.

```ts
import { atom } from '@reatom/core'
import { reatomAsync } from '@reatom/async'

const listAtom = atom([])
const errorAtom = atom(null)
export const fetchList = reatomAsync(
  (ctx, page: number) => request(`/api/list?page=${page}`, ctx.controller),
  {
    name: 'fetchList',
    onFulfill(ctx, result) {
      listAtom(ctx, result)
    },
    onReject(ctx, error) {
      errorAtom(ctx, error)
    },
    onEffect(ctx, params, promise) {
      // clear outdated data on request start
      listAtom(ctx, [])
      errorAtom(ctx, null)
    },
  },
)
```

### Qualified usage

Let's add loading state and abort strategy. To be more idiomatic with other Reatom code you could use `onCall` hook - it is like lazy subscription.

```ts
// ~/features/entities/model.ts
import { reatomAsync } from '@reatom/async'
import { atom } from '@reatom/core'

type Element = {
  id: string
  /* ... */
}

export const listAtom = atom(new Array<Element>(), 'listAtom')
export const errorAtom = atom<null | Error>(null, 'errorAtom')
// if number of pending requests are equal or more than 1 - there is a loading state
export const isLoadingAtom = atom(
  (ctx) => ctx.spy(fetchList.pendingAtom) > 0,
  'isLoadingAtom',
)
// store abort controller of last request to prevent race conditions
const abortControllerAtom = atom(new AbortController())
const ABORT = 'ABORT'

export const fetchList = reatomAsync((ctx, page: number) => {
  // cancel previous request
  ctx.get(abortControllerAtom).abort(ABORT)
  // setup controller of current request
  abortControllerAtom(ctx, ctx.controller)

  return request<Array<Element>>(`/api/list?page=${page}`, ctx.controller)
}, 'fetchList')
fetchList.onFulfill.onCall(listAtom)
fetchList.onReject.onCall((ctx, thing) => {
  if (thing !== ABORT) {
    const error = thing instanceof Error ? thing : new Error(String(thing))
    errorAtom(ctx, error)
  }
})

export const updateElement = reatomAsync(
  (ctx, id: string, slice: Partial<Element>) => {
    const { signal } = ctx.controller
    const data = JSON.stringify(slice)
    return request(`/api/list/${id}`, { method: 'POST', data, signal })
  },
  'updateElement',
)
// refresh backend data on successful update
updateElement.onFulfill.onCall((ctx) => fetchList(ctx, 1))
```

> You could get `params` with `onCall` from the third argument: `anAction.onCall((ctx, payload, params) => {/* ... */})`.

### Operators usage

The code above is a good example of well designed async code. As you could see, it is not so different from a regular code without a state manager, but it has a lot of benefits: automatic batching, perfect cause logging, easy to test, and reactivity ofcourse.

However, there is a lot of boilerplate code, which could be reduced with a couple of helpers. We could use built-in operators to extends primitive fetching to useful models without extra boilerplate in a couple lines of code.

```ts
// ~/features/entities/model.ts
import { reatomAsync, withAbort, withDataAtom, withErrorAtom, withStatusesAtom } from "@reatom/framework"; /* prettier-ignore */

type Element = {
  id: string
  /* ... */
}

export const fetchList = reatomAsync(
  (ctx, page: number) =>
    request<Array<Element>>(`/api/list?page=${page}`, ctx.controller),
  'fetchList',
  // add extra handlers with full type inference
).pipe(withDataAtom([]), withErrorAtom(), withAbort(), withStatusesAtom())

export const updateElement = reatomAsync(
  (ctx, id: string, slice: Partial<Element>) => {
    const { signal } = ctx.controller
    const data = JSON.stringify(slice)
    return request(`/api/list/${id}`, { method: 'POST', data, signal })
  },
  'updateElement',
)
updateElement.onFulfill.onCall((ctx) => fetchList(ctx, 1))
```

Now `listAtom` is `fetchList.dataAtom`, `errorAtom` is `fetchList.errorAtom` and loading state you could get from `fetchList.statusesAtom` as `isPending` property. As in the hand written example, `fetchList.errorAtom` will not be updated on abort, even more, `onReject` will not be called too.

The amount of the _list resource_ logic reduced dramatically. All thous features work together perfectly with most efficient batching and static types guaranties. All extra atoms and actions has obvious names, based on `fetchList` (second parameter of `reatomAsync`), which helps with debug. The overhead of thous operators is only ~1KB. And it includes a lot of useful helpers, like `reset` action for `dataAtom`, `abort` action on `fetchList` for manual abort, a few understandable statuses in `statusesAtom` and so on.

Want to know more - check the docs below.

## `withDataAtom`

This is the most dump and useful operator to manage data from a backend. Adds property `dataAtom` which updates by `onFulfill` or manually. It is like a tiny cache level, but mostly for client purposes. `reset` action included already.

Let's say we have a feature, which should be loaded from the backend, changed by a user and saved back to the backend. We could use `withDataAtom` to store the actual state in the atom.

```ts
import { reatomAsync, withDataAtom } from '@reatom/async'

type Feature = {
  /*...*/
}

export const fetchFeature = reatomAsync(
  (ctx) => request<Feature>('/api/feature', ctx.controller),
  'fetchFeature',
).pipe(withDataAtom(null))
// use subscription to `fetchFeature.dataAtom` to get the actual data

// mutate data manually in the feature form
export const changeFeature = action(
  (ctx, property: keyof Feature, value: any) => {
    fetchUser.dataAtom(ctx, (user) => ({ ...user, [property]: value }))
  },
  'changeFeature',
)

// save new feature data to backend on form submit
export const syncFeature = reatomAsync((ctx) => {
  const { signal } = ctx.controller
  const body = JSON.stringify(ctx.get(fetchFeature.dataAtom))
  return request('/api/feature', { method: 'POST', body, signal })
}, 'syncFeature')
```

Here we can see an important pattern for handling backend data. Many web interfaces exist solely for displaying backend DTOs and allowing users to modify them. This data is not shared between different pages of the application, so it is safe to mutate the state obtained from the backend.

Using the same state for both the backend payload and the local form is a more predictable and cleaner approach, as they have the same static type and it is impossible to encounter glitches during data synchronization. Additionally, it requires less code!

However, if you need to separate or share your backend data between different pages and want to optimize it, it is better to use the [withCache](#withcache) feature.

### Fetch data on demand

Here how you can fetch data declaratively and lazy only when needed. This is a super simple and useful combine of `async` and `hooks` packages, which shows the power of Reatom.

```ts
import { reatomAsync, withDataAtom } from '@reatom/async'
import { onConnect } from '@reatom/hooks'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withDataAtom([]))
onConnect(fetchList.dataAtom, fetchList)
```

What this code do? When you connect to `fetchList.dataAtom` it will automatically call `fetchList` action. Connection could appear in any place of your application, by `ctx.subscribe(fetchList.dataAtom, cb)` or by using `useAtom(fetchList.dataAtom)` hook from [@reatom/npm-react](https://www.reatom.dev/adapter/npm-react). Even by a different atom.

```ts
export const filteredListAtom = atom(
  (ctx) => ctx.spy(fetchList.dataAtom).filter((item) => item.active),
  'filteredListAtom',
)
```

When `filteredListAtom` will be connected, `fetchList` will be called automatically too! And when `fetchList` will be fulfilled, `filteredListAtom` will be updated. All things just works together as expected.

### Adding data you've fetched to data you've fetched before

```ts
import { reatomAsync, withDataAtom } from '@reatom/async'

const PAGE_SIZE = 10

export const fetchFeed = reatomAsync(async (ctx, page: number) => {
  const data = await request(
    `api/feed?page=${page}&limit?${page}`,
    ctx.controller,
  )
  return { data, page }
}, 'fetchFeed').pipe(
  withDataAtom([], (ctx, { data, page }, state) => {
    const newState = [...state]
    state.splice((page - 1) * PAGE_SIZE, PAGE_SIZE, ...data)
    return newState
  }),
)
```

### Optimistic update

You could describe optimistic async logic easily with `onEffect` handler, which allow you to read passed parameters by third argument.

```ts
import { reatomAsync, withDataAtom } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withDataAtom([]))

export const updateList = reatomAsync(
  (ctx, newList) => {
    const { signal } = ctx.controller
    const data = JSON.stringify(newList)
    return request('/api/list', { method: 'POST', data, signal })
  },
  {
    name: 'updateList',
    onEffect(ctx, params, promise) {
      const [newList] = params
      const newList = fetchList.dataAtom(ctx, newList)
    },
  },
)
```

For more details of optimistic update check the story tests in [the sources](https://github.com/artalar/reatom/blob/v3/packages/async/src/index.story.test.ts) or in [the end of this doc](https://www.reatom.dev/package/async#story-test).

### Custom dataAtom

If you need to persist effect result to local state and want to use some additional atom, you could describe that logic just by using `fetchList.onFulfill.onCall(listAtom)`.

```ts
import { reatomArray } from '@reatom/primitives'
import { reatomAsync } from '@reatom/async'

export type Element = {
  id: string
  // ...
}

export const fetchList = reatomAsync(
  (ctx) => request<Array<Element>>('api/list', ctx.controller),
  'fetchList',
)
export const listAtom = reatomArray(new Array<Element>(), 'listAtom')
fetchList.onFulfill.onCall(listAtom)
```

Here the interface of `onFulfill` update hook and `listAtom` update is the same and because of that we could pass `listAtom` just by a reference. If you have a different type of the cache atom, you could map payload just by a function.

```ts
import { reatomMap } from '@reatom/primitives'
// ....
export const mapAtom = reatomMap(new Map<string, Element>(), 'mapAtom')
fetchList.onFulfill.onCall((ctx, payload) =>
  mapAtom(ctx, new Map(payload.map((el) => [el.id, el]))),
)
```

## `withErrorAtom`

Adds `errorAtom`, similar to `dataAtom`, which updates by `onReject` and clears by `onFulfill`. You could add a mapper function and reset trigger: `null | 'onEffect' | 'onFulfill'` (`onEffect` by default).

```ts
import { reatomAsync, withErrorAtom } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(
  withErrorAtom(
    // optional mapper
    (ctx, error) =>
      error instanceof Response
        ? error.status
        : error?.message || 'unknown error',
  ),
)
```

## `withStatusesAtom`

Adds property `statusesAtom` with additional statuses, which updates by the effect calling, `onFulfill` and `onReject`. The state is a record with following boolean properties: `isPending`, `isFulfilled`, `isRejected`, `isSettled`, `isFirstPending`, `isEverPending`, `isEverSettled`.

```ts
import { reatomAsync, withStatusesAtom } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withStatusesAtom())

const initStatuses = ctx.get(fetchList.statusesAtom)

initStatuses.isPending // false
initStatuses.isFulfilled // false
initStatuses.isRejected // false
initStatuses.isSettled // false

initStatuses.isFirstPending // false
initStatuses.isEverPending // false
initStatuses.isEverSettled // false
```

> `!isEverPending` is like _init_ state, `isEverSettled` is like _loaded_ state, `isFirstPending` is perfect match for "stale while revalidate" pattern.

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

This is the most famous feature of any resource management. You are not required to use `withDataAtom`, the cache worked for effect results, but if `dataAtom` exists - it will worked as well and you could react on data changes immediately.

This operator adds `cacheAtom` property which is `MapAtom` from [@reatom/primitives](https://www.reatom.dev/package/primitives) and contains the cache of effect results. Do not change it manually! But you could use `reset` action for cache invalidation.

If the async action will called with the same params during existing fetching - the same promise will returned.

You could rule the cache behavior by set of optional parameters.

- **length** - maximum amount of cache records. Default is `5`.
- **staleTime** - the amount of milliseconds after which a cache record will cleanup. Default is `5 * 60 * 1000`ms which is 5 minutes.
- **paramsLength** - the number of excepted parameters, which will used as a cache key. Default is "all".
- **isEqual** - check the equality of a cache record and passed params to find the cache. Default is `isDeepEqual` from [@reatom/utils](https://www.reatom.dev/package/utils).
- **paramsToKey** - convert params to a string as a key of the cache map. Not used by default, equality check (`isEqual`) is used instead. This option is useful if you have a complex object as a params which equality check is too expensive, or you was set large `length` option and want to speed up the cache search.
  > You could import and use [toStringKey](https://www.reatom.dev/package/utils#tostringkey) function from the utils package for this purposes.
- **swr** - enable [stale while revalidate](https://web.dev/stale-while-revalidate/) pattern. Default is `true`. It allow to run fetch for the fresh data on the background and return the cached data immediately (if exist). Success SWR fetch will call `onFulfill` to force new data for `dataAtom`, you could change this behavior by `swr: { shouldFulfill: false }`, in this case the SWR logic is just a background silent synchronization to speedup a next fetch.
- **withPersist** - `WithPersist` instance from one of the adapter of [@reatom/persist](https://www.reatom.dev/package/persist). It will used with predefined optimal parameters for internal Map (de)serialization and so on.
- **ignoreAbort** - define if the effect should be prevented from abort. The outer abort strategy is not affected, which means that all hooks and returned promise will behave the same. But the effect execution could be continued even if abort appears, to save the result in the cache. Default is `true`.

```ts
import { reatomAsync, withDataAtom, withCache } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withDataAtom(), withCache())

// fetch data
await fetchList(ctx, { query: 'foo', page: 1 }) // call the effect
const firstResult = ctx.get(fetchList.dataAtom)

// fetch another data
await fetchList(ctx, { query: 'bar', page: 2 })

// request data with the equal parameters
fetchList(ctx, { page: 1, query: 'foo' })
// the cache comes to `onFulfill` and `dataAtom` as well synchronously
isEqual(firstResult, ctx.get(fetchList.dataAtom)) // true
```

### Invalidate cache

You could invalidate the cache by `reset` action on `cacheAtom`. It will clear the whole cache records of the async action.

```ts
import { reatomAsync, withCache, withDataAtom } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withCache(), withDataAtom())

export const updateList = reatomAction(() => {
  /*  */
}, 'updateList')
updateList.onFulfill.onCall(fetchList.cacheAtom.reset)
```

You could use `withRetry` to retry the effect after cache invalidation or use built-in action for that. `cacheAtom.invalidate` will clear the cache and call the effect immediately with the last params.

```ts
import { reatomAsync, withCache, withDataAtom } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withCache(), withDataAtom())

export const updateList = reatomAction(() => {
  /*  */
}, 'updateList')
updateList.onFulfill.onCall(fetchList.cacheAtom.invalidate)

export const listLoadingAtom = atom(
  (ctx) => ctx.spy(fetchList.pendingAtom) + ctx.spy(updateList.pendingAtom) > 0,
)
```

Use `listLoadingAtom` to show a loader in a UI during the whole process of data updating and invalidation.

### Sync cache

You could persist the cache for a chosen time and sync it across a tabs by `withLocalStorage` from [@reatom/persist-web-storage](https://www.reatom.dev/package/persist-web-storage). You could use `withSessionStorage` if you need only synchronization.

```ts
import { reatomAsync, withCache } from '@reatom/async'
import { withLocalStorage } from '@reatom/persist-web-storage'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withCache({ withPersist: withLocalStorage }))
```

`withCache` applies `withPersist` to `cacheAtom` with options for optimal serialization. You could redefine the options by an inline decorator function. It is recommended to set the key explicitly, by default the async action name used.

```ts
import { reatomAsync, withCache } from '@reatom/async'
import { withLocalStorage } from '@reatom/persist-web-storage'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(
  withCache({
    withPersist: (options) =>
      withLocalStorage({ ...options, key: 'LIST_CACHE' }),
  }),
)
```

If you want to use persisted cache as an init state of `dataAtom` - just put `withCache` **after** `withDataAtom`!

```ts
import { reatomAsync, withDataAtom, withCache } from '@reatom/async'
import { withLocalStorage } from '@reatom/persist-web-storage'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withDataAtom([]), withCache({ withPersist }))
```

## `withRetry`

Adds `retry` action and `paramsAtom` to store last params of the effect call.

```ts
import { reatomAsync, withCache, withDataAtom, withRetry } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withCache(), withDataAtom(), withRetry())

export const updateList = reatomAction(() => {
  /*  */
}, 'updateList')
updateList.onFulfill.onCall(fetchList.cacheAtom.reset)
updateList.onFulfill.onCall(retry)
```

If you will try to call `retry` before first effect call, it will throw an error. To avoid this you could specify `fallbackParams` option.

```ts
import { reatomAsync, withRetry } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx, page) => request(`api/list?page=${page}`, ctx.controller),
  'fetchList',
).pipe(withRetry({ fallbackParams: [1] }))

// will call fetch(`api/list?page=1`)
fetchList.retry(ctx)
```

### Retry request on failure

`withRetry` accept optional `onReject` parameter which is a hook which is called with context, payload error and retries count parameters. This hook could return a number which will be used as a timer for scheduling `retry` action. To skip the retry scheduling return nothing or negative number.

Return `0` to retry immediately. With this pattern your loader will not blink, as `pendingAtom` will switch from `0` to `1` before subscribers notification.

```ts
import { reatomAsync, withRetry } from '@reatom/async'

const fetchData = export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(
  withRetry({
    onReject(ctx, error, retries) {
      if (retries < 4) return 0
    },
  }),
)
```

### Retry request with exponential backoff

Progressive retry: `100 * Math.min(200, retries ** 3)`. Will retry after 100ms, 800ms, 2700ms, 6400ms, 1250ms, 20s, 20s and so on.

```ts
import { reatomAsync, withRetry } from '@reatom/async'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(
  withRetry({
    onReject: (ctx, error, retries) => 100 * Math.min(200, retries ** 3),
  }),
)
```

### Periodic refresh for used data

Lets use `onConnect` from [@reatom/hooks](https://www.reatom.dev/package/hooks) to control the data neediness.

```ts
import {
  reatomAsync,
  withDataAtom,
  withRetry,
  onConnect,
  sleep,
} from '@reatom/framework'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withDataAtom([]), withRetry())
onConnect(fetchList.dataAtom, async (ctx) => {
  while (ctx.isConnected()) {
    await fetchList.retry(ctx).catch(() => {})
    await sleep(5000)
  }
})
```

You could use `onConnect` automatic abort strategy to manage the neediness of the periodic refresh automatically!

```ts
import { reatomAsync, withAbort, withDataAtom, withRetry, sleep } from '@reatom/framework' /* prettier-ignore */

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withAbort(), withDataAtom([]), withRetry())
onConnect(fetchList.dataAtom, async (ctx) => {
  while (true) {
    await fetchList.retry(ctx).catch(() => {})
    await sleep(5000)
  }
})
```

Here we rely on the fact that `onConnect` will be called only when `fetchList.dataAtom` is connected (subscribed) to the consumer and will be aborted when `fetchList.dataAtom` is disconnected (unsubscribed).

## `withAbort`

This is the most powerful feature for advanced async flow management. Allow to configure concurrency strategy ("last in win" by default) for `ctx.controller.abort` call. This operator allows you to use the full power of Reatom architecture by relies on a context causes and give the ability to handle concurrent requests like with [AsyncLocalStorage](https://nodejs.org/api/async_context.html) / AsyncContext ([Ecma TC39 proposal slides](https://docs.google.com/presentation/d/1LLcZxYyuQ1DhBH1htvEFp95PkeYM5nLSrlQoOmWpYEI/edit#slide=id.p)) from a mature backend frameworks. Like redux-saga or rxjs it allows you to cancel concurrent requests of any depth, but unlike them, it does not require you to use generators, observables, or any additional abstraction! All needed information already stored in the context.

Currently, automatic aborting is supported only for features from @reatom/effects package. `onConnect`, `take`, `takeNested` automatically provides AbortController or subscribes to it.

`withAbort` operator adds `onAbort` action for handling abort from any cause, `abort` action for manual aborting, `abortControllerAtom` witch stores AbortController of the last effect call. Be noted that abort errors do not trigger `onReject` hook, but `onAbort` hook.

An example of a simple resource fabric with aborting request on a data usage disconnect.

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

Check the real-world example in pooling example from [story tests below](https://www.reatom.dev/package/async#story-test) ([src](https://github.com/artalar/reatom/blob/v3/packages/async/src/index.story.test.ts)).
