<div align="center">
<br/>

[![reatom logo](https://artalar.github.io/reatom/logos/logo.svg)](https://artalar.github.io/reatom)

</div>

# @reatom/react

React bindings package for [Reatom](https://github.com/artalar/reatom) store.

[![npm](https://img.shields.io/npm/v/@reatom/react?style=flat-square)](https://www.npmjs.com/package/@reatom/react)
![npm type definitions](https://img.shields.io/npm/types/@reatom/react?style=flat-square)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/react?style=flat-square)](https://bundlephobia.com/result?p=@reatom/react)
![GitHub](https://img.shields.io/github/license/artalar/reatom?style=flat-square)

[Open in docs](https://artalar.github.io/reatom/#/packages/react)

> Reatom is **declarative** and **reactive** state manager, designed for both simple and complex applications. See [docs](https://artalar.github.io/reatom/).

> **IMPORTANT!** Current state is **Work In Progress**.
> At the moment we do not recommend to use `reatom` in production, but... We look forward to your feedback and suggestions to improve the API

> **v1.0.0 schedule**: October 2019

## Install

```
npm i @reatom/react
```
or
```sh
yarn add @reatom/react
```

> `@reatom/react` depends on and works with `@reatom/core`.

## Hooks Api

### useAtom

Connects the atom to the store represented in context and returns the state of the atom from the store (or default atom state).

#### Basic (useAtom)

```ts
const atomValue = useAtom(atom)
```

#### Depended value by selector

```ts
const atomValue = useAtom(atom, atomState => atomState[props.id], [props.id])
```

#### Mount without subscription (for subscribing atoms to actions)

```ts
const atomValue = useAtom(atom, () => null, [])
```

### useAction

Binds action with dispatch to the store provided in the context.

#### Basic (useAction)

```ts
const handleDoSome = useAction(doSome)
```

#### Prepare payload for dispatch

```ts
const handleDoSome = useAction(value => doSome({ id: props.id, value }), [props.id])
```

#### Conditional dispatch

If action creator don't return an action dispatch not calling.

```ts
const handleDoSome = useAction(
  payload => {
    if (condition) return doSome(payload)
  },
  []
)
```

## Usage

### Step 1. Create store

```jsx
// App

import React from 'react';
import { createStore } from '@reatom/core'
import { context } from '@reatom/react'
import { Form } from './components/Form'

import './App.css';

export const App = () => {
  // create statefull context for atoms execution
  const store = createStore();

  return (
    <div className='App'>
      <context.Provider value={store}>
        <Form />
      </context.Provider>
    </div>
  );
}
```

### Step 2. Use in component

```jsx
// components/Form

import { declareAction, declareAtom } from '@reatom/core'
import { useAction, useAtom } from '@reatom/react'

const changeName = declareAction()
const nameAtom = declareAtom('', on => [
  on(changeName, (state, payload) => payload)
])

export const Form = () => {
  const name = useAtom(nameAtom)
  const handleChangeName = useAction(e => changeName(e.target.value))

  return (
    <form>
      <label htmlFor="name">Enter your name</label>
      <input id="name" value={name} onChange={handleChangeName}/>
    </form>
  )
}
```
