Small, performant, powerful and extensible core package for building reactive applications of any size.

## Usage

```ts
import { createCtx, action, atom } from '@reatom/core'

// create context in the app root
const ctx = createCtx()

// define your base mutable data references
// by passing a primitive initial values
const searchAtom = atom('')
const isSearchingAtom = atom(false)
const goodsAtom = atom<Array<Goods>>([])

// define computed atoms to infer data
// with smart and optimized caching
const tipAtom = atom((ctx) => {
  // read and subscribe by `spy`
  const goodsCount = ctx.spy(goodsAtom).length

  if (goodsCount === 0) {
    // read without subscribing by `get`
    return ctx.get(searchAtom) ? 'Nothing found' : 'Try to search something'
  }
  if (goodsCount === 1) {
    return `We found one treasure`
  }
  return `Found ${goodsCount} goods`
})

// define your actions to handle any IO and work with atoms
const onSearch = action((ctx, event) => {
  // mutate base atoms by passing relative ctx and the new state
  searchAtom(ctx, event.currentTarget.value)
})
const fetchGoods = action((ctx) => {
  const search = ctx.get(searchAtom)
  // [OPTIONAL] get your services from the context
  const api = ctx.get(apiAtom)

  isSearchingAtom(ctx, true)

  // schedule side-effects
  // which will be called after successful execution of all computations
  const promise = ctx.schedule(async () => {
    const goods = await api.getGoods(search)

    // pass a callback to `get` to batch a few updates
    ctx.get(() => {
      isSearchingAtom(ctx, false)
      goodsAtom(ctx, goods)
    })
  })

  // returned promise could be handled in place of the action call
  return promise
})
```

> Do you want to see next [the docs for React adapter](https://reatom.vercel.app/packages/npm-react)?

```ts
// subscribe to your atoms
ctx.subscribe(tipAtom, (tip) => {
  document.getElementById('goods-tip').innerText = tip
})
// handle user interactions by your actions
document.getElementById('search-input').addEventListener('input', (event) => {
  onSearch(ctx, event)
})
// log all things
ctx.subscribe((logs) => {
  console.log(logs)
})
```

Use Reatom ecosystem to made your code clean and readable

```ts
import { onUpdate } from '@reatom/hooks'

onUpdate(searchAtom, fetchGoods)
```
