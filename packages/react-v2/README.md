<div align="center">
<br/>

<a href="https://www.reatom.dev/">
  <img src="https://www.reatom.dev/assets/logo_text.png" alt="reatom logo" width="100%" loading="lazy" />
</a>

</div>

# @reatom/react-v2

React bindings package for [Reatom](https://github.com/artalar/reatom) store.

[![npm](https://img.shields.io/npm/v/@reatom/react-v2?style=flat-square)](https://www.npmjs.com/package/@reatom/react-v2)
![npm type definitions](https://img.shields.io/npm/types/@reatom/react-v2?style=flat-square)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/react-v2?style=flat-square)](https://bundlephobia.com/result?p=@reatom/react-v2)
![GitHub](https://img.shields.io/github/license/artalar/reatom?style=flat-square)

> Reatom is **declarative** and **reactive** state manager, designed for both simple and complex applications. See [docs](https://github.com/artalar/reatom).

## Install

```
npm i @reatom/react-v2
```

or

```sh
yarn add @reatom/react-v2
```

> `@reatom/react-v2` depends on and works with `@reatom/core-v2` and `react`. You should install this packages too.

## Hooks Api

If you use React 16 or 17 you should setup batch bindings for React by yourself. Just import `@reatom/react-v2/react-dom-batched-updates` or `@reatom/react-v2/react-native-batched-updates` on the top (root) of your project to make it work before any hook call.

```ts
import '@reatom/react-v2/react-dom-batched-updates'
```

### useAtom

Connects the atom to the store represented in context and returns the state of the atom from the store (or default atom state).

#### Basic (useAtom)

```ts
const [data] = useAtom(dataAtom)
```

#### Depended value by selector

```ts
const [propAtom] = useMemo(() => createAtom({ dataAtom }, ({ get }) => get('dataAtom')[props.id]), [props.id])
const [propValue] = useAtom(propAtom)
```

### useAction

Binds action with dispatch to the store provided in the context.

#### Basic (useAction)

```ts
const handleUpdateData = useAction(dataAtom.update)
```

#### Prepare payload for dispatch

```ts
const handleUpdateData = useAction((value) => dataAtom.update({ id: props.id, value }), [props.id])
```

#### Conditional dispatch

If action creator don't return an action dispatch not calling.

```ts
const handleUpdateData = useAction((payload) => {
  if (condition) return dataAtom.update(payload)
}, [])
```

## Usage

### Step 0 - OPTIONAL. Create store.

This step is required only for SSR, when one node.js process may handle a few requests at the time.

```jsx
// App

import React from 'react'
import { createStore } from '@reatom/core-v2'
import { reatomContext } from '@reatom/react-v2'
import { Form } from './components/Form'

import './App.css'

export const App = () => {
  // create statefull reatomContext for atoms execution
  const store = createStore()

  return (
    <div className="App">
      <reatomContext.Provider value={store}>
        <Form />
      </reatomContext.Provider>
    </div>
  )
}
```

### Step 1. Bind your atoms.

```jsx
// components/Form

import { createPrimitiveAtom } from '@reatom/core-v2/primitives'
import { useAtom } from '@reatom/react-v2'

const nameAtom = createPrimitiveAtom('', {
  onChange: (state, e) => e.currentTarget.value,
})

export const Form = () => {
  const [name, { onChange }] = useAtom(nameAtom)

  return (
    <form>
      <label htmlFor="name">Enter your name</label>
      <input id="name" value={name} onChange={onChange} />
    </form>
  )
}
```

### Step 3. You are gorgeous

<!--
## Why React so unfriendly for state-managers

- github.com/facebook/react/issues/14259#issuecomment-439632622
- kaihao.dev/posts/Stale-props-and-zombie-children-in-Redux
-->
