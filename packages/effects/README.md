This package is inspired by [Sagas](https://redux-saga.js.org) and gives you advanced effect management solutions.

> included in [@reatom/framework](https://www.reatom.dev/package/framework)

First of all you should know that some effects and async ([reatom/async](https://www.reatom.dev/package/async) + [reatom/hooks](https://www.reatom.dev/package/hooks)) logic uses [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) under the hood and if some of the controller aborted all nested effects will aborted too! It is a powerful feature for managing async logic which allows you to easily write concurrent logic, like with redux-saga or rxjs, but with the simpler native API.

Before we start, you could find a lot of useful helpers to manage aborts in [reatom/utils](https://www.reatom.dev/package/utils/)

## The differences between Redux-Saga and Reatom.

- [Sagas `take`](https://redux-saga.js.org/docs/api/#takepattern) is like [`take`](#take) + `await`.
- [Sagas `takeMaybe`](https://redux-saga.js.org/docs/api/#takemaybepattern) - is like [`take`](#take) WITHOUT `await`.
- [Sagas `takeEvery`](https://redux-saga.js.org/docs/api/#takemaybepattern) - is like `anAtom.onChange` / `anAction.onCall`.
- [Sagas `takeLatest`](https://redux-saga.js.org/docs/api/#takelatestpattern-saga-args) - is like `anAtom.onChange` / `anAction.onCall` + [`concurrent`](#concurrent).
- [Sagas `takeLeading`](https://redux-saga.js.org/docs/api/#takeleadingpattern-saga-args) - is like `anAtom.onChange` + `reatomAsync().pipe(withAbort({ strategy: 'first-in-win' }))`.
- [Sagas `call`](https://redux-saga.js.org/docs/api/#callfn-args) is a regular function call with a context + `await`.
- [Sagas `fork`](https://redux-saga.js.org/docs/api/#forkfn-args) is a regular function call with a context WITHOUT `await`.
- [Sagas `spawn`](https://redux-saga.js.org/docs/api/#spawnfn-args) is [`spawn`](#spawn)
- [Sagas `join`](https://redux-saga.js.org/docs/api/#jointask) - is just `await` in Reatom.
- [Sagas `cancel`](https://redux-saga.js.org/docs/api/#canceltask) is like `getTopController(ctx.cause)?.abort()`.
- [Sagas `cancelled`](https://redux-saga.js.org/docs/api/#cancelled) - is like [`onCtxAbort`](#onctxabort).

<!-- The picture of a complex logic management could be represented like this:

![image](https://github.com/artalar/reatom/assets/27290320/07caee50-e112-4bcb-b7cb-4387fa0cecdf) -->

## API

### concurrent

This is the basic, useful API for performing concurrent async logic. Wrap your function with the `concurrent` decorator, and all scheduled tasks of the passed `ctx` will throw the abort error when a new request appears.

Main use case for the concurrent API is `onChange` handling. Just wrap your function to always get only fresh results, no matter how often the changes occur.

Here, when `someAtom` changes for the first time, the hook will be called and start fetching. If `someAtom` changes during the fetch execution, the `ctx.schedule` of the previous (first) call will throw an `AbortError`, and the new fetching will start.

```ts
import { concurrent } from '@reatom/effects'

someAtom.onChange(
  concurrent(async (ctx, some) => {
    const other = await ctx.schedule(() => api.getOther(some))
    otherAtom(ctx, other)
  }),
)
```

Another example is how easily you could implement the "debounce" pattern with additional logic. Here is a comparison of the classic "debounce" decorator from "lodash" or any other utility library with the concurrent API. Each of the three examples has the same behavior for the debounce and concurrent examples.

You can see that each new logic addition forces a lot of changes for code with the simple debounce decorator and takes a really small amount of changes for code with the concurrent decorator.

Base debounce.

```ts
const onChangeDebounce = debounce((ctx, event) => {
  inputAtom(ctx, event.currentTarget.value)
}, 500)

const onChangeConcurrent = concurrent(async (ctx, event) => {
  await ctx.schedule(() => sleep(500))
  inputAtom(ctx, event.currentTarget.value)
})
```

Debounce after some mappings

```ts
const _onChangeDebounce = debounce((ctx, value) => {
  inputAtom(ctx, value)
}, 500)
const onChangeDebounce = (ctx, event) => {
  _onChangeDebounce(ctx, event.currentTarget.value)
}

const onChangeConcurrent = concurrent(async (ctx, event) => {
  const { value } = event.currentTarget
  await ctx.schedule(() => sleep(500))
  inputAtom(ctx, value)
})
```

Debounce with a condition.

```ts
const _onChange = (ctx, value) => {
  inputAtom(ctx, value)
}
const _onChangeDebounce = debounce(_onChange, 500)
const onChangeDebounce = (ctx, event) => {
  const { value } = event.currentTarget
  if (Math.random() > 0.5) _onChange(ctx, value)
  else handleDebounceChange(ctx, value)
}

const onChangeConcurrent = concurrent(async (ctx, event) => {
  const { value } = event.currentTarget
  if (Math.random() > 0.5) await ctx.schedule(() => sleep(500))
  inputAtom(ctx, value)
})
```

### take

This is the simplest and most powerful API that allows you to wait for an atom update, which is useful for describing certain procedures. It is a shortcut for subscribing to the atom and unsubscribing after the first update. `take` respects the main Reatom abort context and will throw `AbortError` when the abort occurs. This allows you to describe redux-saga-like procedural logic in synchronous code style with native async/await.

```ts
import { action } from '@reatom/core'
import { take } from '@reatom/effects'

export const validateBeforeSubmit = action(async (ctx) => {
  let errors = validate(ctx.get(formDataAtom))

  while (Object.keys(errors).length) {
    formDataAtom.errorsAtom(ctx, errors)
    // wait any field change
    await take(ctx, formDataAtom)
    // recheck validation
    errors = validate(ctx.get(formDataAtom))
  }
})
```

You can also await actions!

```ts
import { take } from '@reatom/effects'
import { onConnect } from '@reatom/hooks'
import { historyAtom } from '@reatom/npm-history'
import { confirmModalAtom } from '~/features/modal'

// some model logic, doesn't matter
export const formAtom = reatomForm(/* ... */)

onConnect(formAtom, (ctx) => {
  // "history" docs: https://github.com/remix-run/history/blob/main/docs/blocking-transitions.md
  const unblock = historyAtom.block(ctx, async ({ retry }) => {
    if (!ctx.get(formAtom).isSubmitted && !ctx.get(confirmModalAtom).opened) {
      confirmModalAtom.open(ctx, 'Are you sure you want to leave?')

      const confirmed = await take(ctx, confirmModalAtom.close)

      if (confirmed) {
        unblock()
        retry()
      }
    }
  })
})
```

#### take checkpoints
But be aware that `take` only starts listening when it's called:

```ts
import { take } from "@reatom/effects"
import { reatomAsync } from "@reatom/async"
import { confirmModalAtom } from '~/features/modal'
import { api } from '~/api'

const closeDocument = reatomAsync(async (ctx)=>{
    confirmModalAtom.open(ctx, 'Are you sure you want to leave?')
    
    const presaveId = await api.presaveDocument()
    
    // ❌ Bug: 
    // If person's connection is not fast enough or they are too fast 
    // they can close the modal before we get presaveId and start to listening to modal.close.
    // So now we are stuck in loading state forever...
    await take(ctx, confirmModalAtom.close)
    
    await api.finalizeDocument(presaveId)
})
```

You can fix this bug by creating a checkpoint before starting any process:
```ts
const closeDocument = reatomAsync(async (ctx) => {
    confirmModalAtom.open(ctx, 'Are you sure you want to leave?')
    // ✅ Now we listen for changes before we start any process...
    const modalConfirmedCheckpoint = take(ctx, confirmModalAtom.close)

    const presaveId = await api.presaveDocument()

    // ...and we will catch them for sure
    await modalConfirmedCheckpoint

    await api.finalizeDocument(presaveId)
})
```

#### take filter

You can pass the third argument to map the update to the required format.

```ts
const input = await take(ctx, onChange, (ctx, event) => event.target.value)
```

More than that, you can filter unneeded updates by returning the `skip` mark from the first argument of your callback.

```ts
const input = await take(ctx, onChange, (ctx, event, skip) => {
  const { value } = event.target
  return value.length < 6 ? skip : value
})
```

The cool feature of this skip mark is that it helps TypeScript understand the correct type of the returned value, which is hard to achieve with the extra "filter" function. If you have a union type, you could receive the needed data with the correct type easily. It just works.

```ts
const someRequest = reatomRequest<{ data: Data } | { error: string }>()
```

```ts
// type-safe destructuring
const { data } = await take(ctx, someRequest, (ctx, payload, skip) =>
  'error' in payload ? skip : payload,
)
```

### takeNested

Allow you to wait all dependent effects, event if they was called in the nested async effect or by [spawn](#spawn).

For example, we have a routing logic for [SSR](https://github.com/artalar/reatom/tree/v3/examples/nextjs).

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

Handle an abort signal from the cause stack. For example, if you want to separate a task from the body of the concurrent handler, you can do it without explicit abort management; all tasks are carried out on top of `ctx`.

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

### getTopController

This is a simple util to find an abort controller on top of your cause stack. For example, it is useful to stop some async operation inside a regular actions, which are probably called from a concurrent context.

```ts
import { action } from '@reatom/core'
import { getTopController } from '@reatom/effects'
import { throwAbort } from '@reatom/utils'
import { onConnect } from '@reatom/hooks'

const doSome = action(async (ctx) => {
  const data = await ctx.schedule(() => fetchData())

  if (!data) throwAbort('nullable data', getTopController(ctx.cause))

  // ... perform data
}, 'doSome')
```

### spawn

This utility allow you to start a function with context which will NOT follow an abort of the cause.

For example, you want to start a fetch when Atom gets a connection, but don't want to abort the fetch when the connection is lost. This is because you want to persist the results.

```ts
import { spawn } from '@reatom/effects'
import { onConnect } from '@reatom/hooks'

onConnect(someAtom, (ctx) => {
  spawn(ctx, async (spawnCtx) => {
    const some = await api.getSome(spawnCtx)
    someAtom(spawnCtx, some)
  })
})
```
