# useAtom

Added in: v1.0.0

```js
import { useAction } from '@reatom/react'
```

## Description

React Hook for connects the atom to the store provided in context and returns the state of the atom from the store (or default atom state).

## Signature

### useAtom(atom, selector?, deps?)

**Arguments**
- atom [`Atom`](../core/Atom.md) - required
- selector `Function` - optional
- deps `Array` - optional

**Returns** [`AtomState`](../core/AtomState.md)

## Examples

Basic
```js
const products = useAtom(productsAtom)
```

With selector
```js
const product = useAtom(productsAtom, state => state[id], [id])
```
