---
title: persist
description: Reatom for persist
---

This package provides base primitives to create your own persist adapters. It helps to manage data transformation (serialization), versioning and migrations, autoupdates (subscription). Check /package/persist-web-storage for product usage or inspiration.

## Installation

```sh
npm i @reatom/persist
```

## Usage

One of the features is that each adapter is built on top of an abstract storage, which is stored in `storageAtom` which you can change for testing purposes. `createMemStorage` helps to create a new inmemory storage, which is useful to use, when you need to run code in a different environment, like tests or SSR. Check out [tests of this package](https://github.com/artalar/reatom/blob/v3/packages/persist/src/index.test.ts). Also, you could use `createMemStorage` to manage a state sharing by a string keys.

### Options

Each persist adapter has this set of options:

- `key: string` - the key is a single required property.
- `subscribe?: boolean` - a flag to turn on/off autoupdate (defaults depends on an adapter).
- `toSnapshot?: (ctx: Ctx, state: T) => unknown` - a callback to transform data before persisting.
- `fromSnapshot?: (ctx: Ctx, snapshot: unknown, state?: T) => T` - a callback to parse data on init or subscription update.
- `version?: number` - version of the data which change used to trigger the migration.
- `migration?: (ctx: Ctx, persistRecord: PersistRecord) => T` - a callback for data migration which will be called if the version changed.
- `time?: number` - time to live in milliseconds ([MAX_SAFE_TIMEOUT](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout#maximum_delay_value) (~25 days) by default).

### Testing

`createMemStorage` allows you to create a mock storage to simplify testing of atoms and any persist adapter. Let's imagine we have a state which is synced with localStorage, how do we run this code in a test (Node.js) environment?

```ts
// feature.ts
import { atom } from '@reatom/framework'
import { withLocalStorage } from '@reatom/persist-web-storage'

export const tokenAtom = atom('', 'tokenAtom').pipe(withLocalStorage('token'))
```

```ts
// feature.test.ts
import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx } from '@reatom/testing'
import { createMemStorage } from '@reatom/persist'
import { withLocalStorage } from '@reatom/persist-web-storage'
import { tokenAtom } from './feature'

test('token', () => {
  const ctx = createTestCtx()
  const mockStorage = createMemStorage({ token: '123' })
  withLocalStorage.storageAtom(ctx, mockStorage)

  assert.is(ctx.get(tokenAtom), '123')
})
```

### SSR

You could find full-featured SSR example with Next.js here: https://github.com/artalar/reatom-nextjs.

Check the example below about how simple it is to implement a SSR adapter. We need to create inmemory storage, build a persists layer from that and use it in needed atoms.

```ts
// src/ssr.ts
import { createMemStorage, reatomPersist } from '@reatom/persist'

const ssrStorage = createMemStorage({ name: 'ssr', subscribe: false })
export const { snapshotAtom } = ssrStorage
export const withSsr = reatomPersist(ssrStorage)
```

```ts
// src/features/goods/model.ts
import { atom } from '@reatom/core'
import { withSsr } from 'src/ssr'

export const filtersAtom = atom('').pipe(withSsr('goods/filters'))

export const listAtom = atom(new Map()).pipe(
  withSsr({
    key: 'goods/list',
    toSnapshot: (ctx, list) => [...list],
    fromSnapshot: (ctx, snapshot) => new Map(snapshot),
  }),
)
```

```ts
// src/root.ts
import { createCtx } from '@reatom/core'
import { snapshotAtom } from 'src/ssr'

export const ssrHandler = async () => {
  const ctx = createCtx()

  await doAsyncStuffToFillTheState(ctx)

  const snapshot = ctx.get(snapshotAtom)

  return { snapshot }
}

export const render = ({ snapshot }) => {
  export const ctx = createCtx()
  snapshotAtom(ctx, snapshot)

  runFeaturesAndRenderTheApp(ctx)
}
```
