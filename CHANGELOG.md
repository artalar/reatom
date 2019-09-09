## 1.0.0-rc10

Add `getIsAction` and `getIsAtom` to public API

## 1.0.0-rc6

Rewrite core, remove domains as unnecessary (now).

## 1.0.0

`flaxom` -> `reatom`

`createAction` -> `declareAction`

`createAtom` -> `declareAtom`

## 4.0.0

Core improvements and bugs fixes...

(!) Move to **REAtom** package (!)

## 3.0.10

Improve API naming
> `createReducer` -> `createAtom`

## 3.0.9

Add warning for production

## 3.0.8

Update readme

## 3.0.0 - 3.0.7

Improve edge-cases for [store] lazy reducers

## 3.0.0

New API for best static type inference

```js
createReducer(
  'name',
  initialState,
  handle => [
    handle(action, (state, payload) => ...)
    handle(reducer1, (state, reducer1State) => ...)
  ],
)
```

## 2.0.0

`redux-steroid` -> `flaxom`

## 1.7.0

- Improve `store.getState()` API (getState without arguments now equal `getStateInternal`)
- Add `asId` API for strict declaration of ActionTypes and Ids (useful for snapshots)
- Add middleware to store

## 1.6.0

- Add lazy reducers to createStore

## 1.5.0

- Rewrite core - improve bundle size and performance

## 1.4.0

- Add `createStore` - a half compatible **redux**-like API
