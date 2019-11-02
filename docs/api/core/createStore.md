# createStore

Added in: v1.0.0

```js
import { createStore } from '@reatom/core'
```

## Description

Function to create a store.

## Signature

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

## Examples

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
