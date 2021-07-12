<div align="center">
<br/>

[![reatom logo](https://reatom.js.org/logos/logo.svg)](https://reatom.js.org)

</div>

# @reatom/react

React bindings package for [Reatom](https://github.com/artalar/reatom) store.

[![npm](https://img.shields.io/npm/v/@reatom/react?style=flat-square)](https://www.npmjs.com/package/@reatom/react)
![npm type definitions](https://img.shields.io/npm/types/@reatom/react?style=flat-square)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/react?style=flat-square)](https://bundlephobia.com/result?p=@reatom/react)
![GitHub](https://img.shields.io/github/license/artalar/reatom?style=flat-square)

[Open in docs](https://reatom.js.org/#/packages/react)

> Reatom is **declarative** and **reactive** state manager, designed for both simple and complex applications. See [docs](https://reatom.js.org/).

## Install

```
npm i @reatom/react@alpha
```

or

```sh
yarn add @reatom/react@alpha
```

> `@reatom/react` depends on and works with `@reatom/core` and `use-subscription`. You should install this packages too.

## Hooks Api

### useAtom

Connects the atom to the store represented in context and returns the state of the atom from the store (or default atom state).

#### Basic (useAtom)

```ts
const [atomValue] = useAtom(atom)
```

#### Depended value by selector

```ts
const [atomPropValue] = useAtom(
  useMemo(() => declareAtom(($) => $(atom)[props.id]), [props.id]),
)
```

#### Mount without subscription (for subscribing atoms to actions)

```ts
useInit([atom])
```

### useAction

Binds action with dispatch to the store provided in the context.

#### Basic (useAction)

```ts
const handleDoSome = useAction(doSome)
```

#### Prepare payload for dispatch

```ts
const handleDoSome = useAction(
  (value) => doSome({ id: props.id, value }),
  [props.id],
)
```

#### Conditional dispatch

If action creator don't return an action dispatch not calling.

```ts
const handleDoSome = useAction((payload) => {
  if (condition) return doSome(payload)
}, [])
```

## Usage

### Step 1. Create store

```jsx
// App

import React from 'react'
import { createStore } from '@reatom/core'
import { reatomContext } from '@reatom/react'
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

```jsx
// components/Form

import { declareAction, declareAtom } from '@reatom/core'
import { useAtom } from '@reatom/react'

const nameAtom = declareAtom('', {
  onChange: (e) => e.currentTarget.value,
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

OR

```jsx
// components/Form

import { declareAction, declareAtom } from '@reatom/core'
import { useAction, useAtom } from '@reatom/react'

const nameAtom = declareAtom('')

export const Form = () => {
  const [name] = useAtom(nameAtom)
  const handleChange = useAction((e) => nameAtom.update(e.currentTarget.value))

  return (
    <form>
      <label htmlFor="name">Enter your name</label>
      <input id="name" value={name} onChange={handleChange} />
    </form>
  )
}
```

<!--
## Why React so unfriendly for state-managers

- github.com/facebook/react/issues/14259#issuecomment-439632622
- kaihao.dev/posts/Stale-props-and-zombie-children-in-Redux
-->
