# Reatom Async Mastery

This reference is distilled from `docs/src/content/docs/handbook/async.md`, `async-context.md`, `sampling.md`, `suspense.md`, core async sources, and tests.

## Mental Model

Reatom async is frame-based. `action`, `computed`, and `effect` create frames; `wrap` re-enters the current frame after `await`; `abortVar` propagates `AbortController` through the frame tree; `withAbort` manages controller lifetimes; `withAsync` tracks pending/error/lifecycle; `withAsyncData` adds `.data` and automatic abort for query-like state.

Write flows as normal `async` / `await` code and make every async boundary explicit with `wrap`.

## Choosing the Primitive

- Idempotent read/query data: `computed(async () => ...).extend(withAsyncData({ initState }))`.
- Mutation/command/submission: `action(async () => ...).extend(withAsync())`.
- Cross-use is valid but less typical: `computed` + `withAsync` when you only need pending/error without `.data()`; `action` + `withAsyncData` when the result must live in `.data()` — for example a command that keeps its last payload, or a query you run manually instead of reactively.
- Race-prone command: add `withAbort()` or a strategy-specific variant.
- Route/page data: route loader or scoped async computed.
- Long-running scoped side effect: `effect(async () => ...)` created from a route/init/mount scope, not module scope.
- Global one-shot init: `withSuspenseInit()` / `withSuspense()` only when the app can rely on Suspense boundaries.

## withAsyncData

Use for data that should be stored and read through `.data()`.

```ts
import {
  abortVar,
  atom,
  computed,
  sleep,
  withAsyncData,
  wrap,
} from '@reatom/core'

type SearchResult = { title: string }

declare const api: {
  search(
    query: string,
    options: { signal: AbortSignal },
  ): Promise<Array<SearchResult>>
}

const searchQuery = atom('', 'search.query')

export const searchResults = computed(async () => {
  const query = searchQuery().trim()
  if (!query) return []

  await wrap(sleep(300))

  return await wrap(api.search(query, { signal: abortVar.require().signal }))
}, 'search.results').extend(withAsyncData({ initState: [] }))
```

Surface:

- `.data()` stores the last successful mapped payload.
- `.ready()` is `pending() === 0`.
- `.pending()` counts active tracked promises.
- `.error()` stores parsed non-abort errors.
- `.reset()` resets dependencies and data, but does not auto-refetch.
- `.data.reset()` resets data only.
- `.retry()` works for computed targets without `cacheParams`.
- `.status()` exists only when `{ status: true }` is enabled.

Options:

- `initState`: initial `.data()` value.
- `mapPayload(payload, params, state)`: transform success payload before writing data.
- `parseError`, `emptyError`, `resetError`, `status`, `cacheParams`: inherited from `withAsync`.

Facts from source/tests:

- `withAsyncData` includes `withAbort()` and `withAsync(...)`.
- Last successful non-aborted call wins under concurrency.
- Persisted `.data` may show stale persisted data until the async frame fulfills.
- Reading `.pending()` in hot timing-sensitive tests can affect scheduling.
- Search debounce belongs inside the async computed/action with `await wrap(sleep(ms))`; keep one readable flow instead of splitting value extraction, debounce storage, and fetch logic across helpers.

## withAsync

Use for commands and mutations where result data does not need a persistent `.data` atom.

```ts
import { abortVar, action, withAbort, withAsync, wrap } from '@reatom/core'

type TodoDraft = { title: string }

declare const api: {
  saveTodo(draft: TodoDraft, options: { signal: AbortSignal }): Promise<void>
}

export const saveTodo = action(async (draft: TodoDraft) => {
  await wrap(api.saveTodo(draft, { signal: abortVar.require().signal }))
}, 'todos.save').extend(withAsync({ status: true }), withAbort())
```

Surface:

- `.ready()`, `.pending()`, `.error()`.
- `.onFulfill`, `.onReject`, `.onSettle` actions for hooks/logging.
- `.status()` only with `{ status: true }`.
- `.params()` and action `.retry()` only with `{ cacheParams: true }`.
- Computed `.retry()` works without parameter caching.

Abort handling:

- Abort errors call `.onSettle`.
- Abort errors do not call `.onReject`.
- Abort errors do not write `.error()` or set `status.isRejected`.

## wrap Rules

Use `await wrap(promise)` whenever async work leaves a Reatom frame and the continuation reads or writes Reatom state.

```ts
const response = await wrap(fetch('/api/user'))
const user = await wrap(response.json())
userAtom.set(user)
```

Use `wrap(fn)` when passing a callback to an external scheduler or event source:

```ts
button.addEventListener(
  'click',
  wrap(() => submit()),
)
```

Do not `await fetch(...)` and then call atoms/actions.

Do not chain after `wrap`: `await wrap(fetch(url)).then(...)`; wrap each awaited step or the whole chain.

Do not call `wrap(() => atom.set(...))` as a bare statement. `wrap(fn)` returns a function.

Do not wrap synchronous Reatom writes inside an existing action/effect/computed frame.

Do not put `wrap` inside Reatom hooks like `withCallHook`; hooks already run in frame.

## withAbort

`withAbort` attaches `.abort(reason?)` and manages abort controllers.

- `withAbort()` / `withAbort('last-in-win')`: abort previous active calls when a new call starts. Best for search, autocomplete, and dependency-driven resources.
- `withAbort('first-in-win')`: ignore/abort new calls while the first is running. Best for throttle-like flows.
- `withAbort('manual')`: allow concurrent calls until `.abort()` cancels active controllers. Best for polling and user-controlled background tasks.
- `withAbort('finally')`: abort child operations when the parent action finishes. Best for `race`, forks, and fire-and-forget cleanup.

Computeds extended with `withAbort()` abort stale recomputations when dependencies actually trigger a recompute.

## abortVar and Fetch Signals

Use `abortVar.require()` when the current frame definitely has an abort controller:

- `action` / `computed` extended with `withAbort` (including `withAsyncData`, which includes `withAbort`)
- `withConnectHook` callback body
- `effect` async body
- `reatomFactoryComponent` render frame
- Form validation callbacks
- Route loader async computed

```ts
import { abortVar, wrap } from '@reatom/core'

const response = await wrap(
  fetch('/api/items', {
    signal: abortVar.require().signal,
  }),
)
```

Use `abortVar.subscribe()` with the `using` statement when you need an explicit subscription scope and cleanup:

```ts
import { abortVar, wrap } from '@reatom/core'

using subscription = abortVar.subscribe()
const response = await wrap(
  fetch('/api/items', {
    signal: subscription.controller.signal,
  }),
)
```

Use `abortVar.spawn(fn, ...params)` to run detached work that must outlive the current frame's abort. The spawned frame becomes an abort boundary, so a parent abort (disconnect, `withAbort`, navigation) no longer propagates into it — ideal for fire-and-forget effects or for keeping an in-flight request alive after its subscriber leaves:

```ts
import { abortVar, atom, withConnectHook, wrap } from '@reatom/core'

const profile = atom<Profile | null>(null, 'profile').extend(
  withConnectHook(() => {
    abortVar.spawn(async () => {
      profile.set(await wrap(api.getProfile()))
    })
  }),
)
```

For the opposite need — a fork with its own controller that `race` can abort or that you can `.controller.abort(reason)` — use `abortVar.createAndRun(fn, ...params)`, which returns a `ControlledPromise` carrying `.controller` (see `race`).

## Sampling and Procedural Async

Sampling means awaiting future state/action/external events inside an async frame. This is the preferred code-quality pattern for multi-step UI flows: keep the narrative in one named action/computed, preserve Reatom context, and let the logger show `take`, `onEvent`, abort, and settle points instead of hiding behavior in detached callbacks.

### Debounce

Use the sampling docs debounce practice: put the delay in the async flow, wrap the delay, and use abort strategy to cancel stale work. This keeps value extraction, timing, fetch, cancellation, and debug traces in one place.

```ts
import { abortVar, action, sleep, withAbort, wrap } from '@reatom/core'

const search = action(async (query: string) => {
  await wrap(sleep(300))
  await wrap(api.search(query, { signal: abortVar.require().signal }))
}, 'search').extend(withAbort())
```

### Throttle

```ts
import { action, sleep, withAbort, wrap } from '@reatom/core'

const resize = action(async () => {
  updateLayout()
  await wrap(sleep(100))
}, 'layout.resize').extend(withAbort('first-in-win'))
```

### take

`take(target, mapOrName?, name?)` awaits the next atom update or action call. Use `await wrap(take(...))` inside async actions/effects. The optional second argument is a selector that maps the value and may `throwAbort()` to keep waiting until it passes; pass a string instead to only name the wait.

Prefer `take` when the flow depends on future reactive state or an action event. It avoids ad hoc subscriptions, boolean flags, and callback nesting, and it creates named trace entries such as `flow.take#1` / `flow.take.validation` with start, resolve, reject, and abort logs. Pass a name when the wait is important for debugging.

```ts
import { take, throwAbort, wrap } from '@reatom/core'

await wrap(take(form.valid, (valid) => valid || throwAbort(), 'validation'))
```

For debounce-like validation flows, keep the wait and delay together:

```ts
await wrap(sleep(300))
await wrap(
  take(form.valid, (valid) => valid || throwAbort(), 'validAfterDebounce'),
)
```

### onEvent

`onEvent` integrates any `EventTarget` (DOM nodes, `WebSocket`, `EventSource`, media elements, native `<dialog>`) with the current Reatom frame and abort scope. The event `type` is inferred and the payload is typed from the target. Two forms:

- `onEvent(target, type)` returns a promise for the next event. `await wrap(...)` it to await one occurrence.
- `onEvent(target, type, cb, options?)` subscribes on every occurrence and returns an unsubscribe function. `options` accepts `once`, `capture`, `passive`, and an external `signal`.

Either form wraps the listener in a named action like `_onEvent.HTMLDialogElement.close`, so external events appear in logs/devtools inside the same async story. Cleanup is tied to the current abort scope: listeners drop when the action aborts, a `withAbort` supersedes the call, an `effect` re-runs, or a component unmounts — no manual `removeEventListener`.

Await one event (promise form):

```ts
import { onEvent, wrap } from '@reatom/core'

dialog.showModal()
const closeEvent = await wrap(onEvent(dialog, 'close'))
```

Checkpoint pattern: start the listener before long work so an event firing mid-flight is not missed. Better than starting work first and hoping the event has not already fired.

```ts
import { action, onEvent, withAbort, wrap } from '@reatom/core'

export const processPayment = action(async (orderId: string) => {
  const webhook = onEvent(paymentEvents, 'payment.completed')
  await wrap(api.charge(orderId))
  return await wrap(webhook)
}, 'payments.process').extend(withAbort())
```

Subscribe to a stream (callback form): listeners registered inside a `withConnectHook` body live and die with the atom's connection, and one `controller.abort()` tears the whole group down.

```ts
import { abortVar, atom, onEvent, withConnectHook, wrap } from '@reatom/core'

const ticker = atom<Tick | null>(null, 'ticker').extend(
  withConnectHook(async (target) => {
    const { controller } = abortVar.subscribe()

    if (socket.readyState !== WebSocket.OPEN) {
      await wrap(onEvent(socket, 'open'))
    }

    onEvent(socket, 'message', (event) => target.set(parse(event.data)))
    onEvent(socket, 'close', () => controller.abort())
    onEvent(socket, 'error', () => controller.abort())
  }),
)
```

### race

Use `race` with controlled promises, not raw `Promise.race`, when losers must stop.

```ts
import { abortVar, race, wrap } from '@reatom/core'

const cached = abortVar.createAndRun(readCache)
const remote = abortVar.createAndRun(fetchRemote)
const result = await wrap(race(cached, remote))
```

### framePromise

`framePromise()` resolves with the current frame's outcome (action payload or atom state). Attach `.catch` / `.finally` at the top of a long action, then write the happy path flat.

```ts
import { action, framePromise, wrap } from '@reatom/core'

export const processOrder = action(async (orderId: string) => {
  framePromise().catch((error) => showErrorNotification(error))

  const order = await wrap(api.fetchOrder(orderId))
  await wrap(api.chargeCustomer(order))
  return order
}, 'orders.process')
```

Prefer it over try-catch (which nests the happy path) and native `using` (which cannot read the frame's payload/error). It binds to the running frame, not the lexical scope, so a shared helper like `withErrorLogging()` can attach `.catch` / `.finally` to its caller's outcome — impossible with `using`.

## Redux-Saga Mapping

For teams migrating from `redux-saga`. Saga interprets generator-yielded effect objects through a middleware; Reatom runs native `async`/`await` inside `action` / `computed` / `effect` frames. Effects become ordinary calls plus the sampling primitives above — no `yield`, no effect descriptors, and breakpoints / stack traces stay intact.

| redux-saga                    | Reatom v1001                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `yield take(pattern)`         | `await wrap(take(target, selector?))`                                                           |
| `yield takeMaybe(pattern)`    | `const ev = take(target)` first, `await wrap(ev)` later (checkpoint, no block at the call site) |
| `yield delay(ms)`             | `await wrap(sleep(ms))`                                                                         |
| `yield select(selector)`      | read the atom directly: `someAtom()`                                                            |
| `yield put(action)`           | call the action directly: `someAction(payload)`                                                 |
| `yield call(fn, ...args)`     | `await wrap(fn(...args))`                                                                       |
| `yield fork(fn, ...args)`     | `const task = abortVar.createAndRun(fn, ...args)`                                               |
| `yield spawn(fn, ...args)`    | `abortVar.spawn(fn, ...args)`                                                                   |
| `yield join(task)`            | `await wrap(task)`                                                                              |
| `yield cancel(task)`          | `task.controller.abort(reason?)`                                                                |
| `yield cancelled()`           | `abortVar.require().signal.aborted`                                                             |
| `yield all([...])`            | `await wrap(Promise.all([...]))`                                                                |
| `yield race({ ... })`         | `race(...controlledPromises)`                                                                   |
| `takeEvery(pattern, saga)`    | subscribe + run an `action`: `withChangeHook` (atom) / `withCallHook` (action)                  |
| `takeLatest(pattern, saga)`   | same subscription, handler is `action(...).extend(withAbort())` (`'last-in-win'`)               |
| `takeLeading(pattern, saga)`  | same subscription, handler is `action(...).extend(withAbort('first-in-win'))`                   |
| `throttle(ms, pattern, saga)` | `action(async () => { ...; await wrap(sleep(ms)) }).extend(withAbort('first-in-win'))`          |
| `debounce(ms, pattern, saga)` | `action(async () => { await wrap(sleep(ms)); ... }).extend(withAbort())`                        |

Non-obvious cases:

- `fork` vs `spawn`: `abortVar.createAndRun` shares the current abort scope (a parent `withAbort('finally')`, navigation, or disconnect cancels it) and returns a `ControlledPromise` with `.controller` for join/cancel; `abortVar.spawn` is a detached abort boundary that outlives the parent abort.
- `cancel` / self-cancel: abort another task via `task.controller.abort()`; stop the running flow from inside with `throwAbort()`; supersede an action by calling it again under `withAbort()`.
- `cancelled` / cleanup: read `abortVar.require().signal.aborted`, or register teardown with `abortVar.subscribe()` / `framePromise().finally()`.

The legacy comparison still floating around old docs maps to removed APIs — `reatomAsync`, `withConcurrency` / `withAbort({ strategy })`, `onCtxAbort`, `getTopController(ctx.cause)`. Use the v1001 equivalents above; see `Common Mistakes` for the full legacy list.

## Status, Retry, Reset

Enable `status` only when UI needs detailed lifecycle flags:

- `isPending`, `isFulfilled`, `isRejected`, `isSettled`.
- `isFirstPending`, `isEverPending`, `isEverSettled`.
- `isSWR` when cache stale-while-revalidate is active.
- `data` mirrors `.data()` for `withAsyncData`.
- `error` mirrors the current non-abort error.

`status.reset()` clears lifecycle history. If reset happens during a pending operation, late settlement must not restore old history.

Retry rules:

- Computed retry resets dependencies and re-evaluates.
- Action retry requires `withAsync({ cacheParams: true })`.
- Action retry before any cached call throws "Nothing to retry, params is empty".

Reset rules:

- `withAsyncData.reset()` resets dependencies and `.data()`, but does not refetch.
- Call `.retry()` or read/subscribe the computed again to fetch after reset.

## Cache Order

`withAsync()` / `withAsyncData()` must come before `withCache()`.

Wrong order throws at runtime:

```ts
import { computed, withAsyncData, withCache } from '@reatom/core'

computed(async () => api.list(), 'list').extend(withCache(), withAsyncData())
```

Use:

```ts
import { computed, withAsyncData, withCache } from '@reatom/core'

computed(async () => api.list(), 'list').extend(withAsyncData(), withCache())
```

## Suspense Boundaries

Use Suspense for global initialization where loading once at app start is acceptable.

- `withSuspense()` adds `.suspended` to async computeds.
- `suspense(atom)` reads a suspended value and throws pending promises/errors.
- `withSuspenseInit()` turns async atom initialization into a synchronous atom after it resolves.
- `withSuspenseRetry()` retries an action when it touches suspended atoms.

Avoid Suspense for dynamic page data, fine-grained loading UI, or mutable query flows; use `withAsyncData`.

Do not put non-idempotent side effects before suspended reads inside `withSuspenseRetry()` actions; retries can re-run the action body.

## Common Mistakes

- Query implemented as `effect` or component mount fetch instead of async computed.
- Missing `wrap` before Reatom reads/writes after `await`.
- `withAsync` expected to abort without `withAbort`.
- Abort displayed as a user-facing error.
- `.status()` accessed without `{ status: true }`.
- Action `.retry()` used without `{ cacheParams: true }`.
- `Promise.race` used where loser cleanup matters.
- `setTimeout`, debounce libraries, or stored timer handles used instead of sampling-doc practice: `await wrap(sleep(ms))` plus `withAbort`.
- Module-level polling `effect` that never disconnects.
- Suspense used for route/page data.
- Legacy APIs: `reatomAsync`, `reatomResource`, `withConcurrency`, `onCtxAbort`, `ctx.schedule`.

## Tested Edge Cases

- `withAsync`: abort rejection settles but does not call `onReject`; real rejection still does.
- `withAsync`: sync throw before await follows the normal error path.
- `withAsync`: action retry throws without `cacheParams`; computed retry does not need it.
- `withAsyncData`: only the last non-aborted fulfillment updates `.data` and `onFulfill`.
- `withAsyncData`: `.reset()` does not refetch until the resource is read/subscribed/retried.
- `withAsyncStatus`: parallel calls make the second pending state not `isFirstPending`.
- `withAsyncStatus`: abort restores prior fulfilled/rejected state when one exists.
- `withAbort('first-in-win')`: manual `.abort()` allows the next call to run.
- `withAbort('manual')`: `.abort()` cancels all active calls.
- `withAbort('finally')`: aborts child/forked operations after parent completion.
- `wrap`: context reset rejects wrapped promises with an abort error.
- `effect`: async effects abort previous bodies on dependency change.
- `take`: selectors can resolve synchronously when the filter passes immediately.
- `withSuspenseRetry`: abort while suspended propagates through async data.

## Source Anchors

- Docs: `docs/src/content/docs/handbook/async.md`, `async-context.md`, `sampling.md`, `suspense.md`.
- Sources: `packages/core/src/async/*`, `extensions/withAbort.ts`, `extensions/withSuspense.ts`, `methods/wrap.ts`, `methods/abortVar.ts`, `methods/variable.ts`, `methods/take.ts`, `methods/framePromise.ts`, `web/onEvent.ts`.
- Tests: `withAsync.test.ts`, `withAsyncData.test.ts`, `withAsyncStatus.test.ts`, `withAbort.test.ts`, `wrap.test.ts`, `take.test.ts`, `framePromise.test.ts`, `effect.test.ts`, `withSuspense.test.ts`, `withSuspenseRetry.test.ts`.
