# @reatom/react

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

> NOTE. **@reatom/react** depends on and works with [@reatom/core](https://artalar.github.io/reatom/#/reatom-core).

## API Reference

- [context](/api/react/context)
- [useAtom](/api/react/useAtom)
- [useAction](/api/react/useAction)

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
  // create stateful context for atoms execution
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

### Step 2. Use in components

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
---

[Open source code on GitHub](https://github.com/artalar/reatom/tree/master/packages/react)
