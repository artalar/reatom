<div align="center">
<br/>

[![reatom logo](https://reatom.js.org/logos/logo.svg)](https://github.com/artalar/reatom/tree/v2)

</div>

Reatom is **declarative** state manager, designed for both simple and complex applications.

# @reatom/core

Core package of [Reatom](https://github.com/artalar/reatom) state manager.

[![Open in vscode](https://open.vscode.dev/badges/open-in-vscode.svg)](https://open.vscode.dev/organization/repository)
[![open in gitpod](https://img.shields.io/badge/Gitpod-ready--to--code-orange)](https://gitpod.io/#https://github.com/conwnet/github1s)

## Features

- 🐣 **simple abstraction** and friendly DX: minimum boilerplate and tiny API
- ⚡ **performance**: performant updates for partial state changes
- 🧯 **reliable**: [atomicity](<https://en.wikipedia.org/wiki/Atomicity_(database_systems)>) guaranties
- ❗️ **static typed**: best type inferences
- 🗜 **small size**: [2 KB](https://bundlephobia.com/result?p=@reatom/core@alpha) gzipped
- 📦 **modular**: reusable instances (SSR)
- 🍴 **lazy**: solution for code splitting out of the box
- 🔌 **framework-agnostic**: independent and self-sufficient
- 🧪 **testing**: simple mocking
- 🛠 **debugging**: immutable data, devtools (redux ecosystem support by adapter)
- 👴 **IE11 support**: [Can I Use](https://caniuse.com/?search=weakmap)
- synchronous [glitch](https://en.wikipedia.org/wiki/Reactive_programming#Glitches) free: resolve [diamond problem](https://github.com/artalar/reatom/blob/master/packages/core/tests/diamond.test.ts)
- simple integration with other libraries (Observable, redux ecosystem, etc)
- awkward to write bad code
- easy to write good code

Reatom is a mix of all best from MobX and Redux. It processes immutable data and use single global store, which totally predictable, but makes it granular, which allows you to not think about any performance overhead and use it for any kind of task.

### Comparison

> PR welcome for other managers, but it should be framework agnostic.

| Name     | Bundle size | Granularity | Lifetime      | Atomicity | Effects managements | API      | Direction | Glitch free | Immutability |
| -------- | ----------- | ----------- | ------------- | --------- | ------------------- | -------- | --------- | ----------- | ------------ |
| Reatom   | 2kb gzip    | +           | warm          | +         | +/-                 | selector | pull/push | +           | +            |
| Redux    | 1.6kb gzip  | -           | hot/cold      | +/-       | -                   | selector | pull      | -           | +            |
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

### Short example

```ts
import { createAtom } from '@reatom/core'

const

const counterAtom = createAtom(
  // map payload for generated action creators
  { inc: () => null, add: (value: number) => value },
  // describe reducer for action and other atoms handling
  ($, state = 0) => {
    $({ inc: () => (state += 1), add: (value) => (state += value) })
    return state
  },
)

counterAtom.subscribe((counter) => console.log(counter))
// -> 0

counterAtom.inc.dispatch()
// -> 1

counterAtom.add.dispatch(2)
// -> 3
```

### Detailed example

```ts
import { createAtom, createStore } from '@reatom/core'

const logTargetAtom = createAtom(
  { update: (logTarget: (number) => void) => logTarget },
  ($, state (logTarget: number) => {}) => {
    $({ update: (logTarget) => (state = logTarget) })

    return state
  },
)

const counterAtom = createAtom(
  /**
   * 1. Describe payload mappers for creating action creators.
   * You may do it right with atom initialization,
   * it reduce boilerplate and add extra features,
   * automatically add it to the atom.
   */
  {
    add: (value: number) => value,
  },
  /**
   * 2. Describe computation and action handlers.
   * `createAtom` accepts an advanced version of the classic reducer,
   * which rerun on every dependency action dispatch.
   * Instead of action, atom reducer receives track function (`$`),
   * which accepts an any action creator or a atom
   * for subscribing to it and new data processing.
   */
  ($, state = 0 /* <- don't forget to pass a default value */) => {
  // handle new data from other atom and use it \ compute a new one.
    const logTarget = $(logTargetAtom)

    $({
      // react to `add` dispatch and process its payload.
      add: (payload) => (state += payload),
    })

    $.effect((store, ctx) => {
      logTarget(state)
    })

    return state
  },
)

/**
 * 3. Create store entry point.
 * It is OPTIONAL, if you don't need to manage atoms scopes
 * you may skip manual store creation and directly subscribe to atoms
 * which will use `defaultStore` under the hood.
 */
const store = createStore()

/**
 * 4. Subscribe to needed atoms.
 */
store.subscribe(counterAtom, (atomState) => console.log(atomState))
// -> 0

/**
 * 5. Dispatch action and receive results.
 */
store.dispatch(counterAtom.add(1))
// -> 2

/**
 * 6. Test it!
 */
let counterEffectData
const testStore = createStore({
  snapshot: {
    [logTargetAtom.id]: (counter) => counterEffectData = counter
  }
})

testStore.subscribe(counterAtom, noop)
testStore.dispatch(counterAtom.add(1))

assert.is(counterEffectData, 1)
```

> Want a more complex example of a full power of the Reatom? [Check this helper method `createResource`](https://github.com/artalar/reatom/tree/v2/packages/core/experiments/createResource.ts) and [example](https://codesandbox.io/s/reatom-createresource-k00fq) with it.

As you may see, Reatom flow looks like Redux flow, but reducers and selectors is unified to atoms, which allows you to describe data receiving naturally, as in MobX. Also, atoms have an API for handling side-effects declarative, but flexible, see below.

Example above is a basic and don't show all cool features of Reatom. See [API section](#API) or [Guides](#Guides) to learn more about how to solve your tasks fast and efficient.

## What is state management?

`State` is a term from [FSA](https://en.wikipedia.org/wiki/Finite-state_machine) thats mean a consistent data with predicted shape (and literals) in some time slice of application lifetime.

State manager provides an API for describe and transform application state in a right way, you may solve a most class of problems with it, management domain data (user profile, entities editing...) or environment data (routing, network cache...).

Those problem you may solve by other ways too: streams / services / classes, but if you want more reliability guaranties and better debugging experience state manager do it best.

> this part will be updated, I have a lot to say.

## API

### createAtom

`createAtom` create atom - a handler thats receive immutable cache from store, process it and returns a new immutable version of cache. Also it may handle effect witch called only after successful recalculation of all touched atoms in the dispatch. Optionally you may pass `id` for better debugging or specification of snapshot key.

#### createAtom overloads

```ts
import { createActionCreator, createAtom } from '@reatom/core'

// classic atom (describe some action creators and how to process it)
const counterAtom = createAtom(
  { add: (value: number) => value },
  ($, state = 0) => {
    $(counterAtom.add, (value) => (state += value))

    return state
  },
)

// computed atom (compute state from other atoms)
const counterNameAtom = createAtom({}, ($, state = 'zero') => {
  const counter = $(counterAtom)

  return toWord(counter)
})

// module atom (public atom which combine all module atoms and handle effects)
export const counterRootAtom = createAtom({}, ($, state = 'zero') => {
  const counter = $(counterAtom)
  const counterName = $(counterNameAtom)

  $(counterAtom, (newValue, oldValue) => (store, ctx) => {
    console.log(`The counter is change`)
    console.log(`Prev counter`, oldValue)
    console.log(`New counter`, newValue)
  })

  return { counter, counterName }
})
```

<!--
TODO
```ts
// dumb atom (it has build in `update` action creator with binded method(reducer))
const counterDumbAtom = createAtom(0)
const counterDumbAtom = createAtom(0, undefined, `dump counter`)
const counterDumbAtom = createAtom(
  0,
  undefined,
  {
    // create context (it leave in a store) as an mutable data for effects
    createCtx = () => ({ updates: 0 })
    onChange: (oldState, state, store, ctx) =>
      console.log(`Counter ${++ctx.updates} update with ${state}`)
    id: `dump counter with onChange effect`
  }
)
// imitate increment action
counterDumbAtom.update(1)
// -> { type: 'update of "atom [N]"', payload: 1 }
counterDumbAtom.update((state) => state + 1)
// -> { type: 'update of "atom [N]"', payload: Function }
```
-->

#### createAtom methods and properties

```ts
import { createAtom } from '@reatom/core'

const dataAtom = createAtom({}, ($, state = []) => state)

// <string>
// The unique id of the atom
dataAtom.id

// <(cb: (state) => any) => () => void>
// Subscribe to changes of the atom state
// (call first time immediately after subscribe)
dataAtom.subscribe

// <() => State>
// Calc or return memoized state of the atom
dataAtom.getState
```

### `createStore`

`createStore` create new stateful store for managing atoms states and listeners

```ts
import { createStore } from '@reatom/core'

// You may pass OPTIONAL snapshot by the first argument
// It using instead an initialState of an atom
const store = createStore({ snapshot: { [counterAtom.id]: 10 } })

// Subscribe to transactions (dispatch)
store.subscribe((transactionResult) =>
  console.log('transaction', transactionResult),
)
// -> void
// () => void

// Subscribe to new state of an atom
store.subscribe(counterAtom, (counter) =>
  console.log('counterAtom new state', counter),
)
// -> 'counterAtom new state', 10
// () => void

// You may dispatch a single action or array of actions for batching of it.
store.dispatch([add(1), add(2)])
// -> 'transaction', {
// ->   actions: [ { payload: 1, type: 'add' }, { payload: 2, type: 'add' } ]
// ->   error: null
// ->   patch: Map<Atom, AtomCache>
// -> }
// ->
// -> 'counterAtom new state', 13
// Promise<void>

store.getState(counterAtom)
// 13
```

### createActionCreator

`createActionCreator` returns action creator. Optionally you may pass an payload mapper and used type.
You rarely need to use this manually, best practice for create action creators is describe it in a first argument of `createAtom`.

#### createActionCreator overloads

```ts
import { createActionCreator } from '@reatom/core'

const increment = createActionCreator()
increment()
// -> { type: 'action [1]', payload: undefined }

const add = createActionCreator<number>()
add(42)
// -> { type: 'action [2]', payload: 42 }

const set = createActionCreator((payload: number, meta: string) => ({
  payload,
  meta,
}))
set(42, 'from somewhere')
// -> { type: 'action [3]', payload: 42, meta: 'from somewhere' }

const push = createActionCreator<string>('ROUTER_PUSH')
// OR
const push = createActionCreator(
  (payload: string) => ({ payload }),
  'ROUTER_PUSH',
)
push('/main')
// -> { type: 'ROUTER_PUSH', payload: '/main' }
```

#### createActionCreator action targets

You may pass property `targets` with array of atoms which receive the action even if they have no any dependent subscriptions

#### createActionCreator methods and properties

```ts
import { createActionCreator } from '@reatom/core'

const doSome = createActionCreator()

// <string>
// The type of creating action
doSome.type

// <(...arguments) => Action>
// Create an action by passed arguments
// and dispatch it to the `defaultStore`
doSome.dispatch
```

## Guides

### Increase performance by ref pattern

> This is an ADVANCED pattern! We did not recommend to use it in regular development

If you fill limit of immutable data structures and need to increase performance of partial updates of a huge list / collection you may use _ref pattern_ and wrap every element of collection in atom. With this you may change the atom value and it will not affect a collection reference. But when you will need to get plain data / JSON of collection you should unwrap every element from atom as write you own serialize.

[![lists-with-ref](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/artalar/reatom2-lists-example)

## Internal architecture

### Action VS Event

One of the biggest feature and goal of the Reatom is [atomicity](<https://en.wikipedia.org/wiki/Atomicity_(database_systems)>) guarantees for processed state (from atoms). It is achieved by separating calculations for two consecutive stages: pure computations and side-effects. If first stage (pure computations) throws an error, accumulated patch from touched atoms will disappear, state will not changed and the second stage (side-effects calls) will not processed. It is the difference between events and actions: event is statement of happened fact, but action is intentions to do something (change state) so we may react to it only after it (state changing) happen.

### Lazy branches

You may use native language mechanic for branching you data flow: `if`/`else` statement or ternary operator right in place of your reactive data receiving (a `$` track function), Reatom do smart dynamical tracking of all dependencies and subscribe / unsubscribe only for actuals.
