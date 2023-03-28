This package is inspired by [sagas](https://redux-saga.js.org) and give you advanced effect management solutions.

> included in [@reatom/framework](https://www.reatom.dev/packages/framework)

First of all you should know that many effects and async ([@reatom/async](https://www.reatom.dev/packages/async) + [@reatom/hooks](https://www.reatom.dev/packages/hooks)) logic uses [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) under the hood and if some of the controller aborted all nested effects will aborted too! It is a powerful feature for managing async logic which allows you to easily write concurrent logic, like in redux-saga or rxjs, but with the simpler API.

To mange check and abort logic there are few exports: `AbortError` type, `toAbortError` function for converting an abort reason to the abort error, `throwIfAborted` function for checking a controller status and throwing the correct error, `isAbort` function for checking an error is the abort error or not.

## `take`

Allow you to await an atom update.

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

## `takeNested`

Allow you to await all dependent effects, event if they was called in the nested async effect.

For example, we have a routing logic for SSR.

```ts
// ~/features/some.ts
import { historyAtom } from '@reatom/npm-history'

onUpdate(historyAtom.locationAtom, (ctx, location) => {
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
