## Installation

```sh
npm i flaxom
# or
yarn add flaxom
```

## Usage

```javascript
import {
  createActionCreator,
  createAtom,
  map,
  combine,
  createStore,
} from 'flaxom'
```

## Glossary

### Action

[Action](https://github.com/redux-utilities/flux-standard-action) is intention to state changing.

```javascript
const increment = createActionCreator(
  'increment', // (optional!) name
  mapper, // (optional?) mapper for transform payload
)
const add = createActionCreator()
```

### Atom

Atom\* is state**less** instructions for calculate derived state with right order (without [glitches](https://stackoverflow.com/questions/25139257/terminology-what-is-a-glitch-in-functional-reactive-programming-rx)).

Atom reducers may depend from `actionCreator` or other `atom` and must be a pure function thats returns new immutable version of state. If reducer return old state - depended atoms and subscribers will not triggered.

> [\*](https://github.com/calmm-js/kefir.atom/blob/master/README.md#related-work) The term "atom" is borrowed from [Clojure](http://clojure.org/reference/atoms) and comes from the idea that one only performs ["atomic"](https://en.wikipedia.org/wiki/Read-modify-write), or [race-condition](https://en.wikipedia.org/wiki/Race_condition) free, operations on individual atoms.

```javascript
const count = createAtom(
  'count',     // name (optional!)
  0,           // initial state
  reduce => [  // reducers definitions
  //reduce(dependedActionCreatorOrAtom, reducer)
  //reducer: (oldState, dependedValues) => newState
    reduce(increment, state => state + 1)
    reduce(add, (state, payload) => state + payload)
  ]
)
const countDoubled = createAtom(
  0,
  reduce => [reduce(count, (state, count) => count * 2)]
)
// shortcut:
const countDoubled = map(count, count => count * 2)
```

### Store

Communicating state**ful** context between actions and atoms.

---

Next:

> - <a href="/#/Examples">Examples</a>
> - <a href="/#/FAQ">FAQ</a>
