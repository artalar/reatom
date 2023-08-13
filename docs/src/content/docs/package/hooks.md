---
title: hooks
description: Reatom for hooks
---

> included in [@reatom/framework](/package/framework)

All atoms and actions have a hooks to they lifecycle, this package exposes friendly helpers to use this hooks.

We assumes that you already read [lifecycle guild](/guides/lifecycle).

A lot of cool examples you could find in [async package docs](/package/async).

## onConnect

`onConnect` allows you to react to atom connection (first subscribtion). Optionally, you could return a cleanup callback.

All connection (and disconnection) callbacks calling during effects queue - outside batching. The returned value is a dispose function used to deactivate the hook.

"Connection" refers to the presence of any number of subscribers in the atom. The first subscriber activates the connection status, while the second subscriber does not interact with it. Unsubscribing the first subscriber has no effect since there is still one subscriber (the second one). However, after unsubscribing the second subscriber, the connection status will be deactivated, and if a cleanup callback is provided, it will be triggered. You can read more in the [lifecycle guide](/guides/lifecycle/).

```ts
import { atom } from '@reatom/core'
import { onConnect } from '@reatom/hooks'

export const messagesAtom = atom([], 'messagesAtom')
const dispose = onConnect(messagesAtom, (ctx) => {
  const cb = (message) => {
    messagesAtom(ctx, (messages) => [...messages, message])
  }

  WS.on('message', cb)

  return () => WS.off('message', cb)
})
```

The passed `ctx` has an `isConnected` method to check the current status of the passed atom. You can refer to the [async example](/package/async#periodic-refresh-for-used-data) for more information. Additionally, the `ctx` includes a `controller` property, which is an AbortController. You can conveniently reuse it with `reatomAsync`. For further details, you can refer to [another async example](/package/async#abortable-process).

### Comparison with React

For example, in React you should manage abort strategy by yourself by `useEffect`, if you want to cancel async process on unmount.

```tsx
import { reatomAsync, withAbort, withDataAtom } from '@reatom/async'
import { useAtom, useAction } from '@reatom/npm-react'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withAbort(), withDataAtom([]))

export const List = () => {
  const [list] = useAtom(fetchList.dataAtom)
  const handleFetch = useAction(fetchList)
  const handleAbort = useAction(fetchList.abort)

  useEffect(() => {
    handleFetch()
    return handleAbort
  }, [])

  return <ul>{list.map(() => '...')}</ul>
}
```

With Reatom, you can simplify it and make it more readable.

```tsx
import { reatomAsync, onConnect, withDataAtom } from '@reatom/framework'
import { useAtom } from '@reatom/npm-react'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withDataAtom([]))
onConnect(fetchList.dataAtom, fetchList)

export const List = () => {
  const [list] = useAtom(fetchList.dataAtom)

  return <ul>{list.map(() => '...')}</ul>
}
```

Isn't it cool, how the size of the code is reduced and how the logic is simplified?

## onDisconnect

Shortcut to `onConnect` returned callback.

## onUpdate

The `onUpdate` hook allows you to react to state updates of the passed atom. However, this hook will be deprecated in the future. It is recommended and more convenient to use the atom's `onChange` method and the action's `onCall` method. You can find more information about these methods in the [core package documentation](/core/#atomonchange-api).

For general computed atoms (via `ctx.spy`), it is only called when the atom is connected. You can read more in the [lifecycle guide](/guides/lifecycle/).

One unique feature of `onUpdate` is that it could activate the entire chain of dependent atoms **if they are `LensAtom` or `LensAction`** from the [lens package](/package/lens/). It useful when you want to delay or sample the reaction.

```ts
import { onUpdate } from '@reatom/hooks'
import { debounce } from '@reatom/lens'

onUpdate(onChange.pipe(debounce(250)), (ctx) => fetchData(ctx))
```

<!-- Very simplified example of lazy analytics connection.

```ts
// analytics.ts
import { isAtom } from '@reatom/core'
import { onUpdate } from '@reatom/hooks'
import * as moduleA from '~/module-a'
// ...
import * as moduleN from '~/module-N'

for (const mod of [moduleA, moduleN]) {
  for (const name of Object.keys(mod)) {
    if (isAtom(mod[name])) {
      onUpdate(mod[name], (ctx, data) => analyticsService.send(name, data))
    }
  }
}
``` -->
