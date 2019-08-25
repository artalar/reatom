## Installation

```sh
npm i @reatom/core
# or
yarn add @reatom/core
```

## Usage

```javascript
import {
  declareAction,
  declareAtom,
  map,
  combine,
  createStore,
} from '@reatom/core'
```

## Examples

> **[Tests](src/__tests__/examples/counter.ts)**

### Simple counter

```js
test('simple counter', () => {
  const increment = declareAction()
  const counter = declareAtom(
    // initial state
    0,
    // callback for creating
    // list of dependencies and their transformations
    reduce => [reduce(increment, state => state + 1)],
  )

  const store = createStore(counter)
  let counterState = store.getState(counter)
  expect(counterState).toBe(0)

  store.dispatch(increment())
  store.dispatch(increment())
  counterState = store.getState(counter)
  expect(counterState).toBe(2)
})
```

### Derived (computed) atoms

```js
test('derived (computed) atoms', () => {
  const increment = declareAction()
  const counter = declareAtom(0, reduce => [
    reduce(increment, state => state + 1),
  ])
  const counterDoubled = map(counter, value => value * 2)
  const countersShape = combine({ counter, counterDoubled })

  const store = createStore(countersShape)

  store.dispatch(increment())
  expect(store.getState(counter)).toBe(1)
  expect(store.getState(counterDoubled)).toBe(2)
  expect(store.getState(countersShape)).toEqual({
    counter: 1,
    counterDoubled: 2,
  })
})
```

### Side effects

```js
test('side effects', async () => {
  const doSideEffect = declareAction()
  const increment = declareAction()
  const counter = declareAtom(0, reduce => [
    reduce(increment, state => state + 1),
  ])

  const sideEffect = async action => {
    if (action.type === doSideEffect.getType()) {
      await delay(1000)
      store.dispatch(increment())
    }
  }

  const store = createStore(counter)
  store.subscribe(sideEffect)

  store.dispatch(doSideEffect())
  expect(store.getState(counter)).toBe(0)
  // `store.dispatch(increment())` from `sideEffect`
  await delay(1000)
  expect(store.getState(counter)).toBe(1)
})
```

### Todo-list

> Beware, it is _enterprise_-like example with feature-driven structure, normalization and other not _entry_ abstractions. Simpler examples will be added later

[![Todo-list](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/reatom-todo-app-fikvf)

---

Next:

> - <a href="https://artalar.github.io/reatom/#/faq">FAQ</a>