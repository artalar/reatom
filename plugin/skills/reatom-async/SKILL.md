---
name: reatom-async
description: Masters Reatom v1001 async flows. Use when implementing, documenting, or reviewing Reatom async queries, mutations, wrap usage, withAsync, withAsyncData, withAbort, abortVar, sampling, take, onEvent, race, framePromise, Suspense, retry, caching, or race-prone UI workflows.
---

# Reatom Async

Use this skill when the task is mainly about Reatom async behavior. Treat [REFERENCE.md](REFERENCE.md) as the bundled async source of truth.

## How to Use

1. Read only the [REFERENCE.md](REFERENCE.md) sections that match the task.
2. Prefer Reatom async patterns over debounce libraries, mount-time fetches, refs, local component promise state, or manual AbortController bookkeeping.
3. For general Reatom modeling, use the `reatom` skill. For `@reatom/jsx` DOM JSX specifics, use `reatom-jsx`. For reviews, combine this skill with `reatom-review`.
4. If docs, source, and tests disagree, prefer source and tests, then fix the doc/example that is stale.

## Section Map

- Queries and mutations: `Choosing the Primitive`, `withAsyncData`, `withAsync`
- Context after `await`: `wrap Rules`
- Cancellation: `withAbort`, `abortVar and Fetch Signals`
- Debounce, throttle, waits, races: `Sampling and Procedural Async`
- Redux-saga migration: `Redux-Saga Mapping`
- Loading UI and retry: `Status, Retry, Reset`
- Suspense: `Suspense Boundaries`
- Code review: `Common Mistakes`, `Tested Edge Cases`

## Implementation Defaults

- Query/read data: `computed(async () => ...).extend(withAsyncData({ initState }))`.
- Command/mutation: `action(async () => ...).extend(withAsync(...))`; add `withAbort(...)` when stale calls must stop.
- Every async boundary that leaves a Reatom frame uses `await wrap(promise)`.
- External callbacks that call Reatom state/actions are passed as `wrap(fn)` or wired with `onEvent`.
- Abortable fetches use `signal: abortVar.require().signal` or a scoped `abortVar.subscribe()`.
- Debounce and throttle follow the sampling docs: `await wrap(sleep(ms))` inside the flow plus `withAbort()` strategies, not split debounce helpers.
- Route/page data belongs in route loaders or async computeds, not component effects.
- Form submit is an async mutation: put it in `reatomForm({ onSubmit })` and use field `validate` for async/dependent checks (debounce with `await wrap(sleep(ms))`), instead of hand-rolled submit actions or debounced validators.
- Suspense is for global one-shot initialization, not dynamic page data.

## Review Defaults

- Flag unwrapped awaits before atom/action calls.
- Flag `withAsync` used for query data where `withAsyncData` should own `.data`.
- Flag `withAsync` without `withAbort` when stale command calls can update state.
- Flag `.status()` without `{ status: true }`.
- Flag action `.retry()` without `{ cacheParams: true }`.
- Flag `withCache()` before `withAsync()` / `withAsyncData()`.
- Flag aborts displayed as business errors.
- Flag raw `Promise.race` when loser cleanup is needed.
