# declareAction

Added in: v1.0.0

```js
import { declareAction } from '@reatom/core'
```

## Description

A function to create the Declaration of the action.

## Signature

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

## Examples

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
