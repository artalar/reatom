> included in [@reatom/framework](https://www.reatom.dev/packages/framework)

All atoms and actions have a hooks to they lifecycle, this package exposes friendly helpers to use this hooks.

We assumes that you already read [lifecycle guild](https://www.reatom.dev/guides/lifecycle).

A lot of cool examples you could find in [async package docs](https://www.reatom.dev/packages/async).

## `withInit`

Operator to set state creator callback to an atom, which is called by first atom subscription (during transaction).

```ts
import { atom } from '@reatom/core'
import { withInit } from '@reatom/hooks'

const dateAtom = atom(0).pipe(withInit(() => Date.now()))
```

## `onConnect`

Subscribe to atom subscription, optionally return cleanup callback. All connection (and disconnection) callbacks calling during effects queue - outside batching!

```ts
import { onConnect } from '@reatom/hooks'

const dispose = onConnect(messagesAtom, (ctx) => {
  const cb = (message) => {
    messagesAtom(ctx, (messages) => [...messages, message])
  }

  WS.on('message', cb)

  return () => WS.off('message', cb)
})
```

Passed `ctx` have `isConnected` method which checks the passed atom current status - [async example](https://www.reatom.dev/packages/async#periodic-refresh-for-used-data). Also, `ctx` includes `controller` property which is AbortController - you could reuse it perfectly with `reatomAsync` - [another async example](https://www.reatom.dev/packages/async#abortable-process)

### Comparison with React

For example, in React you should manage abort strategy by yourself by `useEffect`, if you want to cancel async process on unmount.

```tsx
import { reatomAsync, withAbort } from '@reatom/async'
import { useAtom, useAction } from '@reatom/npm-react'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
).pipe(withAbort())

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

With Reatom you could simplify it and made more readable.

```tsx
import { reatomAsync, onConnect } from '@reatom/framework'
import { useAtom } from '@reatom/npm-react'

export const fetchList = reatomAsync(
  (ctx) => request('api/list', ctx.controller),
  'fetchList',
)
onConnect(fetchList.dataAtom, fetchList)

export const List = () => {
  const [list] = useAtom(fetchList.dataAtom)

  return <ul>{list.map(() => '...')}</ul>
}
```

Isn't it cool, how the size of the code is reduced and how the logic is simplified?

## `onDisconnect`

Shortcut to `onConnect` return callback.

## `onUpdate`

Derive atom or action update during transaction.

```ts
import { onUpdate } from '@reatom/hooks'

const dispose = onUpdate(pagingAtom, (ctx, page) => fetchData(ctx, page))
```

For computed atoms it is called only when the atom is connected.

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

## `spyChange`

Spy an atom or an action change in the atom reducer. The difference with [onUpdate](#onupdate) is that `spyChange` is a warm link - works inside atom only when it have a connections.

`spyChange(CtxSpy, anAtom, (value) => any): isChanged`

```ts
import { atom } from '@reatom/core'
import { spyChange } from '@reatom/hooks'

export const someAtom = atom((ctx, state = initState) => {
  spyChange(ctx, someAction, (payload) => {
    state = state + payload
  })
  // OR
  if (spyChange(ctx, someAction)) {
    state = state + payload
  }
})
```

<!-- ## `controlConnection` -->

<!-- ## `isConnected` -->
