## Action

Action is the intention to change the state. Declared action is a function that returns [flux standard action](https://github.com/redux-utilities/flux-standard-action):

```js
import { declareAction } from '@reatom/core'

const increment = declareAction()
// usage
store.dispatch(increment())
// tests
const stateNew = myAtom(stateOld, increment())
```

> **NOTE**. See FAQ on [why declare\*](/faq?id=why-declare)

### Action payload

Declared action is a function that accepts payload as the first argument and returns object (action to store dispatcher) with shape: `{ type, payload }`.

```js
const add = declareAction()

console.log(add(123))
// { type: 'action #1', payload: 123 }
```

### Action type

If you want to describe action name at the time of actions declaring (for debugging), you can pass it as a first argument.

```js
const workflowIntention = declareAction('my workflow name')

console.log(workflowIntention())
// { type: 'my workflow name #1', payload: undefined }
```

If you want to specify exact action type (from other library) you can pass it as an array containing one string item (tuple).

```js
const locationChange = declareAction(['@@router/LOCATION_CHANGE'])

console.log(locationChange())
// { type: '@@router/LOCATION_CHANGE', payload: undefined }
```

### Action reactions

Reatom includes something like a built-in [Thunk](https://github.com/reduxjs/redux-thunk) - just pass a side-effect to action declaration:

```js
const fetchUserDone = declareAction()
const fetchUser = declareAction(
  name, // or type - optional
  (payload, store) =>
    fetch('/user', payload).then((response) =>
      store.dispatch(fetchUserDone(response)),
    ),
)

// will call `fetch('/user', payload)`
store.dispatch(fetchUser(userId))
```

It is better than `redux-thunk`, because you can inspect the action with side-effect and it's payload in a subscription log or in a [devtools](https://reatom.js.org/#/packages/debug?id=redux-devtools).

Commonly Reatom, inspiring by Redux, is simply and reactively describing application data-model and not providing extra methods for manage complex side-effect. You still can use reactions (see above) to describe all asynchronous workflow of your application, but if you want more future tools you can reuse packages from redux ecosystem, like [redux-saga](https://redux-saga.js.org) or [redux-observable](https://redux-observable.js.org). [Here you can find an example](https://reatom.js.org/#/guides/migration-from-redux?id=for-redux-saga-users) how to do it with `redux-saga`.

## Atom

Atoms\* are state**less** instructions that calculate derived state in the right order (without [glitches](https://en.wikipedia.org/wiki/Reactive_programming#Glitches)).

> For redux users: **atom unifying reducer and selector to a one entity.**

Atom reducers may depend on declared action or other atoms and must be pure functions that return a new immutable version of the state. If a reducer returns an old state – depended atoms and subscribers will not be triggered.

```js
import { declareAtom } from '@reatom/core'

const countAtom = declareAtom(
  'count', // name (optional!)
  0, // initial state
  (on) => [
    // reducers definitions:
    // `on(dependedDeclaredActionOrAtom, reducer)`
    // reducer: (oldState, dependedValues) => newState
    on(increment, (state) => state + 1),
    on(add, (state, payload) => state + payload),
  ],
)
const countDoubledAtom = declareAtom(0, (on) => [
  on(countAtom, (state, count) => count * 2),
])
// shortcut:
// const countDoubledAtom = map(count, count => count * 2)
```

One of the most powerfull and complicated feature of atoms is it state's lifetime - [read below](https://reatom.js.org/#/glossary?id=states-laziness).

> [\*](https://github.com/calmm-js/kefir.atom/blob/master/README.md#related-work) The term "atom" is borrowed from [Clojure](http://clojure.org/reference/atoms) and comes from the idea that one only performs ["atomic"](https://en.wikipedia.org/wiki/Read-modify-write), or [race-condition](https://en.wikipedia.org/wiki/Race_condition) free, operations on individual atoms. Besides that reatoms atoms is stateless and seamlessly like [Futures](https://en.wikipedia.org/wiki/Futures_and_promises) in this case.

> See FAQ on [why declare\*](/faq?id=why-declare)

### Dynamic initial state

If you need to dynamically generate atom state (on subscription) you can derive it from `init` action

> see [tests](https://github.com/artalar/reatom/pull/326/files#diff-f212137c77c45e774722b9be132e9dc7)

```js
import { init } from '@reatom/core'

const dateAtom = declareAtom(Date.now(), (on) => [on(init, () => Date.now())])
```

> **NOTE**. See FAQ on [why declare\*](/faq?id=why-declare)

## Store

Communicating state**ful** context between actions and atoms.

```js
import { createStore } from '@reatom/core'

/* CREATION */

const store = createStore(
  atom, // optional
  preloadedState, // optional
)

/* DISPATCHING */

store.dispatch(action)
store.dispatch(declaredAction())
store.dispatch(declaredAction(payload))

/* SUBSCRIBING */

store.subscribe(atom, (atomValue) => 'side effect')
store.subscribe(declaredAction, (actionPayload) => 'side effect')
store.subscribe((dispatchedAction, stateDiff) => 'side effect')

/* STATE */

store.getState() // clone state snapshot
store.getState(atom) // atom state

/* BINDING */

const declaredActionBinded = store.bind(declaredAction)

declaredAction(0) // `{ type: '...', payload: 0 }`
declaredActionBinded(0) // dispatching, void
```

### States laziness

Atom never has it's own state. Only store contains states of all known atoms. How store can know about atoms? In two ways: 1) you passing combining of all needed atoms as an argument to createStore; 2) you creating a subscription to the atom. In first way, passed atom and it's dependencies create states that will live in store forever, so you can always get it by `store.getState(myAtom)`. In second way, subscription to atom creating a temporal (seems like a cold / lazy observable) state to atom and it's dependencies in store, which will be deleted after all depended unsubscribes.

Important note about `getState(myAtom)`, dependent of atom status:

- If atom state is already in the store (by store creation or subscription) - returns it state.
- Else if atom has a dependencies that has state in store context - returns recalculated state based on it dependencies states.
- Else returns atom default state.

---

> **Next:**
>
> - <a href="https://reatom.js.org/#/examples">Examples</a>
> - <a href="https://reatom.js.org/#/faq">FAQ</a>
> - Guides
>   - <a href="https://reatom.js.org/#/guides/naming-conventions.md">Naming Conventions</a>
>   - <a href="https://reatom.js.org/#/guides/file-structure.md">File Structure</a>
>   - <a href="https://reatom.js.org/#/guides/code-splitting.md">Code Splitting</a>
>   - <a href="https://reatom.js.org/#/guides/server-side-rendering.md">Server Side Rendering</a>
>   - <a href="https://reatom.js.org/#/guides/migration-from-redux.md">Migration from Redux</a>
>   - <a href="https://reatom.js.org/#/guides/IoC.md">Inversion of control</a>
