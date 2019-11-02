# map

Added in: v1.0.0

```js
import { map } from '@reatom/core'
```

## Description

A function to create derived atoms by the required data format.

## Signature

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

## Examples

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
