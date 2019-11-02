# Store

Store is communicating stateful context between actions and atoms.

## Interface

```ts
type Unsubscriber = () => void
type StoreState = Record<string, any>

interface Store {
  getState(): StoreState,
  getState(atom: Atom): AtomState,

  subscribe(subscriber: ActionsSubsriber): Unsubscriber
  subscribe(atom: Atom, subscriber: AtomSubscriber): Unsubscriber

  dispatch(action: Action): void
}
```

## getState

Getting full store state
```js
store.getState()
```

Getting atom state from store
```js
store.getState(myAtom)
```

## subscribe

Subsctibe to the actions
```js
store.subscribe(action => {})
```

Subsctibe to the state
```js
store.subscribe(myAtom, state => {})
```

## dispatch

Dispatching actions to the store
```js
store.dispatch(myAction())
```
