[`@reatom/persist`](https://www.reatom.dev/package/persist) adapter for the Web Storage APIs.

## Installation

```sh
npm i @reatom/persist-web-storage
```

## Usage

### withLocalStorage

Synchronizes atom state to the `localStorage` with a given name

```ts
import { atom } from '@reatom/framework'
import { withLocalStorage } from '@reatom/persist-web-storage'

export const tokenAtom = atom('', 'tokenAtom').pipe(withLocalStorage('token'))
```

### withSesssionStorage

Synchronizes atom state to the `sessionsStorage` with a given name

```ts
import { atom } from '@reatom/framework'
import { withSessionStorage } from '@reatom/persist-web-storage'

export const tokenAtom = atom('', 'tokenAtom').pipe(withSessionStorage('token'))
```

### withBroadcastChannel

The main goal of this adapter is to synchronize atom between tabs without polluting `localStorage`

```ts
import { atom } from '@reatom/framework'
import { withBroadcastChannel } from '@reatom/persist-web-storage'

export const isAuthedAtom = atom('', 'isAuthedAtom').pipe(
  withBroadcastChannel()('isAuthedAtom'),
)
```

You can also give an instance of `BroadcastChannel`

```ts
import { atom } from '@reatom/framework'
import { withBroadcastChannel } from '@reatom/persist-web-storage'

const channel = new BroadcastChannel('isAuthed')

channel.onmessage((event) => {
  console.log(event)
  // Do some work here
  // ...
})

export const isAuthedAtom = atom('', 'isAuthedAtom').pipe(
  withBroadcastChannel({ key: 'isAuthedAtom', channel }),
)
```

### withIndexedDb

IMPORTANT: The state currently flicks (goes from `null` to actual value) on the first page load (due to asynchronous nature of IndexedDB and current synchronous architecture of `@reatom/persist`)

The main goal of this adapter is to persist atom's state to IndexedDB. `withIndexedDb` does not currently support rich IndexedDB features such as indexing, transactions and migrations. It uses IndexedDB as a key-value storage, which is preferable over localStorage for large data (over a couple of megabytes).

```ts
import { reatomResource, withCache } from '@reatom/framework'
import { withIndexedDb } from '@reatom/persist-web-storage'

export const listResource = reatomResource(
  async (ctx) => api.getList(ctx.spy(pageAtom)),
  'listResource',
).pipe(withCache({ withPersist: withIndexedDb }))
```

You can also specify a custom database name and a custom `BroadcastChannel' that will be used to synchronize the data in real time.

```ts
import { reatomResource, withCache } from '@reatom/framework'
import { withIndexedDb } from '@reatom/persist-web-storage'

export const listResource = reatomResource(
  async (ctx) => api.getList(ctx.spy(pageAtom)),
  'listResource',
).pipe(withIndexedDb({ key: 'hugeListAtom', dbName: 'myCustomDb', channel }))
```

If you want to avoid flickering, all you have to do is add a small delay after the atom is connected. Subscribe / spy the data atom, wait the ready atom and then use the actual data.

> [example](https://github.com/artalar/reatom/blob/v3/examples/react-persist-web/src/app.tsx)

```ts
import { reatomResource, withCache, onConnect, sleep } from '@reatom/framework'
import { withIndexedDb } from '@reatom/persist-web-storage'

export const listResource = reatomResource(
  async (ctx) => api.getList(ctx.spy(pageAtom)),
  'listResource',
).pipe(withIndexedDb({ key: 'hugeListAtom', dbName: 'myCustomDb', channel }))
const isListReadyAtom = atom(false, 'isListReadyAtom')
onConnect(listResource, async (ctx) => {
  await ctx.schedule(() => new Promise((r) => requestIdleCallback(r)))
  isListReadyAtom(ctx, true)
  return () => isListReadyAtom(ctx, false)
})
```
