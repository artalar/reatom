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
  const counterAtom = declareAtom(
    // initial state
    0,
    // callback for creating
    // list of dependencies and their transformations
    on => [on(increment, state => state + 1)],
  )

  const store = createStore(counterAtom)
  let counterState = store.getState(counterAtom)
  expect(counterState).toBe(0)

  store.dispatch(increment())
  store.dispatch(increment())
  counterState = store.getState(counterAtom)
  expect(counterState).toBe(2)
})
```

### Derived (computed) atoms

```js
test("derived (computed) atoms", () => {
  const increment = declareAction();
  const counterAtom = declareAtom(0, on => [on(increment, state => state + 1)]);
  const counterDoubledAtom = map(counterAtom, value => value * 2);
  const countersShapeAtom = combine([counterAtom, counterDoubledAtom]);

  const store = createStore(countersShapeAtom);

  store.dispatch(increment());
  expect(store.getState(counterAtom)).toBe(1);
  expect(store.getState(counterDoubledAtom)).toBe(2);
  expect(store.getState(countersShapeAtom)).toEqual([1, 2]);
});

```

### Side effects

```js
test("side effects", async () => {
  const setValue = declareAction();
  let lastCallId = 0;
  const setValueConcurrent = declareAction(async (action, store) => {
    const incrementCallId = lastCallId++;
    await delay(1000);
    if (incrementCallId === lastCallId) store.dispatch(setValue());
  });
  const valueAtom = declareAtom(0, on => [
    on(setValue, (state, payload) => payload)
  ]);

  const store = createStore(valueAtom);

  store.dispatch(setValue(1));
  expect(store.getState(valueAtom)).toBe(1);

  store.dispatch(setValueConcurrent(2));
  expect(store.getState(valueAtom)).toBe(1);
  await delay(1000);
  expect(store.getState(valueAtom)).toBe(2);

  store.dispatch(setValueConcurrent(3));
  store.dispatch(setValueConcurrent(4));
  store.dispatch(setValueConcurrent(5));
  expect(store.getState(valueAtom)).toBe(2);
  await delay(1000);
  expect(store.getState(valueAtom)).toBe(5);
});

```

### Todo-list

> Beware, it is _enterprise_-like example with feature-driven structure, normalization and other not _entry_ abstractions. Simpler examples will be added later

[![Todo-list](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/reatom-todo-app-fikvf)

---

Next:

> - <a href="https://artalar.github.io/reatom/#/faq">FAQ</a>
