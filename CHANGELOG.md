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
