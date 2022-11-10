This package is inspired by [sagas](https://redux-saga.js.org) and give you advanced effect management solutions

## `take`

Allow you to await an atom update.

```ts
const count = await take(ctx, countAtom)
```

Allow you to await an action call.

```ts
openModal(ctx)
await take(ctx, closeModal)
sendData(ctx)
```

## `takeNested`

Allow you to await all dependent effects.

```ts
// SSR
await takeNested(ctx, (trackedCtx) => {
  // all router subscribers witch uses `schedule` will be awaited
  router.push(trackedCtx, req.url)
})
render()
```
