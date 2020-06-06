# Module: @reatom/core

<div align="center">
<br/>

[![reatom logo](https://reatom.js.org/logos/logo.svg)](https://reatom.js.org)

</div>

Core package of [Reatom](https://github.com/artalar/reatom) state manager.

[![npm](https://img.shields.io/npm/v/@reatom/core?style=flat-square)](https://www.npmjs.com/package/@reatom/core)
![npm type definitions](https://img.shields.io/npm/types/@reatom/core?style=flat-square)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/core?style=flat-square)](https://bundlephobia.com/result?p=@reatom/core)
![GitHub](https://img.shields.io/github/license/artalar/reatom?style=flat-square)

[Open in docs](https://reatom.js.org/#/packages/core)

> Reatom is **declarative** and **reactive** state manager, designed for both simple and complex applications. See [docs](https://reatom.js.org/).

## Install

```sh
npm i @reatom/core
```

or

```sh
yarn add @reatom/core
```

## Usage

[Open in CodeSandbox](https://codesandbox.io/s/reatomcore-demo-28t3d)

```js
import {
  declareAction,
  declareAtom,
  map,
  combine,
  createStore,
} from '@reatom/core'

/**
 * Step 1.
 * Declare actions
 */
const increment = declareAction()

/**
 * Step 2.
 * Declare atoms (like reducers or models)
 */
const counterAtom = declareAtom(0, on => [on(increment, state => state + 1)])
const counterDoubledAtom = map(counterAtom, value => value * 2)
const countersShapeAtom = combine({
  counter: counterAtom,
  counterDoubled: counterDoubledAtom,
})

/**
 * Step 3.
 * Create store entry point
 */
const store = createStore(countersShapeAtom)

/**
 * Step 4.
 * Dispatch action
 */
store.dispatch(increment())

/**
 * Step 5.
 * Get action results
 */
console.log(store.getState(counterAtom))
// ➜ 1

console.log(store.getState(counterDoubledAtom))
// ➜ 2

console.log(store.getState(countersShapeAtom))
// ➜ { counter: 1, counterDoubled: 2 }
```

## Index

### Classes

- [Tree](../classes/_reatom_core.tree.md)

### Interfaces

- [Atom](../interfaces/_reatom_core.atom.md)

### Types

- [Action](_reatom_core.md#markdown-header-action)
- [ActionCreator](_reatom_core.md#markdown-header-actioncreator)
- [ActionType](_reatom_core.md#markdown-header-actiontype)
- [BaseAction](_reatom_core.md#markdown-header-baseaction)
- [BaseActionCreator](_reatom_core.md#markdown-header-baseactioncreator)
- [Ctx](_reatom_core.md#markdown-header-ctx)
- [Fn](_reatom_core.md#markdown-header-fn)
- [GenId](_reatom_core.md#markdown-header-genid)
- [InferType](_reatom_core.md#markdown-header-infertype)
- [Leaf](_reatom_core.md#markdown-header-leaf)
- [NonUndefined](_reatom_core.md#markdown-header-nonundefined)
- [PayloadActionCreator](_reatom_core.md#markdown-header-payloadactioncreator)
- [Reaction](_reatom_core.md#markdown-header-reaction)
- [State](_reatom_core.md#markdown-header-state)
- [Store](_reatom_core.md#markdown-header-store)
- [TreeId](_reatom_core.md#markdown-header-treeid)
- [Unit](_reatom_core.md#markdown-header-unit)

### Globals

- [init](_reatom_core.md#markdown-header-const-init)
- [initAction](_reatom_core.md#markdown-header-const-initaction)

### Functions

- [combine](_reatom_core.md#markdown-header-combine)
- [createStore](_reatom_core.md#markdown-header-createstore)
- [declareAction](_reatom_core.md#markdown-header-declareaction)
- [declareAtom](_reatom_core.md#markdown-header-declareatom)
- [getDepsShape](_reatom_core.md#markdown-header-getdepsshape)
- [getIsAction](_reatom_core.md#markdown-header-getisaction)
- [getIsAtom](_reatom_core.md#markdown-header-getisatom)
- [getName](_reatom_core.md#markdown-header-getname)
- [getState](_reatom_core.md#markdown-header-getstate)
- [getTree](_reatom_core.md#markdown-header-gettree)
- [map](_reatom_core.md#markdown-header-map)
- [nameToIdDefault](_reatom_core.md#markdown-header-nametoiddefault)
- [noop](_reatom_core.md#markdown-header-noop)

## Types

### <a id="markdown-header-action" name="markdown-header-action"></a> Action

Action is a packet of data sent to the store for processing by atoms.

> See more info about [flux standard action](https://github.com/redux-utilities/flux-standard-action):

#### Signature

```ts
type Reaction<T> = (payload: T, store: Store) => void

interface Action<T> {
  type: string
  payload: Payload<T>
  reactions?: Reaction<T>[]
}
```

#### Examples

Basic

```js
{
  type: 'auth',
  payload: { user: 'Sergey' }
}
```

With reactions

```js
{
  type: 'auth',
  payload: { user: 'Sergey' },
  reactions: [
    payload => console.log(payload),
    payload => console.log(payload.user),
  ]
}
```

---

### <a id="markdown-header-actioncreator" name="markdown-header-actioncreator"></a> ActionCreator

Function for crating action packages

```ts
interface ActionCreator {
  (): Action<T>
  getType(): string
}
```

---

### <a id="markdown-header-actiontype" name="markdown-header-actiontype"></a> ActionType

---

### <a id="markdown-header-baseaction" name="markdown-header-baseaction"></a> BaseAction

---

### <a id="markdown-header-baseactioncreator" name="markdown-header-baseactioncreator"></a> BaseActionCreator

---

### <a id="markdown-header-ctx" name="markdown-header-ctx"></a> Ctx

---

### <a id="markdown-header-fn" name="markdown-header-fn"></a> Fn

---

### <a id="markdown-header-genid" name="markdown-header-genid"></a> GenId

---

### <a id="markdown-header-infertype" name="markdown-header-infertype"></a> InferType

Helper for retrieving the data type used in an atom or action

**`example`**
type MyAtomType = InferType<typeof myAtom>
type MyActionType = InferType<typeof myAction>

---

### <a id="markdown-header-leaf" name="markdown-header-leaf"></a> Leaf

---

### <a id="markdown-header-nonundefined" name="markdown-header-nonundefined"></a> NonUndefined

---

### <a id="markdown-header-payloadactioncreator" name="markdown-header-payloadactioncreator"></a> PayloadActionCreator

---

### <a id="markdown-header-reaction" name="markdown-header-reaction"></a> Reaction

---

### <a id="markdown-header-state" name="markdown-header-state"></a> State

---

### <a id="markdown-header-store" name="markdown-header-store"></a> Store

Store is communicating stateful context between actions and atoms.

#### Interface

```ts
type Unsubscriber = () => void
type StoreState = Record<string, any>

interface Store {
  getState(): StoreState
  getState(atom: Atom): AtomState

  subscribe(subscriber: ActionsSubsriber): Unsubscriber
  subscribe(atom: Atom, subscriber: AtomSubscriber): Unsubscriber

  dispatch(action: Action): void
}
```

#### getState

Getting full store state

```js
store.getState()
```

Getting atom state from store

```js
store.getState(myAtom)
```

#### subscribe

Subsctibe to the actions

```js
store.subscribe(action => {})
```

Subsctibe to the state

```js
store.subscribe(myAtom, state => {})
```

#### dispatch

Dispatching actions to the store

```js
store.dispatch(myAction())
```

---

### <a id="markdown-header-treeid" name="markdown-header-treeid"></a> TreeId

---

### <a id="markdown-header-unit" name="markdown-header-unit"></a> Unit

Unit

**`example`**
type MyAtomType = InferType<typeof myAtom>
type MyActionType = InferType<typeof myAction>

## Globals

### <a id="markdown-header-const-init" name="markdown-header-const-init"></a> init

Action used to set initial state of atom

---

### <a id="markdown-header-const-initaction" name="markdown-header-const-initaction"></a> initAction

## Functions

### <a id="markdown-header-combine" name="markdown-header-combine"></a> combine

Added in: v1.0.0

```js
import { combine } from '@reatom/core'
```

#### Description

A function to combine several atoms into one.

#### Signature

```typescript
// overload 1
combine(shape: AtomsMap | TupleOfAtoms): Atom

// overload 2
combine(name: string | [string], shape: AtomsMap | TupleOfAtoms): Atom
```

**Arguments**

- **name** `string` | `[string]` - optional
- **shape** `Object` - required

**Returns** [`Atom`](./Atom)

#### Examples

Basic

```js
const myCombinedAtom = combine({ myAtom1, myAtom2 })
```

With name

```js
const myCombinedAtom = combine('myCombinedAtom', [myAtom1, myAtom2])
```

With static name

```js
const myCombinedAtom = combine(['myCombinedAtom'], [myAtom1, myAtom2])
```

---

### <a id="markdown-header-createstore" name="markdown-header-createstore"></a> createStore

Added in: v1.0.0

```js
import { createStore } from '@reatom/core'
```

#### Description

Function to create a store.

#### Signature

```typescript
// overload 1
createStore(initialState: StoreState?): Store

// overload 2
createStore(rootAtom: Atom?, initialState: StoreState?): Store
```

**Arguments**

1. **rootAtom** [`Atom`](./Atom) - optional
2. **initialState** [`StoreState`](./StoreState) - optional

**Returns** [`Store`](./Store)

#### Examples

Basic

```js
const store = createStore()
```

With root atom

```js
const store = createStore(myAtom)
```

With initial state

```js
const store = createStore({ foo: 'bar' })
```

With root atom and initial state

```js
const store = createStore(myAtom, { foo: 'bar' })
```

---

### <a id="markdown-header-declareaction" name="markdown-header-declareaction"></a> declareAction

Added in: v1.0.0

```js
import { declareAction } from '@reatom/core'
```

#### Description

A function to create the Declaration of the action.

#### Signature

```typescript
// overload 1
declareAction<P>(...reactions: Reaction<P>[]): ActionCreator<P>

// overload 2
declareAction<P>(type: string | [string], ...reactions: Reaction<P>[]): ActionCreator<P>
```

**Arguments**

- **type** `string` | `[string]` - optional
- **...reactions** [`Reaction[]`](./Reaction) - optional

**Returns** [`ActionCreator`](./ActionCreator)

#### Examples

Basic

```js
const action = declareAction()
```

With type

```js
const action = declareAction('myAction')
```

With static type

```js
const action = declareAction(['myAction'])
```

With reaction

```js
const action = declareAction((payload, store) => {
  store.dispatch(otherAction())
})
```

With type and reaction

```js
const action = declareAction('myAction', (payload, store) => {
  store.dispatch(otherAction())
})
```

---

### <a id="markdown-header-declareatom" name="markdown-header-declareatom"></a> declareAtom

Added in: v1.0.0

```js
import { declareAtom } from '@reatom/core'
```

#### Description

Function to create an atom Declaration.

#### Signature

```typescript
// overload 1
declareAtom<S>(defaultState: AtomState<S>, depsMatcher: DependcyMatcher<S>): Atom<S>

// overload 2
declareAtom<S>(name: string | [string], defaultState: AtomState<S>, depsMatcher: DependcyMatcher<S>): Atom<S>

```

**Generic Types**

- **S** - type of atom state

**Arguments**

- **name** `string` | `[string]` - optional
- **defaultState** `any` - required
- **depsMatcher** `Function` - required

**Returns** [`Atom`](./Atom)

#### Examples

Basic

```js
const myList = declareAtom([], on => [
  on(addItem, (state, payload) => [...state, payload]),
])
```

With name

```js
const myList = declareAtom('products', [], on => [
  on(addItem, (state, payload) => [...state, payload]),
])
```

With static name

```js
const myList = declareAtom(['products'], [], on => [
  on(addItem, (state, payload) => [...state, payload]),
])
```

---

### <a id="markdown-header-getdepsshape" name="markdown-header-getdepsshape"></a> getDepsShape

---

### <a id="markdown-header-getisaction" name="markdown-header-getisaction"></a> getIsAction

---

### <a id="markdown-header-getisatom" name="markdown-header-getisatom"></a> getIsAtom

---

### <a id="markdown-header-getname" name="markdown-header-getname"></a> getName

---

### <a id="markdown-header-getstate" name="markdown-header-getstate"></a> getState

---

### <a id="markdown-header-gettree" name="markdown-header-gettree"></a> getTree

---

### <a id="markdown-header-map" name="markdown-header-map"></a> map

Added in: v1.0.0

```js
import { map } from '@reatom/core'
```

#### Description

A function to create derived atoms by the required data format.

#### Signature

```typescript
// overload 1
map(atom: Atom, mapper: Function): Atom

// overload 2
map(name: string | [string], atom: Atom, mapper: Function): Atom
```

**Arguments**

- **name** `string` | `[string]` - optional
- **atom** [`Atom`](./Atom) - required
- **mapper** `Function` - required

**Returns** [`Atom`](./Atom)

#### Examples

Basic

```js
const newAtom = map(counterAtom, atomState => atomState * 2)
```

With name

```js
const newAtom = map('newAtom', counterAtom, atomState => atomState * 2)
```

With static name

```js
const newAtom = map(['newAtom'], counterAtom, atomState => atomState * 2)
```

---

### <a id="markdown-header-nametoiddefault" name="markdown-header-nametoiddefault"></a> nameToIdDefault

---

### <a id="markdown-header-noop" name="markdown-header-noop"></a> noop
