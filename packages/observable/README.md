# @reatom/observable

## Install

```sh
npm install @reatom/observable
# OR
yarn add @reatom/observable
```
## Ussage

```js
import { observe } from '@reatom/observable'
import { declareAtom, declareAction, createStore } from '@reatom/core'

const action = declareAction()
const atom = declareAtom(0, on => [
  on(action, () => 1)
])
const store = createStore(atom)

const observableStore = observe(store)

observableStore.subscribe(action => console.log(action))
// or
const subscription = observableStore.subscribe({
  next(action) {
    console.log(action)
  }
})

subscription.unsubscribe() // unsubscribes

const observableAction = observe(store, action)

observableStore.subscribe(state => console.log(state))
// or
const subscription = observableStore.subscribe({
  next(state) {
    console.log(state)
  }
})

subscription.unsubscribe() // unsubscribes
```
