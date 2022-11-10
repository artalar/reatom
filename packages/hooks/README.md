All atoms and actions have a hooks to they lifecycle, this package expose friendly helpers to use this hooks.

## `withInit`

Operator to set state creator callback to an atom, which is called by first atom subscription (during transaction).

```ts
import { atom } from '@reatom/core'
import { withInit } from '@reatom/hooks'

const dateAtom = atom(0).pipe(withInit(() => Date.now()))
```

## `onConnect`

Subscribe to atom subscription, optionally return cleanup callback (called during effect queue).

```ts
import { onConnect } from '@reatom/hooks'

onConnect(messagesAtom, (ctx) => {
  const cb = (message) => {
    messagesAtom(ctx, (messages) => [...messages, message])
  }

  WS.on('message', cb)

  return () => WS.off('message', cb)
})
```

## `onDisconnect`

Shortcut to `onConnect` return callback.

## `onUpdate`

Derive atom or action update during transaction.

```ts
import { onUpdate } from '@reatom/hooks'

onUpdate(pagingAtom, (ctx, page) => fetchData(ctx, page))
```

Very simplified example of lazy analytics connection.

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
```

## `spyChange`

Spy atom or action change in the atom reducer.

`spyChange(CtxSpy, anAtom, (value) => any): isChanged`

<!-- ## `controlConnection` -->

<!-- ## `isConnected` -->
