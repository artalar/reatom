## Action

Action is the intention of changing the state. Declared action is a function that returns [flux standard action](https://github.com/redux-utilities/flux-standard-action):

```js
import { declareAction } from '@reatom/core'

const increment = declareAction()
// usage
store.dispatch(increment())
// tests
const stateNew = myAtom(stateOld, increment())
```

> **NOTE**. See FAQ on [why declare*](/faq?id=why-declare)

### Action payload

Declared action is a function that accepts payload as the first argument and returns object (action to store dispatcher) with shape: `{ type, payload }`.

```js
const add = declareAction()

console.log(add(123))
// { type: 'action #1', payload: 123 }
```

### Action type

If you want to describe action name at the time of declaring actions (for debugging), you can pass it as the first argument.

```js
const workflowIntention = declareAction('my workflow name')

console.log(workflowIntention())
// { type: 'my workflow name #1', payload: undefined }
```

If you want to specify exact action type (from other library) you can pass it as an array containing one string item (tuple).

```js
const locationChange = declareAction(['@@router/LOCATION_CHANGE'])

console.log(workflowIntention())
// { type: '@@router/LOCATION_CHANGE', payload: undefined }
```

### Action reactions

```js
const fetchUserDone = declareAction()
const fetchUser = declareAction(
  name, // or type - optional
  (payload, store) => fetch('/user', payload)
    .then(response => store.dispatch(fetchUserDone(response)))
)

// will call `fetch('/user', payload)`
store.dispatch(fetchUser(userId))
```

## Atom

Atoms\* are state**less** instructions to calculate derived state in the right order (without [glitches](https://stackoverflow.com/questions/25139257/terminology-what-is-a-glitch-in-functional-reactive-programming-rx)).

> For redux users: **atom - is a thing that works concomitantly like reducer and selector.**

Atom reducers may depend on declared action or other atoms and must be pure functions that return new immutable version of the state. If a reducer returns old state – depended atoms and subscribers will not be triggered.

> [\*](https://github.com/calmm-js/kefir.atom/blob/master/README.md#related-work) The term "atom" is borrowed from [Clojure](http://clojure.org/reference/atoms) and comes from the idea that one only performs ["atomic"](https://en.wikipedia.org/wiki/Read-modify-write), or [race-condition](https://en.wikipedia.org/wiki/Race_condition) free, operations on individual atoms. Besides that reatoms atoms is stateless and seamlessly like [Futures](https://en.wikipedia.org/wiki/Futures_and_promises) in this case.

```js
import { declareAtom } from '@reatom/core'

const countAtom = declareAtom(
  'count',     // name (optional!)
  0,           // initial state
  on => [      // reducers definitions
  //on(dependedDeclaredActionOrAtom, reducer)
  //reducer: (oldState, dependedValues) => newState
    on(increment, state => state + 1),
    on(add, (state, payload) => state + payload)
  ]
)
const countDoubledAtom = declareAtom(
  0,
  on => [on(countAtom, (state, count) => count * 2)]
)
// shortcut:
// const countDoubledAtom = map(count, count => count * 2)
```
> **NOTE**. See FAQ on [why declare*](/faq?id=why-declare)

## Store

Communicating state**ful** context between actions and atoms.

```js
import { createStore } from '@reatom/core'

const store = createStore(
  atom, // optional
  preloadedState, // optional
)
```

---

Next:

> - <a href="https://artalar.github.io/reatom/#/examples">Examples</a>
> - <a href="https://artalar.github.io/reatom/#/faq">FAQ</a>
