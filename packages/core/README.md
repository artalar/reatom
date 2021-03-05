<div align="center">
<br/>

[![reatom logo](https://reatom.js.org/logos/logo.svg)](https://reatom.js.org)

</div>

Reatom is **declarative** and **reactive** state manager, designed for both simple and complex applications.

# @reatom/core

Core package of [Reatom](https://github.com/artalar/reatom) state manager.

[![Reatom bundle size is around 2KB gzip](https://img.shields.io/bundlephobia/minzip/@reatom/core@alpha?style=flat-square)](https://bundlephobia.com/result?p=@reatom/core)
![The license is MIT](https://img.shields.io/github/license/artalar/reatom?style@alpha=flat-square)

## Features

- 🐣 **simple abstraction** and friendly DX: minimum boilerplate and tiny API
- ❗️ **static typed**: best type inferences
- ⚡ **performance**: performant updates for partial state changes
- 🗜 **small size**: [2 KB](https://bundlephobia.com/result?p=@reatom/core@alpha) gzipped
- 📦 **modular**: reusable instances (SSR)
- 🍴 **lazy**: solution for code splitting out of the box
- 🔌 **framework-agnostic**: independent and self-sufficient
- 🧪 **testing**: simple mocking
- 🛠 **debugging**: immutable data, devtools (redux ecosystem support by adapter)
- 🔮 **deterministic**: declarative and predictable specification of state shape and its mutations
- 👴 **IE11 support**: [Can I Use](https://caniuse.com/?search=weakmap)
- 🧯 **reliable**: predictable flow exceptions
- synchronous [glitch](https://stackoverflow.com/questions/25139257/terminology-what-is-a-glitch-in-functional-reactive-programming-rx) free: resolve [diamond problem](https://github.com/artalar/reatom/blob/master/packages/core/tests/diamond.test.ts)
- simple integration with other libraries (Observable, redux ecosystem, etc)
- awkward to write bad code
- easy to write good code

Reatom is a mix of all best from MobX and Redux. It processes immutable data, which totally predictable, but make it granular, which allows you to not think about any performance overhead and use it for any kind of task.

For example, Redux manages a single _global_ state and not friendly for storing high dynamic data (scroll position, animation processing) or data for many individual subscriptions (table cells, inputs of the huge form). It may sound weird, but all these tasks may be managed by the Reatom state manager, which allows you to increase code consistency, compatibility, and reusability. Also, Reatom API is much insinuating, even comparing with RTK. And Reatom bundle still less than plain Redux.

Unlike MobX, Reatom has a tiny bundle, less _magical_ API, predictable immutable dataflow, and [atomicity](https://en.wikipedia.org/wiki/Atomicity_(database_systems)) guarantees.

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

## API

### `declareAction`

`declareAction` returns action creator. Optionally you may pass an payload mapper and used type.

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

const push = declareAction((payload: string) => ({ payload }), { type: 'ROUTER_PUSH' })
push('/main')
// { type: 'ROUTER_PUSH', payload: '/main' }
```

### `declareAtom`

`declareAtom` create atom - a handler thats receive immutable cache from store, process it and returns a new immutable version of cache. Optionally you may pass `displayName` for better debugging or snapshot specification.

```ts
import { declareAtom } from '@reatom/core'
```

### `createStore`

`createStore` create new stateful store.

```ts
import { createStore } from '@reatom/core'
```

## Architecture

### Action VS Event

One of the biggest feature and goal of the Reatom is [atomicity](https://en.wikipedia.org/wiki/Atomicity_(database_systems)) guarantees for processed state (from atoms). It is achieved by separating calculations for two consecutive stages: pure computations and side-effects. If first stage (pure computations) throws an error, accumulated patch from touched atoms will disappear, state will not changed and the second stage (side-effects calls) will not processed. It is the difference between events and actions: event is statement of happened fact, but action is intentions to do something (change state) so we may react to it only after it (state changing) happen.
