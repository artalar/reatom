# declareAtom

Added in: v1.0.0

```js
import { declareAtom } from '@reatom/core'
```

## Description

Function to create an atom Declaration.

## Signature

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

## Examples

Basic

```js
const myList = declareAtom([], on => [ 
  on(addItem, (state, payload) => [...state, payload])
])
```

With name

```js
const myList = declareAtom('products', [], on => [ 
  on(addItem, (state, payload) => [...state, payload])
])
```

With static name

```js
const myList = declareAtom(['products'], [], on => [ 
  on(addItem, (state, payload) => [...state, payload])
])
```
