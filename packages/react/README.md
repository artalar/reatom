@bem-react/react
Package for bindings Reatom store with React


## Install

Yarn
```
yarn add @reatom/react
```

NPM
```
npm i -S @reatom/react
```

## Usage

### Step 1. Create store
```tsx
import React, { FC } from 'react';
import { createStore } from '@reatom/core'
import { context } from '@reatom/react'

import './App.css';

export const App: FC = () => {
  // Create root entry point for all atoms
  const store = createStore(null);

  return (
    <div className="App">
    </div>
  );
}
```

### Step 2. Connect atom in component

```tsx
const increment = declareAction()
const decrement = declareAction()

const CounterAtom = declareAtom(0, reduce => [
  reduce(increment, state => state + 1)
  reduce(decrement, state => state - 1)
])

const Counter: FC = () => {
  const count = useAtom(CounterAtom)
  const doIncrement = useAction(increment)
  const doDecrement = useAction(decrement)

  return (
    <div>
      <button key='decrement'>-</button>
      {count}
      <button key='increment'>+</button>
    </div>
  )
}
```