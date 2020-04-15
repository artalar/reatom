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
