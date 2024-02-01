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
import { atom } from '@reatom/framework'
import { withIndexedDb } from '@reatom/persist-web-storage'

export const hugeListAtom = atom('', 'hugeListAtom').pipe(
  withIndexedDb('hugeListAtom'),
)
```

You can also give custom database name and a custom `BroadcastChannel`.

```ts
import { atom } from '@reatom/framework'
import { withIndexedDb } from '@reatom/persist-web-storage'

const channel = new BroadcastChannel('myCystomBroadcastChannel')

export const hugeListAtom = atom([], 'hugeListAtom').pipe(
  withIndexedDb({ key: 'hugeListAtom', dbName: 'myCustomDb', channel }),
)
```

If you want to avoid flicks, you can preload atom's value. For example, in React you would do something like

```ts
import { atom } from '@reatom/framework'
import { withIndexedDb } from '@reatom/persist-web-storage'
import { useAtom } from '@reatom/npm-react'

export const hugeListAtom = atom([], 'hugeListAtom').pipe(
  withIndexedDb()('hugeListAtom'),
)

export const HugeListPreloader = () => {
  useAtom(hugeListAtom)
  return null
}
```
