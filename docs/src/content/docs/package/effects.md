---
title: effects
description: Reatom for effects
---

This package is inspired by [Sagas](https://redux-saga.js.org) and gives you advanced effect management solutions.

> included in [@reatom/framework](/package/framework)

First of all you should know that many effects and async ([reatom/async](/package/async) + [reatom/hooks](/package/hooks)) logic uses [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) under the hood and if some of the controller aborted all nested effects will aborted too! It is a powerful feature for managing async logic which allows you to easily write concurrent logic, like with redux-saga or rxjs, but with the simpler API.

Before we start, you could find a lot of useful helpers to manage aborts in [reatom/utils](/package/utils/)

## The differences between Redux-Saga and Reatom.

- [Sagas `take`](https://redux-saga.js.org/docs/api/#takepattern) is like [`take`](/packages/effects#take) + `await`.
- [Sagas `takeMaybe`](https://redux-saga.js.org/docs/api/#takemaybepattern) - is like [`take`](/packages/effects#take) WITHOUT `await`.
- [Sagas `takeEvery`](https://redux-saga.js.org/docs/api/#takemaybepattern) - is like `anAtom.onChange` / `anAction.onCall`.
- [Sagas `takeLatest`](https://redux-saga.js.org/docs/api/#takelatestpattern-saga-args) - is like `anAtom.onChange` / `anAction.onCall` + `reatomAsync().pipe(withAbort({ strategy: 'last-in-win' }))`.
- [Sagas `takeLeading`](https://redux-saga.js.org/docs/api/#takeleadingpattern-saga-args) - is like `anAtom.onChange` + `reatomAsync().pipe(withAbort({ strategy: 'first-in-win' }))`.
- [Sagas `call`](https://redux-saga.js.org/docs/api/#callfn-args) is a regular function call with a context + `await`.
- [Sagas `fork`](https://redux-saga.js.org/docs/api/#forkfn-args) is a regular function call with a context WITHOUT `await`.
- [Sagas `spawn`](https://redux-saga.js.org/docs/api/#spawnfn-args) have no analogy in Reatom. It should create a context without parent context abort propagation. Work in progress.
- [Sagas `join`](https://redux-saga.js.org/docs/api/#jointask) - is just `await` in Reatom.
- [Sagas `cancel`](https://redux-saga.js.org/docs/api/#canceltask) have no analogy in Reatom. It probably should looks like `getTopController(ctx).abort()`.
- [Sagas `cancelled`](https://redux-saga.js.org/docs/api/#cancelled) - is like `onCtxAbort`.

Two important notes.

1. Abortable context in Reatom currently works (starts) only by `reatomAsync` and `onConnect`. We will add a new general primitive for that in this package in the nearest time.
2. A sagas reacts to a [deep] child's failure, which Reatom doesn't do. Built-in _transaction_ primitive in a plan.

<!-- The picture of a complex logic management could be represented like this:

![image](https://github.com/artalar/reatom/assets/27290320/07caee50-e112-4bcb-b7cb-4387fa0cecdf) -->

## API

### take

Allow you to wait an atom update.

```ts
import { take } from '@reatom/effects'

const currentCount = ctx.get(countAtom)
const nextCount = await take(ctx, countAtom)
```

You could await actions too!

```ts
// ~/features/someForm.ts
import { take } from '@reatom/effects'
import { onConnect } from '@reatom/hooks'
import { historyAtom } from '@reatom/npm-history'
import { confirmModalAtom } from '~/features/modal'

// some model logic, doesn't matter
export const formAtom = reatomForm(/* ... */)

onConnect(form, (ctx) => {
  // "history" docs: https://github.com/remix-run/history/blob/main/docs/blocking-transitions.md
  const unblock = historyAtom.block(ctx, async ({ retry }) => {
    if (!ctx.get(formAtom).isSubmitted && !ctx.get(confirmModalAtom).opened) {
      confirmModalAtom.open(ctx, 'Are you sure want to leave?')

      const confirmed = await take(ctx, confirmModalAtom.close)

      if (confirmed) {
        unblock()
        retry()
      }
    }
  })
})
```

### takeNested

Allow you to wait all dependent effects, event if they was called in the nested async effect.

For example, we have a routing logic for [SSR](https://github.com/artalar/reatom-nextjs).

```ts
// ~/features/some.ts
import { historyAtom } from '@reatom/npm-history'

historyAtom.locationAtom.onChange((ctx, location) => {
  if (location.pathname === '/some') {
    fetchSomeData(ctx, location.search)
  }
})
```

How to track `fetchSomeData` call? We could use `takeNested` for this.

```ts
// SSR prerender
await takeNested(ctx, (trackedCtx) => {
  historyAtom.push(trackedCtx, req.url)
})
render()
```

You could pass an arguments in the rest params of `takeNested` function to pass it to the effect.

```ts
await takeNested(ctx, historyAtom.push, req.url)
render()
```

### onCtxAbort

Handle an abort signal from a cause stack. For example, if you want to separate a task from the body of the concurrent handler, you can do it without explicit abort management; all tasks are carried out on top of `ctx`.

```ts
import { action } from '@reatom/core'
import { reatomAsync, withAbort } from '@reatom/async'
import { onCtxAbort } from '@reatom/effects'

const doLongImportantAsyncWork = action((ctx) =>
  ctx.schedule(() => {
    const timeoutId = setTimeout(() => {
      /* ... */
    })
    onCtxAbort(ctx, () => clearTimeout(timeoutId))
  }),
)

export const handleImportantWork = reatomAsync((ctx) => {
  /* ... */
  doLongImportantAsyncWork(ctx)
  /* ... */
}).pipe(withAbort())
```
