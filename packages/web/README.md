This package exposes a set of handy bindings to browser APIs.

## Installation

<Tabs>
<TabItem label="npm">

  ```sh
npm install @reatom/web
  ```

</TabItem>
<TabItem label="pnpm">

  ```sh
pnpm add @reatom/web
  ```

</TabItem>
<TabItem label="yarn">

  ```sh
yarn add @reatom/web
  ```

</TabItem>
<TabItem label="bun">

  ```sh
bun add @reatom/web
  ```

</TabItem>
</Tabs>

## Usage

## `onEvent`

The `onEvent` function enables you to respond to various types of events for the target element that supports the `addEventListener` interface, such as `HTMLInputElement` or `WebSocket`, among others.

You can pass a callback as the last argument. In this case, the method will return an unsubscribe function. If you skip the callback, the returned value will be a promise that will resolve with the event.

Please note that this API handles the abort context from the [onConnect](https://www.reatom.dev/package/hooks/#onconnect) effect and other Reatom APIs. It enables you to describe complex logic in a concise and clear manner with memory safety underneath.

### `onEvent` WebSocket example 

Here is a usage example, which was derived from [this observable example](https://github.com/domfarolino/observable/blob/c232b2e585b71a61034fd23ba4337570b537ef27/README.md?plain=1#L86):

```ts
import { atom, onConnect, onCtxAbort } from '@reatom/framework'
import { onEvent } from '@reatom/web'

const socket = new WebSocket('wss://example.com')

const reatomStock = (ticker) => {
  const stockAtom = atom(null, `${ticker}StockAtom`)
  onConnect(stockAtom, async (ctx) => {
    if (socket.readyState !== WebSocket.OPEN) {
      await onEvent(ctx, socket, 'open')
    }
    socket.send(JSON.stringify({ ticker, type: 'sub' }))
    onEvent(ctx, socket, 'message', (event) => {
      if (event.data.ticker === ticker) stockAtom(ctx, JSON.parse(event.data))
    })
    onEvent(ctx, socket, 'close', () => ctx.controller.abort())
    onEvent(ctx, socket, 'error', () => ctx.controller.abort())
    onCtxAbort(ctx, () =>
      socket.send(JSON.stringify({ ticker, type: 'unsub' })),
    )
  })

  return stockAtom
}

const googStockAtom = reatomStock('GOOG')

ctx.subscribe(googStockAtom, updateView)
```

## `onEvent` checkpoint example
Make sure to listen to event before you actually need it. As in [take](https://reatom.dev/package/effects/#take-checkpoints) you should use checkpoints
to handle all events without skipping it.

```ts
import { reatomAsync } from '@reatom/async'
import { onEvent } from '@reatom/web'
import { heroAnimation } from '~/feature/hero'
import { api } from '~/api'

const heroElement = document.getElementById('#hero')

const loadPageContent = reatomAsync(async (ctx)=>{
    // Docs: https://developer.mozilla.org/en-US/docs/Web/API/Element/animate
    const animation = heroElement.animate(heroAnimation)

    const content = await api.fetchContent()

    // ❌ Bug:
    // If person's connection is not fast enough animation can finish before we load content.
    // And we will be showing last frame of animation forever...
    await onEvent(ctx, animation, 'finish')

    pageContent(ctx, content)
})
```

And that's how we fix this behaviour using checkpoint:

```ts
const loadPageContent = reatomAsync(async (ctx)=>{
    const animation = heroElement.animate(heroAnimation)
    // ✅ We make a checkpoint before loading...
    const animationFinishedCheckpoint = onEvent(ctx, animation, 'finish')
    
    const content = await api.fetchContent()
    
    // ...and we will catch that event even if content loading takes ages
    await animationFinishedCheckpoint
    
    pageContent(ctx, content)
})
```
