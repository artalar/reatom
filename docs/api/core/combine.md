# combine

Added in: v1.0.0

```js
import { combine } from '@reatom/core'
```

## Description

A function to combine several atoms into one.

## Signature

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

## Examples

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
