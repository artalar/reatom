# useAction

Added in: v1.0.0

```js
import { useAction } from '@reatom/react'
```

## Description

React Hook for bind action and dispatch to the store provided in the context.

## Signature

### useAction(actionCreator)

**Arguments**
- actionCreator [`ActionCreator`](../core/ActionCreator) | `() =>`[`Action`](../core/Action)

**Returns** [`ActionCreator`](./../core/ActionCreator)

## Examples

```js
const doIncrement = useAction(increment)
```
