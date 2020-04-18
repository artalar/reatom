# Module: @reatom/observable

<div align="center">
<br/>

[![reatom logo](https://reatom.js.org/logos/logo.svg)](https://reatom.js.org)

</div>

Package of Reatom for creating observers of atoms or stores

[![npm](https://img.shields.io/npm/v/@reatom/observable?style=flat-square)](https://www.npmjs.com/package/@reatom/observable)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/observable?style=flat-square)](https://bundlephobia.com/result?p=@reatom/observable)

[Open in docs](https://reatom.js.org/#/packages/observable)

## Install

```sh
npm i @reatom/observable
```

or

```sh
yarn add @reatom/observable
```

> NOTE. **@reatom/observable** depends on and works with [@reatom/core](https://reatom.js.org/#/reatom-core).

## Usage

```js
import { declareAtom, declareAction, createStore } from '@reatom/core'

const action = declareAction()
const atom = declareAtom(0, on => [on(action, (state, payload) => payload)])

const store = createStore(atom)
```

### Store observer

```js
import { observe } from '@reatom/observable'

const observableStore = observe(store)
const subscription = observableStore.subscribe(action => console.log(action))

subscription.unsubscribe() // unsubscribes
```

Alternative subscsribe

```js
const subscription = observableStore.subscribe({
  next(action) {
    console.log(action)
  },
})
```

### Atom observer

```js
import { observe } from '@reatom/observable'

const observableAtom = observe(store, atom)
const subscription = observableAtom.subscribe(state => console.log(state))

subscription.unsubscribe() // unsubscribes
```

Alternative subscsribe

```js
const subscription = observableAtom.subscribe({
  next(state) {
    console.log(state)
  },
})
```

## Index

### Classes

- [Observable](../classes/_reatom_observable.observable.md)

### Interfaces

- [Observer](../interfaces/_reatom_observable.observer.md)
- [Subscription](../interfaces/_reatom_observable.subscription.md)

### Type aliases

- [ActionOrValue](_reatom_observable.md#markdown-header-actionorvalue)

### Functions

- [observe](_reatom_observable.md#markdown-header-observe)

## Type aliases

### <a id="markdown-header-actionorvalue" name="markdown-header-actionorvalue"></a> ActionOrValue

Ƭ **ActionOrValue**: _T extends undefined ? Action<any, string> : T_

## Functions

### <a id="markdown-header-observe" name="markdown-header-observe"></a> observe

▸ **observe**<**T**>(`store`: [Store](_reatom_core.md#markdown-header-store), `atom?`: [Atom](../interfaces/_reatom_core.atom.md)‹T›): _[Observable](../classes/_reatom_observable.observable.md)‹T›_

Added in: v1.0.0

```js
import { observe } from '@reatom/observable'
```

**Type parameters:**

▪ **T**

**Parameters:**

| Name    | Type                                           |
| ------- | ---------------------------------------------- |
| `store` | [Store](_reatom_core.md#markdown-header-store) |
| `atom?` | [Atom](../interfaces/_reatom_core.atom.md)‹T›  |

**Returns:** _[Observable](../classes/_reatom_observable.observable.md)‹T›_
