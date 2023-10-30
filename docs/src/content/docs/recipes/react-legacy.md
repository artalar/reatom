---
title: Reatom with legacy react versions
description: How to add Reatom to React 16 or 17 versions
---

## React 16 or 17

For `react-dom`:

```js
import { unstable_batchedUpdates } from 'react-dom'
import { createCtx } from '@reatom/core'
import { setupBatch, withBatching } from '@reatom/npm-react'
import { Main } from './path/to/an/Main';

setupBatch(unstable_batchedUpdates)
const ctx = withBatching(createCtx())

export const App = () => (
  <reatomContext.Provider value={ctx}>
    <Main />
  </reatomContext.Provider>
)

```

For `react-native`:

```js
import { unstable_batchedUpdates } from 'react-native'
import { createCtx } from '@reatom/core'
import { setupBatch } from '@reatom/npm-react'
import { Main } from './path/to/an/Main';

setupBatch(unstable_batchedUpdates)
const ctx = withBatching(createCtx())

export const App = () => (
  <reatomContext.Provider value={ctx}>
    <Main />
  </reatomContext.Provider>
)