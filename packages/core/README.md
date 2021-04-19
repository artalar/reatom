<div align="center">
<br/>

[![reatom logo](https://reatom.js.org/logos/logo.svg)](https://github.com/artalar/reatom/tree/v2)

</div>

Reatom is **declarative** state manager, designed for both simple and complex applications.

# @reatom/core

Core package of [Reatom](https://github.com/artalar/reatom) state manager.

[![Reatom bundle size is around 2KB gzip](https://img.shields.io/bundlephobia/minzip/@reatom/core@alpha?style=flat-square)](https://bundlephobia.com/result?p=@reatom/core)
![The license is MIT](https://img.shields.io/github/license/artalar/reatom?style@alpha=flat-square)

## Features

- 🐣 **simple abstraction** and friendly DX: minimum boilerplate and tiny API
- ⚡ **performance**: performant updates for partial state changes
- 🧯 **reliable**: [atomicity](https://en.wikipedia.org/wiki/Atomicity_(database_systems)) guaranties
- ❗️ **static typed**: best type inferences
- 🗜 **small size**: [2 KB](https://bundlephobia.com/result?p=@reatom/core@alpha) gzipped
- 📦 **modular**: reusable instances (SSR)
- 🍴 **lazy**: solution for code splitting out of the box
- 🔌 **framework-agnostic**: independent and self-sufficient
- 🧪 **testing**: simple mocking
- 🛠 **debugging**: immutable data, devtools (redux ecosystem support by adapter)
- 👴 **IE11 support**: [Can I Use](https://caniuse.com/?search=weakmap)
- synchronous [glitch](https://stackoverflow.com/questions/25139257/terminology-what-is-a-glitch-in-functional-reactive-programming-rx) free: resolve [diamond problem](https://github.com/artalar/reatom/blob/master/packages/core/tests/diamond.test.ts)
- simple integration with other libraries (Observable, redux ecosystem, etc)
- awkward to write bad code
- easy to write good code

Reatom is a mix of all best from MobX and Redux. It processes immutable data and use single global store, which totally predictable, but makes it granular, which allows you to not think about any performance overhead and use it for any kind of task.

### Comparison

> PR welcome for other managers, but it should be framework agnostic.

| Name     | Bundle size | Granularity | Lifetime      | Atomicity | Effects managements | API      | Direction | Glitch free | Immutability |
| -------- | ----------- | ----------- | ------------- | --------- | ------------------- | -------- | --------- | ----------- | ------------ |
| Reatom   | 2kb gzip    | +           | warm          | +         | +/-                 | selector | pull/push | +           | +            |
| Redux    | 2.5kb gzip  | -           | hot/cold      | +/-       | -                   | selector | pull      | -           | +            |
| RTK      | 11kb gzip   | -           | hot/warm/cold | +/-       | +/-                 | selector | pull      | +           | +            |
| Mobx     | 15kb gzip   | +           | warm          | -         | +/-                 | proxy    | pull/push | +           | -            |
| Effector | 10kb gzip   | +           | hot           | -         | +                   | selector | push      | +           | +            |

<details>
 <summary>Explanation</summary>

- Bundle size is important because witch it smaller thats more projects you may cover with chosen solution. Reusable tech stack increase your performance and reduce contexts switching.
- Granularity describe the type of dependencies tracking and lack of it may reduce performance.
- TODO...

</details>

## Install

```sh
npm i @reatom/core@alpha
```

or

```sh
yarn add @reatom/core@alpha
```

## Usage

```js
import { declareAction, declareAtom, createStore } from '@reatom/core'

/**
 * Step 1. Declare actions.
 */
const increment = declareAction()

/**
 * Step 2. Declare atoms
 * `declareAtom` accepts an advanced version of the classic reducer.
 * Instead of action, atom reducer receives track function (`$`),
 * which accepts any _handler_ (see API section) and subscribes to it.
 */
const counterAtom = declareAtom(($, state = 0) => {
  // the handler may be an action handler
  $(increment.handle(() => state++))
  return state
})
const counterDoubledAtom = declareAtom(
  // the handler may be another atom (which a handler too)
  // in this case the track (`$`) will return atom state
  ($) => $(counterAtom) * 2
)

/**
 * Step 3. Create store entry point.
 * It is OPTIONAL, if you don't need to manage atoms scopes
 * you may skip manual store creation and directly subscribe to atoms
 * which will use `defaultStore` under the hood.
 */
const store = createStore()

/**
 * Step 4. Subscribe to needed atoms.
 */
store.subscribe(counterDoubledAtom, atomState => console.log(atomState))
// ➜ 0

/**
 * Step 5. Dispatch action and receive results.
 */
store.dispatch(increment())
// ➜ 2

/**
 * Step 6. Read data manually, if you need it.
 */
store.getState(counterAtom)
// ➜ 1
```

As you may see, Reatom flow looks like Redux flow, but reducers and selectors is unified to atoms, which allows you to describe data receiving naturally, as in MobX.

## What is state management?

`State` is a term from [FSA](https://en.wikipedia.org/wiki/Finite-state_machine) thats mean a consistent data with predicted shape (and literals) in some time slice of application lifetime.

State manager provides an API for describe and transform application state in a right way, you may solve a most class of problems with it, management domain data (user profile, entities editing...) or environment data (routing, network cache...).

Those problem you may solve by other ways too: streams / services / classes, but if you want more reliability guaranties and better debugging experience state manager do it best.

> this part will be updated, I have a lot to say.

## API

### declareAction

`declareAction` returns action creator. Optionally you may pass an payload mapper and used type.

#### Function overloads

```ts
import { declareAction } from '@reatom/core'

const increment = declareAction()
increment()
// { type: 'action [1]', payload: undefined }

const add = declareAction<number>()
increment(42)
// { type: 'action [2]', payload: 42 }

const set = declareAction((payload: number, meta: string) => ({ payload, meta }))
increment(42, 'from somewhere')
// { type: 'action [3]', payload: 42, meta: 'from somewhere' }

const push = declareAction<string>('ROUTER_PUSH')
// OR
const push = declareAction((payload: string) => ({ payload }), 'ROUTER_PUSH')
push('/main')
// { type: 'ROUTER_PUSH', payload: '/main' }
```

#### Methods

```ts
import { declareAction } from '@reatom/core'

const doSome = declareAction()

// <string>
// The type of creating action
doSome.type

// <(cb: (payload, action, transaction) => any) => Handler>
// Create handler which call passed callback
// if one of the dispatched action has the same type
doSome.handle

// <(cb: (action, store, transaction) => any) => Handler>
// Create handler which push passed callback to the effect queue
// if one of the dispatched action has the same type
doSome.handleEffect

// <(...arguments) => Action>
// Create an action by passed arguments
// and dispatch it to the `defaultStore`
doSome.dispatch

// <(cb: (payload) => any) => () => void>
// Subscribe to action dispatch in the `defaultStore`
doSome.subscribe
```

### declareAtom

`declareAtom` create atom - a handler thats receive immutable cache from store, process it and returns a new immutable version of cache. Also it may handle describe effect witch called only after successful recalculation of all atoms. Optionally you may pass `id` for better debugging or snapshot specification.

#### Function overloads

```ts
import { declareAction, declareAtom } from '@reatom/core'

const add = declareAction<number>('add')

// classic atom
const counterAtom = declareAtom(0, ($, state) => {
  $(add.handle((value) => state = state + value))
  return state
}, /* optional */ 'counter')

// derived atom
const counterNameAtom = declareAtom(($, state = 'zero') => {
  const counter = $(counterAtom)
  return numberToWord(counter)
}, /* optional */ 'counter name')

// dumb atom (it has `update` method action)
const counterDumbAtom = declareAtom(0, /* optional */ 'counter dumb')
// imitate add action
counterDumbAtom.update((state) => state + 1)
// { type: 'update of "counter dumb"', payload: Function }

const counterDebouncedAtom = declareAtom(0, ($, state, update) => {
  const counterAccumulator = $(counterAtom)
  $(add.handleEffect(async (action, store) => {
    await new Promise(requestAnimationFrame)
    if (counterAccumulator === store.getState(counterAtom)) {
      store.dispatch(update(counterAccumulator))
    }
  }))
  return state
})
```

#### Methods

```ts
import { declareAtom } from '@reatom/core'

const dataAtom = declareAtom([])

// <string>
// The unique id of the atom
dataAtom.id

// <(cb: (state) => any) => () => void>
// Subscribe to changes of the atom state
// (call first time immediately after subscribe)
dataAtom.subscribe
```

### `createStore`

`createStore` create new stateful store for managing atoms states and listeners

```ts
import { createStore } from '@reatom/core'

const store = createStore(/* optional */{ [counterAtom.id]: 10 })

store.subscribe((transaction) => console.log('transaction', transaction))

store.subscribe(counterAtom, (counter) => console.log(counter))
// ➜ 10

// You may dispatch a single action or array of actions for batching of it.
store.dispatch([add(1), add(2)])
// ➜ 13

// 'transaction', {
//   actions: [ { payload: 1, type: 'add' }, { payload: 2, type: 'add' } ], 
//   getCache: Function, 
//   patch: Map<Atom, AtomCache>
//   snapshot: { counter: 10 }, 
//   effects: []
// }

store.getState(counterAtom)
// 13
```

```ts
store.subscribe(doSome, (action) => {})
```

```ts
store.init(...atoms: Array<Atom>)
// shortcut to
;(new Array<Atom>()).forEach((atom) => store.subscribe(atom, noop))
```

## Guides

### Increase performance by ref pattern

If you fill limit of immutable data structures and need to increase performance of partial updates of a huge list / collection you may use _ref pattern_ and wrap every element of collection in atom. With this you may change the atom value and it will not affect a collection reference. But when you will need to get plain data / JSON of collection you should unwrap every element from atom as write you own serialize.

[![lists-with-ref](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/artalar/reatom2-lists-example)

## Internal architecture

### Action VS Event

One of the biggest feature and goal of the Reatom is [atomicity](https://en.wikipedia.org/wiki/Atomicity_(database_systems)) guarantees for processed state (from atoms). It is achieved by separating calculations for two consecutive stages: pure computations and side-effects. If first stage (pure computations) throws an error, accumulated patch from touched atoms will disappear, state will not changed and the second stage (side-effects calls) will not processed. It is the difference between events and actions: event is statement of happened fact, but action is intentions to do something (change state) so we may react to it only after it (state changing) happen.

### Lazy branches

You may use native language mechanic for branching you data flow: `if`/`else` statement or ternary operator right in place of your reactive data receiving (a `$` track function), Reatom do smart dynamical tracking of all dependencies and subscribe / unsubscribe only for actuals.
