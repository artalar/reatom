## Installation

```sh
npm i @reatom/core
# or
yarn add @reatom/core
```

## Usage

Public API:

```js
import {
  declareAction,
  declareAtom,
  map,
  combine,
  createStore,
} from '@reatom/core'
```

Example:

```js
const increment = declareAction()
const add = declareAction()

const countAtom = declareAtom(
  1,
  on => [
    on(increment, state => state + 1),
    on(add, (state, payload) => state + payload),
  ]
)
const isOddAtom = declareAtom(
  false,
  on => [
    on(countAtom, (state, count) => Boolean(count % 2)),
  ]
)
// shortcut: `isOddAtom = map(countAtom, count => Boolean(count % 2))`

const rootAtom = combine({ count: countAtom, isOdd: isOddAtom })

const store = createStore(rootAtom)

//

store.subscribe(countAtom, count => console.log('count: ', count))
store.subscribe(isOddAtom, isOdd => console.log('isOdd: ', isOdd))

store.dispatch(increment())
// 'count: 2'
// 'isOdd: true'

store.dispatch(add(4))
// 'count: 6'
// 'isOdd: false'

store.dispatch(add(2))
// 'count: 8'
// here `isOdd` subscriber will not be called because its value is not changes
```

## Glossary

### Action

#### Action is intention to state changing

Declared action is a function thats return [flux standard action](https://github.com/redux-utilities/flux-standard-action):

```js
const increment = declareAction()
// usage
store.dispatch(increment())
// tests
const stateNew = countAtom(stateOld, increment())
```

#### Action payload

Declared action is a function that accept payload by first argument and return object (action to store dispatcher) with shape: `{ type, payload }`.

```js
const add = declareAction()

console.log(add(123))
// { type: 'action #1', payload: 123 }
```

#### Action name

If you want to describe action name at the type (for debugging) you can paste it at first argument by a string.

```js
const workflowIntention = declareAction('my workflow name')

console.log(workflowIntention())
// { type: 'my workflow name #1', payload: undefined }
```

#### Action type

If you want to specify exact action type (from other library) you can paste it at first argument by a tuple of one item (string).

```js
const routAtom = declareAtom(
  {},
  on => [
    on(declareAction(['@@router/LOCATION_CHANGE']), (state, payload) => payload),
  ]
)
```

#### Action reactions

```js
const fetchUserDone = declareAction()
const fetchUser = declareAction(
  name, // optional
  (store, payload) => fetch('/user', payload)
    .then(response => store.dispatch(fetchUserDone(response)))
)

// will call `fetch('/user', payload)`
store.dispatch(fetchUser(userId))
```

### Atom

Atom\* is state**less** instructions for calculate derived state with right order (without [glitches](https://stackoverflow.com/questions/25139257/terminology-what-is-a-glitch-in-functional-reactive-programming-rx)).

Atom reducers may depend from declared action or other atom and must be a pure function thats returns new immutable version of state. If reducer return old state - depended atoms and subscribers will not triggered.

> [\*](https://github.com/calmm-js/kefir.atom/blob/master/README.md#related-work) The term "atom" is borrowed from [Clojure](http://clojure.org/reference/atoms) and comes from the idea that one only performs ["atomic"](https://en.wikipedia.org/wiki/Read-modify-write), or [race-condition](https://en.wikipedia.org/wiki/Race_condition) free, operations on individual atoms. Besides that reatoms atoms is stateless and seamlessly like [Futures](https://en.wikipedia.org/wiki/Futures_and_promises) in this case.

```js
const countAtom = declareAtom(
  'count',     // name (optional!)
  0,           // initial state
  on => [      // reducers definitions
  //on(dependedDeclaredActionOrAtom, reducer)
  //reducer: (oldState, dependedValues) => newState
    on(increment, state => state + 1)
    on(add, (state, payload) => state + payload)
  ]
)
const countDoubledAtom = declareAtom(
  0,
  on => [on(countAtom, (state, count) => count * 2)]
)
// shortcut:
const countDoubledAtom = map(count, count => count * 2)
```

### Store

Communicating state**ful** context between actions and atoms.

```js
const store = createStore(
  atom, // optional
  preloadedState, // optional
)
```

---

Next:

> - <a href="https://artalar.github.io/reatom/#/examples">Examples</a>
> - <a href="https://artalar.github.io/reatom/#/faq">FAQ</a>
