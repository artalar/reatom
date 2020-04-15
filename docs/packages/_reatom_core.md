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

### References

- [Action](_reatom_core.md#markdown-header-action)
- [ActionCreator](_reatom_core.md#markdown-header-actioncreator)
- [ActionType](_reatom_core.md#markdown-header-actiontype)
- [Atom](_reatom_core.md#markdown-header-atom)
- [BaseActionCreator](_reatom_core.md#markdown-header-baseactioncreator)
- [GenId](_reatom_core.md#markdown-header-genid)
- [InferType](_reatom_core.md#markdown-header-infertype)
- [PayloadActionCreator](_reatom_core.md#markdown-header-payloadactioncreator)
- [Reaction](_reatom_core.md#markdown-header-reaction)
- [Store](_reatom_core.md#markdown-header-store)
- [TreeId](_reatom_core.md#markdown-header-treeid)
- [Unit](_reatom_core.md#markdown-header-unit)
- [combine](_reatom_core.md#markdown-header-combine)
- [createStore](_reatom_core.md#markdown-header-createstore)
- [declareAction](_reatom_core.md#markdown-header-declareaction)
- [declareAtom](_reatom_core.md#markdown-header-declareatom)
- [getDepsShape](_reatom_core.md#markdown-header-getdepsshape)
- [getIsAction](_reatom_core.md#markdown-header-getisaction)
- [getIsAtom](_reatom_core.md#markdown-header-getisatom)
- [getState](_reatom_core.md#markdown-header-getstate)
- [getTree](_reatom_core.md#markdown-header-gettree)
- [initAction](_reatom_core.md#markdown-header-initaction)
- [map](_reatom_core.md#markdown-header-map)
- [nameToIdDefault](_reatom_core.md#markdown-header-nametoiddefault)
- [noop](_reatom_core.md#markdown-header-noop)
- [setNameToId](_reatom_core.md#markdown-header-setnametoid)

### Classes

- [Tree](../classes/_reatom_core.tree.md)

### Interfaces

- [Atom](../interfaces/_reatom_core.atom.md)

### Type aliases

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

### Variables

- [TREE](_reatom_core.md#markdown-header-const-tree)
- [assign](_reatom_core.md#markdown-header-const-assign)
- [equals](_reatom_core.md#markdown-header-const-equals)
- [initAction](_reatom_core.md#markdown-header-const-initaction)

### Functions

- [combine](_reatom_core.md#markdown-header-combine)
- [createCtx](_reatom_core.md#markdown-header-createctx)
- [createStore](_reatom_core.md#markdown-header-createstore)
- [declareAction](_reatom_core.md#markdown-header-declareaction)
- [declareAtom](_reatom_core.md#markdown-header-declareatom)
- [getDepsShape](_reatom_core.md#markdown-header-getdepsshape)
- [getIsAction](_reatom_core.md#markdown-header-getisaction)
- [getIsAtom](_reatom_core.md#markdown-header-getisatom)
- [getName](_reatom_core.md#markdown-header-getname)
- [getOwnKeys](_reatom_core.md#markdown-header-getownkeys)
- [getState](_reatom_core.md#markdown-header-getstate)
- [getTree](_reatom_core.md#markdown-header-gettree)
- [map](_reatom_core.md#markdown-header-map)
- [nameToId](_reatom_core.md#markdown-header-nametoid)
- [nameToIdDefault](_reatom_core.md#markdown-header-nametoiddefault)
- [noop](_reatom_core.md#markdown-header-noop)
- [safetyFunc](_reatom_core.md#markdown-header-safetyfunc)
- [safetyStr](_reatom_core.md#markdown-header-safetystr)
- [setNameToId](_reatom_core.md#markdown-header-setnametoid)
- [throwError](_reatom_core.md#markdown-header-throwerror)

## References

### Action

• **Action**:

---

### ActionCreator

• **ActionCreator**:

---

### ActionType

• **ActionType**:

---

### Atom

• **Atom**:

---

### BaseActionCreator

• **BaseActionCreator**:

---

### GenId

• **GenId**:

---

### InferType

• **InferType**:

---

### PayloadActionCreator

• **PayloadActionCreator**:

---

### Reaction

• **Reaction**:

---

### Store

• **Store**:

---

### TreeId

• **TreeId**:

---

### Unit

• **Unit**:

---

### combine

• **combine**:

---

### createStore

• **createStore**:

---

### declareAction

• **declareAction**:

---

### declareAtom

• **declareAtom**:

---

### getDepsShape

• **getDepsShape**:

---

### getIsAction

• **getIsAction**:

---

### getIsAtom

• **getIsAtom**:

---

### getState

• **getState**:

---

### getTree

• **getTree**:

---

### initAction

• **initAction**:

---

### map

• **map**:

---

### nameToIdDefault

• **nameToIdDefault**:

---

### noop

• **noop**:

---

### setNameToId

• **setNameToId**:

## Type aliases

### Action

Ƭ **Action**: _[BaseAction](_reatom_core.md#markdown-header-baseaction)‹Payload› & object_

---

### ActionCreator

Ƭ **ActionCreator**: _[BaseActionCreator](_reatom_core.md#markdown-header-baseactioncreator)‹Type› & function_

---

### ActionType

Ƭ **ActionType**: _[Leaf](_reatom_core.md#markdown-header-leaf)_

---

### BaseAction

Ƭ **BaseAction**: _object_

#### Type declaration:

- **payload**: _T_

- **type**: _[Leaf](_reatom_core.md#markdown-header-leaf)_

---

### BaseActionCreator

Ƭ **BaseActionCreator**: _object & [Unit](_reatom_core.md#markdown-header-unit)_

---

### Ctx

Ƭ **Ctx**: _ReturnType‹typeof createCtx›_

---

### Fn

Ƭ **Fn**: _object_

#### Type declaration:

▸ (`ctx`: [Ctx](_reatom_core.md#markdown-header-ctx)): _any_

**Parameters:**

| Name  | Type                                       |
| ----- | ------------------------------------------ |
| `ctx` | [Ctx](_reatom_core.md#markdown-header-ctx) |

- **\_ownerAtomId**: _[TreeId](_reatom_core.md#markdown-header-treeid)_

---

### GenId

Ƭ **GenId**: _function_

#### Type declaration:

▸ (`name`: string | [string] | symbol): _[TreeId](_reatom_core.md#markdown-header-treeid)_

**Parameters:**

| Name   | Type                                 |
| ------ | ------------------------------------ |
| `name` | string &#124; [string] &#124; symbol |

---

### InferType

Ƭ **InferType**: _T extends Atom<infer R> | PayloadActionCreator<infer R> ? R : never_

Helper for retrieving the data type used in an atom or action

**`example`**
type MyAtomType = InferType<typeof myAtom>
type MyActionType = InferType<typeof myAction>

---

### Leaf

Ƭ **Leaf**: _string_

---

### NonUndefined

Ƭ **NonUndefined**: _Exclude‹T, undefined›_

---

### PayloadActionCreator

Ƭ **PayloadActionCreator**: _[BaseActionCreator](_reatom_core.md#markdown-header-baseactioncreator)‹Type› & function_

---

### Reaction

Ƭ **Reaction**: _function_

#### Type declaration:

▸ (`payload`: T, `store`: [Store](_reatom_core.md#markdown-header-store)): _any_

**Parameters:**

| Name      | Type                                           |
| --------- | ---------------------------------------------- |
| `payload` | T                                              |
| `store`   | [Store](_reatom_core.md#markdown-header-store) |

---

### State

Ƭ **State**: _Record‹[TreeId](_reatom_core.md#markdown-header-treeid), unknown›_

---

### Store

Ƭ **Store**: _object_

#### Type declaration:

- **bind**(): _function_

  - <**A**>(`a`: A): _function_

    - (...`a`: A extends function ? Args : never): _void_

- **dispatch**(): _function_

  - (`action`: [Action](_reatom_core.md#markdown-header-action)‹unknown›): _void_

- **getState**: _GetStateFunction_

- **subscribe**: _SubscribeFunction_

---

### TreeId

Ƭ **TreeId**: _string | symbol_

---

### Unit

Ƭ **Unit**: _object_

#### Type declaration:

- **\_\_computed**: _[Tree](../classes/_reatom_core.tree.md)_

## Variables

### `Const` TREE

• **TREE**: _unique symbol_ = Symbol('@@Reatom/TREE')

---

### `Const` assign

• **assign**: _assign_ = Object.assign

---

### `Const` equals

• **equals**: _is_ = Object.is

---

### `Const` initAction

• **initAction**: _object & object_ = initActionCreator()

## Functions

### combine

▸ **combine**<**T**>(`shape`: T): _[Atom](../interfaces/_reatom_core.atom.md)‹object›_

**Type parameters:**

▪ **T**: _AtomsMap | TupleOfAtoms_

**Parameters:**

| Name    | Type |
| ------- | ---- |
| `shape` | T    |

**Returns:** _[Atom](../interfaces/_reatom_core.atom.md)‹object›_

▸ **combine**<**T**>(`name`: AtomName, `shape`: T): _[Atom](../interfaces/_reatom_core.atom.md)‹object›_

**Type parameters:**

▪ **T**: _AtomsMap | TupleOfAtoms_

**Parameters:**

| Name    | Type     |
| ------- | -------- |
| `name`  | AtomName |
| `shape` | T        |

**Returns:** _[Atom](../interfaces/_reatom_core.atom.md)‹object›_

---

### createCtx

▸ **createCtx**(`state`: [State](_reatom_core.md#markdown-header-state), `__namedParameters`: object): _object_

**Parameters:**

▪ **state**: _[State](_reatom_core.md#markdown-header-state)_

▪ **\_\_namedParameters**: _object_

| Name      | Type   |
| --------- | ------ |
| `payload` | any    |
| `type`    | string |

**Returns:** _object_

- **changedIds**: _string | symbol[]_ = [] as TreeId[]

- **payload**: _any_

- **state**(): _object_

- **stateNew**(): _object_

- **type**: _string_

---

### createStore

▸ **createStore**(`initState?`: [State](_reatom_core.md#markdown-header-state)): _[Store](_reatom_core.md#markdown-header-store)_

**Parameters:**

| Name         | Type                                           |
| ------------ | ---------------------------------------------- |
| `initState?` | [State](_reatom_core.md#markdown-header-state) |

**Returns:** _[Store](_reatom_core.md#markdown-header-store)_

▸ **createStore**(`atom`: [Atom](../interfaces/_reatom_core.atom.md)‹any›, `initState?`: [State](_reatom_core.md#markdown-header-state)): _[Store](_reatom_core.md#markdown-header-store)_

**Parameters:**

| Name         | Type                                            |
| ------------ | ----------------------------------------------- |
| `atom`       | [Atom](../interfaces/_reatom_core.atom.md)‹any› |
| `initState?` | [State](_reatom_core.md#markdown-header-state)  |

**Returns:** _[Store](_reatom_core.md#markdown-header-store)_

---

### declareAction

▸ **declareAction**(`name?`: string | [Reaction](_reatom_core.md#markdown-header-reaction)‹undefined›, ...`reactions`: [Reaction](_reatom_core.md#markdown-header-reaction)‹undefined›[]): _[ActionCreator](_reatom_core.md#markdown-header-actioncreator)‹string›_

**Parameters:**

| Name           | Type                                                                          |
| -------------- | ----------------------------------------------------------------------------- |
| `name?`        | string &#124; [Reaction](_reatom_core.md#markdown-header-reaction)‹undefined› |
| `...reactions` | [Reaction](_reatom_core.md#markdown-header-reaction)‹undefined›[]             |

**Returns:** _[ActionCreator](_reatom_core.md#markdown-header-actioncreator)‹string›_

▸ **declareAction**<**Type**>(`name`: [Type], ...`reactions`: [Reaction](_reatom_core.md#markdown-header-reaction)‹undefined›[]): _[ActionCreator](_reatom_core.md#markdown-header-actioncreator)‹Type›_

**Type parameters:**

▪ **Type**: _[ActionType](_reatom_core.md#markdown-header-actiontype)_

**Parameters:**

| Name           | Type                                                              |
| -------------- | ----------------------------------------------------------------- |
| `name`         | [Type]                                                            |
| `...reactions` | [Reaction](_reatom_core.md#markdown-header-reaction)‹undefined›[] |

**Returns:** _[ActionCreator](_reatom_core.md#markdown-header-actioncreator)‹Type›_

▸ **declareAction**<**Payload**>(`name?`: string | [Reaction](_reatom_core.md#markdown-header-reaction)‹Payload›, ...`reactions`: [Reaction](_reatom_core.md#markdown-header-reaction)‹Payload›[]): _[PayloadActionCreator](_reatom_core.md#markdown-header-payloadactioncreator)‹Payload, string›_

**Type parameters:**

▪ **Payload**

**Parameters:**

| Name           | Type                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| `name?`        | string &#124; [Reaction](_reatom_core.md#markdown-header-reaction)‹Payload› |
| `...reactions` | [Reaction](_reatom_core.md#markdown-header-reaction)‹Payload›[]             |

**Returns:** _[PayloadActionCreator](_reatom_core.md#markdown-header-payloadactioncreator)‹Payload, string›_

▸ **declareAction**<**Payload**, **Type**>(`name`: [Type], ...`reactions`: [Reaction](_reatom_core.md#markdown-header-reaction)‹Payload›[]): _[PayloadActionCreator](_reatom_core.md#markdown-header-payloadactioncreator)‹Payload, Type›_

**Type parameters:**

▪ **Payload**

▪ **Type**: _[ActionType](_reatom_core.md#markdown-header-actiontype)_

**Parameters:**

| Name           | Type                                                            |
| -------------- | --------------------------------------------------------------- |
| `name`         | [Type]                                                          |
| `...reactions` | [Reaction](_reatom_core.md#markdown-header-reaction)‹Payload›[] |

**Returns:** _[PayloadActionCreator](_reatom_core.md#markdown-header-payloadactioncreator)‹Payload, Type›_

---

### declareAtom

▸ **declareAtom**<**TState**>(`initialState`: TState, `dependencyMatcher`: DependencyMatcher‹TState›): _[Atom](../interfaces/_reatom_core.atom.md)‹TState›_

To declare atom:

```
var x = declareAtom()
```

```typescript
const x = declareAtom()
```

**Type parameters:**

▪ **TState**

**Parameters:**

| Name                | Type                      |
| ------------------- | ------------------------- |
| `initialState`      | TState                    |
| `dependencyMatcher` | DependencyMatcher‹TState› |

**Returns:** _[Atom](../interfaces/_reatom_core.atom.md)‹TState›_

▸ **declareAtom**<**TState**>(`name`: AtomName, `initialState`: TState, `dependencyMatcher`: DependencyMatcher‹TState›): _[Atom](../interfaces/_reatom_core.atom.md)‹TState›_

To declare atom with atom name:

```js
var x = declareAtom()
```

```typescript
const x = declareAtom()
```

**Type parameters:**

▪ **TState**

**Parameters:**

| Name                | Type                      |
| ------------------- | ------------------------- |
| `name`              | AtomName                  |
| `initialState`      | TState                    |
| `dependencyMatcher` | DependencyMatcher‹TState› |

**Returns:** _[Atom](../interfaces/_reatom_core.atom.md)‹TState›_

---

### getDepsShape

▸ **getDepsShape**(`thing`: [Atom](../interfaces/_reatom_core.atom.md)‹any›): _AtomsMap | TupleOfAtoms | undefined_

**Parameters:**

| Name    | Type                                            |
| ------- | ----------------------------------------------- |
| `thing` | [Atom](../interfaces/_reatom_core.atom.md)‹any› |

**Returns:** _AtomsMap | TupleOfAtoms | undefined_

---

### getIsAction

▸ **getIsAction**(`thing`: any): _thing is Atom<any>_

**Parameters:**

| Name    | Type |
| ------- | ---- |
| `thing` | any  |

**Returns:** _thing is Atom<any>_

---

### getIsAtom

▸ **getIsAtom**(`thing`: any): _thing is Atom<any>_

**Parameters:**

| Name    | Type |
| ------- | ---- |
| `thing` | any  |

**Returns:** _thing is Atom<any>_

---

### getName

▸ **getName**(`treeId`: [TreeId](_reatom_core.md#markdown-header-treeid)): _string_

**Parameters:**

| Name     | Type                                             |
| -------- | ------------------------------------------------ |
| `treeId` | [TreeId](_reatom_core.md#markdown-header-treeid) |

**Returns:** _string_

---

### getOwnKeys

▸ **getOwnKeys**<**T**>(`obj`: T): _Array‹keyof T›_

**Type parameters:**

▪ **T**: _object_

**Parameters:**

| Name  | Type |
| ----- | ---- |
| `obj` | T    |

**Returns:** _Array‹keyof T›_

---

### getState

▸ **getState**<**T**>(`state`: [State](_reatom_core.md#markdown-header-state), `atom`: [Atom](../interfaces/_reatom_core.atom.md)‹T›): _T | undefined_

**Type parameters:**

▪ **T**

**Parameters:**

| Name    | Type                                           |
| ------- | ---------------------------------------------- |
| `state` | [State](_reatom_core.md#markdown-header-state) |
| `atom`  | [Atom](../interfaces/_reatom_core.atom.md)‹T›  |

**Returns:** _T | undefined_

---

### getTree

▸ **getTree**(`thing`: [Unit](_reatom_core.md#markdown-header-unit)): _[Tree](../classes/_reatom_core.tree.md)_

**Parameters:**

| Name    | Type                                         |
| ------- | -------------------------------------------- |
| `thing` | [Unit](_reatom_core.md#markdown-header-unit) |

**Returns:** _[Tree](../classes/_reatom_core.tree.md)_

---

### map

▸ **map**<**T**, **TSource**>(`source`: [Atom](../interfaces/_reatom_core.atom.md)‹TSource›, `mapper`: function): _[Atom](../interfaces/_reatom_core.atom.md)‹T›_

**Type parameters:**

▪ **T**

▪ **TSource**

**Parameters:**

▪ **source**: _[Atom](../interfaces/_reatom_core.atom.md)‹TSource›_

▪ **mapper**: _function_

▸ (`dependedAtomState`: TSource): _[NonUndefined](_reatom_core.md#markdown-header-nonundefined)‹T›_

**Parameters:**

| Name                | Type    |
| ------------------- | ------- |
| `dependedAtomState` | TSource |

**Returns:** _[Atom](../interfaces/_reatom_core.atom.md)‹T›_

▸ **map**<**T**, **TSource**>(`name`: AtomName, `source`: [Atom](../interfaces/_reatom_core.atom.md)‹TSource›, `mapper`: function): _[Atom](../interfaces/_reatom_core.atom.md)‹T›_

**Type parameters:**

▪ **T**

▪ **TSource**

**Parameters:**

▪ **name**: _AtomName_

▪ **source**: _[Atom](../interfaces/_reatom_core.atom.md)‹TSource›_

▪ **mapper**: _function_

▸ (`dependedAtomState`: TSource): _[NonUndefined](_reatom_core.md#markdown-header-nonundefined)‹T›_

**Parameters:**

| Name                | Type    |
| ------------------- | ------- |
| `dependedAtomState` | TSource |

**Returns:** _[Atom](../interfaces/_reatom_core.atom.md)‹T›_

---

### nameToId

▸ **nameToId**(`name`: string | [string] | symbol): _[TreeId](_reatom_core.md#markdown-header-treeid)_

**Parameters:**

| Name   | Type                                 |
| ------ | ------------------------------------ |
| `name` | string &#124; [string] &#124; symbol |

**Returns:** _[TreeId](_reatom_core.md#markdown-header-treeid)_

---

### nameToIdDefault

▸ **nameToIdDefault**(`name`: string | [string] | symbol): _[TreeId](_reatom_core.md#markdown-header-treeid)_

**Parameters:**

| Name   | Type                                 |
| ------ | ------------------------------------ |
| `name` | string &#124; [string] &#124; symbol |

**Returns:** _[TreeId](_reatom_core.md#markdown-header-treeid)_

---

### noop

▸ **noop**(): _void_

**Returns:** _void_

---

### safetyFunc

▸ **safetyFunc**<**T**>(`func`: T | undefined, `name`: string): _T_

**Type parameters:**

▪ **T**: _Function_

**Parameters:**

| Name   | Type               |
| ------ | ------------------ |
| `func` | T &#124; undefined |
| `name` | string             |

**Returns:** _T_

---

### safetyStr

▸ **safetyStr**(`str`: string, `name`: string): _string_

**Parameters:**

| Name   | Type   |
| ------ | ------ |
| `str`  | string |
| `name` | string |

**Returns:** _string_

---

### setNameToId

▸ **setNameToId**(`gen`: [GenId](_reatom_core.md#markdown-header-genid)): _void_

**Parameters:**

| Name  | Type                                           |
| ----- | ---------------------------------------------- |
| `gen` | [GenId](_reatom_core.md#markdown-header-genid) |

**Returns:** _void_

---

### throwError

▸ **throwError**(`error`: string): _void_

**Parameters:**

| Name    | Type   |
| ------- | ------ |
| `error` | string |

**Returns:** _void_
