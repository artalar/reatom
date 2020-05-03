# Module: @reatom/react

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

## Index

### Globals

- [Provider](_reatom_react.md#markdown-header-provider)
- [context](_reatom_react.md#markdown-header-const-context)
- [useAction](_reatom_react.md#markdown-header-const-useaction)
- [useAtom](_reatom_react.md#markdown-header-const-useatom)

### Functions

- [createActionHook](_reatom_react.md#markdown-header-createactionhook)
- [createAtomHook](_reatom_react.md#markdown-header-createatomhook)

## Globals

### <a id="markdown-header-provider" name="markdown-header-provider"></a> Provider

• **Provider**: _ProviderExoticComponent‹ProviderProps‹null | object››_

---

### <a id="markdown-header-const-context" name="markdown-header-const-context"></a> context

• **context**: _Context‹null | object›_ = createContext<Store | null>(null)

Added in: v1.0.0

```js
import { context } from '@reatom/react'
```

#### Description

Context for Reatom store

#### Examples

Basic

```jsx
<context.Provider value={store}>
  <App />
</context.Provider>
```

Getting store

```js
const store = useContext(context)
```

---

### <a id="markdown-header-const-useaction" name="markdown-header-const-useaction"></a> useAction

• **useAction**: _useAction_ = createActionHook()

Added in: v1.0.0

```js
import { useAction } from '@reatom/react'
```

#### Description

React Hook for bind action and dispatch to the store provided in the context.

#### Signature

### useAction(actionCreator)

**Arguments**

- actionCreator [`ActionCreator`](../core/ActionCreator) | `() =>`[`Action`](../core/Action)

**Returns** [`ActionCreator`](./../core/ActionCreator)

#### Examples

```js
const doIncrement = useAction(increment)
```

---

### <a id="markdown-header-const-useatom" name="markdown-header-const-useatom"></a> useAtom

• **useAtom**: _useAtom_ = createAtomHook()

Added in: v1.0.0

```js
import { useAction } from '@reatom/react'
```

#### Description

React Hook for connects the atom to the store provided in context and returns the state of the atom from the store (or default atom state).

#### Signature

### useAtom(atom, selector?, deps?)

**Arguments**

- atom [`Atom`](../core/Atom.md) - required
- selector `Function` - optional
- deps `Array` - optional

**Returns** [`AtomState`](../core/AtomState.md)

#### Examples

Basic

```js
const products = useAtom(productsAtom)
```

With selector

```js
const product = useAtom(productsAtom, state => state[id], [id])
```

## Functions

### <a id="markdown-header-createactionhook" name="markdown-header-createactionhook"></a> createActionHook

▸ **createActionHook**(`ctx`: Context‹[Store](_reatom_core.md#markdown-header-store) | null›): _useAction_

**Parameters:**

| Name  | Type                                                                | Default | Description                   |
| ----- | ------------------------------------------------------------------- | ------- | ----------------------------- |
| `ctx` | Context‹[Store](_reatom_core.md#markdown-header-store) &#124; null› | context | react context for your store. |

**Returns:** _useAction_

A `useAction` hook bound to the context.

---

### <a id="markdown-header-createatomhook" name="markdown-header-createatomhook"></a> createAtomHook

▸ **createAtomHook**(`ctx`: Context‹[Store](_reatom_core.md#markdown-header-store) | null›): _useAtom_

**Parameters:**

| Name  | Type                                                                | Default | Description                   |
| ----- | ------------------------------------------------------------------- | ------- | ----------------------------- |
| `ctx` | Context‹[Store](_reatom_core.md#markdown-header-store) &#124; null› | context | react context for your store. |

**Returns:** _useAtom_

A `useAtom` hook bound to the context.
