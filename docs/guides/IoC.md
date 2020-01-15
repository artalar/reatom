# Inversion of control

## Explanation

[Inversion of control](https://en.wikipedia.org/wiki/Inversion_of_control) is a concept for changing some dependencies based on the running context - most popular reason for that is a tasting. Good for Reatom users - all basic entities (actions, atoms) are already working in a controlled context - a store. By the same token, any atom dependencies (as another atom) are automatically adding to a store when computed atom connecting to it. That means you already have dependencies resolving mechanism with Reatom.

What is it mean in the conclusion? You can create not only reactive atoms (depended on actions) but just _static_ atoms and use it as a service.

## Example

> IMPORTANT NOTE: in order to prevent errors in serialization **use a symbol** as an atom key

```ts
/* DECLARE API SERVICE */

import { declareAtom, declareAction, createStore } from '@reatom/core'
import axios from 'axios'

export const API = Symbol('api')
export const apiAtom = declareAtom(API, axios, () => [])

/* FEATURE IMPLEMENTATION */

export const recieveData = declareAction()
export const requestData = declareAction(async (payload, store) => {
  const data = await store.getState(apiAtom).get(url, payload)
  store.dispach(recieveData(data))
})

/* FEATURE USAGE */

store.dispatch(requestData())

/* TESTS */

// here we rewrite initial state (axios) of apiAtom by preloaded state
const store = createStore({
  [API]: mockedAxiosInstance
})
```