---
title: persist-web-storage
description: Reatom adapter for localStorage and sessionStorage
---

Simple and powerful persist adapter to make your state leave after the application exit. It allows your atom to initiate with data from a storage, sync the updates with a storage and subscribe to a storage updates - useful for tabs synchronization.

## Installation

```sh
npm i @reatom/persist-web-storage
```

## Usage

There a re two similar types adapters for each storage: `withLocalStorage`, `withSessionStorage`.

The number of options should could control:

```ts
interface WithPersistOptions<T> {
  /** parse data on init or subscription update @optional */
  fromSnapshot?: Fn<[ctx: Ctx, snapshot: unknown, state?: T], T>
  /** the key! */
  key: string
  /** migration callback which will be called if the version changed  @optional */
  migration?: Fn<[ctx: Ctx, persistRecord: PersistRecord], T>
  /** turn on/off subscription  @default true */
  subscribe?: boolean
  /** time to live in milliseconds @default 10 ** 10 */
  time?: number
  /** transform data before persisting  @optional */
  toSnapshot?: Fn<[ctx: Ctx, state: T], unknown>
  /** version of the data which change used to trigger the migration @default 0 */
  version?: number
}
```

## Simple example

```ts
import { atom } from '@reatom/framework'
import { withLocalStorage } from '@reatom/persist-web-storage'

export const tokenAtom = atom('', 'tokenAtom').pipe(withLocalStorage('token'))
```

## Testing

It is simple to test data with persist adapter as we have a special util for that: /package/testing#createmockstorage
