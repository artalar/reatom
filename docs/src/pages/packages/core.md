---
layout: ../../layouts/Layout.astro
title: core
description: State manager for both simple and complex applications
---  
Small, performant, powerful and extensible core package for building reactive applications of any size.

## Installation

```sh
npm i @reatom/core@alpha
```

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

> Do you want to see next [the docs for React adapter](https://reatom.dev/packages/npm-react)?

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

### Action handling

It is better to stay atoms stupid and handle all logic inside action. But sometimes you need to turn direction of your code coupling and make atom depends from an action. And you could do it!

Action is an atom with a temporal state, which array of all passed payloads. This state is clearing after transaction end, if you will try to `get` or `spy` action which wasn't called you will receive an empty array. But if action was called, the array will contain some elements.

```ts
// ~/modules/someFlow
import { newMessage } from '~/modules/ws'

const FLOW_NAME = 'someFlow'

export const someFlowAtom = atom(0)

// you need to subscribe to it to start watching `newMessage`
export const someFlowManagerAtom = atom((ctx) => {
  console.log('example log for `ctx.get(newMessage)`', ctx.get(newMessage))

  ctx.spy(newMessage).forEach((msg) => {
    if (msg.relation === FLOW_NAME) someFlowAtom(ctx, msg)

    console.log('example log for `ctx.spy(newMessage)[N]`', msg)
  })
})

// socket service:
socket.on(
  throttle(150, (msgs) =>
    // batch  updates
    ctx.get(() => {
      msgs.forEach((msg) => newMessage(ctx, msg))
    }),
  ),
)

// someFlowManagerAtom reducer:
// example log for `ctx.get(newMessage)` [1, 2]
// example log for `ctx.spy(newMessage)[N]` 1
// example log for `ctx.spy(newMessage)[N]` 2
```

You need to know one rare tricky thing. If during transaction you will call an action and will read it dependent atom a few time step by step, `ctx.get` will return the whole array of all passed payload, but `ctx.spy` will return array with only new elements, which wasn't handled in this reducer during this transaction. And to made this rare case correct you should spying your dependencies in same way each time, without conditions. In other words, for this case your dependencies list should be static.
