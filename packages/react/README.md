<div align="center">
<br/>
<img src="../../docs/logos/logo.png" alt="reatom logo" align="center">
</div>

# @reatom/react

Package for bindings [Reatom](https://github.com/artalar/reatom) store with React

[![npm](https://img.shields.io/npm/v/@reatom/react?style=flat-square)](https://www.npmjs.com/package/@reatom/react)
![npm type definitions](https://img.shields.io/npm/types/@reatom/react?style=flat-square)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/react?style=flat-square)](https://bundlephobia.com/result?p=@reatom/react)
![GitHub](https://img.shields.io/github/license/artalar/reatom?style=flat-square)


> Reatom is **declarative** and **reactive** state manager, designed for both simple and complex applications. See [docs](https://artalar.github.io/reatom/).


> **IMPORTANT!** Current state is **Work In Progress**. We do not recommend to use in production at the moment, but... We look forward to your feedback and suggestions to improve the API

> **v1.0.0 schedule**: end of September 2019

## Install

Yarn
```
yarn add @reatom/react
```

NPM
```
npm i -S @reatom/react
```

## Hooks Api


### useAtom
Connects the atom to the store represented in context and returns the state of the atom from the store (or default atom state)

```ts
useAtom(atom: Atom, silent: boolean = true): AtomState
```

### useAction
Binds action with dispatch to the store provided in the context
```ts
useAction(action: Action, deps: any[] = []): Action
``` 

## Usage

### Step 1. Create store
```jsx
// App

import React from 'react';
import { createStore } from '@reatom/core'
import { context } from '@reatom/react'
import { Counter } from './components/Counter'

import './App.css';

export const App = () => {
  // preloaded state (not required)
  const state = { greeting: 'Hello Reatom' }

  // create root entry point for all atoms
  const store = createStore(state);

  return (
    <div className='App'>
      <context.Provide value={store}>
        <Counter />
      </context.Provide>
    </div>
  );
}
```

### Step 2. Use in component

```jsx
// components/Counter

import { declareAction, declareAtom } from '@reatom/core'
import { useAction, useAtom } from '@reatom/react'

const increment = declareAction()
const decrement = declareAction()

const GreetingAtom = declareAtom(['greeting'], '', on => [])
const CounterAtom = declareAtom(['counter'], 0, on => [
  on(increment, state => state + 1),
  on(decrement, state => state - 1)
])

export const Counter = () => {
  const greeting = useAtom(GreetingAtom)
  const count = useAtom(CounterAtom)
  const doIncrement = useAction(increment)
  const doDecrement = useAction(decrement)

  return (
    <div>
      <h1>{greeting}</h1>
      <button key='decrement'>-</button>
      {count}
      <button key='increment'>+</button>
    </div>
  )
}
```
