# context

Added in: v1.0.0

```js
import { context } from '@reatom/react'
```

## Description

Context for Reatom store

## Examples

Basic
```jsx
<context.Provider value={store}>
  <App />
</context.Provider>
```

Getting store

```js
const store = useContext(context)
```
