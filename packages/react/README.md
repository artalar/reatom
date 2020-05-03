React bindings package for [Reatom](https://github.com/artalar/reatom) store.

[![npm](https://img.shields.io/npm/v/@reatom/react?style=flat-square)](https://www.npmjs.com/package/@reatom/react)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/react?style=flat-square)](https://bundlephobia.com/result?p=@reatom/react)

## Install

```
npm i @reatom/react
```

or

```sh
yarn add @reatom/react
```

> NOTE. **@reatom/react** depends on [@reatom/core](https://reatom.js.org/#/reatom-core).

## Hooks Api

### useAtom

Connects the atom to the store provided in context and returns the state of the atom from the store (or default atom state).

#### Retrieve atom state from the store

```ts
const atomValue = useAtom(atom)
```

#### Get atom state and apply dynamic selector

```ts
const atomValue = useAtom(atom, atomState => atomState[props.id], [props.id])
```

> NOTE. You need to pass a third argument to `useAtom` that is the array of values that the atom depends on. To make sure the state selector is reapplied and derived value is recalculated when dependencies change.

#### Mount without subscription (for subscribing atoms to actions)

```ts
const atomValue = useAtom(atom, () => null, [])
```

### useAction

Creates a handle, which dispatches the action to the store provided in the context.

#### Basic (useAction)

```ts
const handleDoSome = useAction(doSome)
```

#### Prepare payload for dispatch

```ts
const handleDoSome = useAction(
  value =>
    doSome({
      id: props.id,
      value,
    }),
  [props.id],
)
```

#### Conditional dispatch

Dispatch is not called if action creator doesn't return an action.

```ts
const handleDoSome = useAction(payload => {
  if (condition) return doSome(payload)
}, [])
```

## Usage

### Step 1. Create store

```jsx
// App

import React from 'react'
import { createStore } from '@reatom/core'
import { context } from '@reatom/react'
import { Form } from './components/Form'

import './App.css'

export const App = () => {
  // create stateful context for atoms execution
  const store = createStore()

  return (
    <div className="App">
      <context.Provider value={store}>
        <Form />
      </context.Provider>
    </div>
  )
}
```

### Step 2. Use in components

```jsx
// components/Form

import { declareAction, declareAtom } from '@reatom/core'
import { useAction, useAtom } from '@reatom/react'

const changeName = declareAction()
const nameAtom = declareAtom('', on => [
  on(changeName, (state, payload) => payload),
])

export const Form = () => {
  const name = useAtom(nameAtom)
  const handleChangeName = useAction(e => changeName(e.target.value))

  return (
    <form>
      <label htmlFor="name">Enter your name</label>
      <input id="name" value={name} onChange={handleChangeName} />
    </form>
  )
}
```
