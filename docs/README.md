<div align="center">

[![reatom logo](https://artalar.github.io/reatom/logos/logo.svg)](https://artalar.github.io/reatom)

[![npm](https://img.shields.io/npm/v/@reatom/core?style=flat-square)](https://www.npmjs.com/package/@reatom/core)
![npm type definitions](https://img.shields.io/npm/types/@reatom/core?style=flat-square)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/core?style=flat-square)](https://bundlephobia.com/result?p=@reatom/core)
![GitHub](https://img.shields.io/github/license/artalar/reatom?style=flat-square)

<br/>
<br/>
</div>

Reatom is **declarative** and **reactive** state manager, designed for both simple and complex applications. 

> **IMPORTANT!** Current state is **Work In Progress**.
> We do not recommend to use in production at the moment, but... We look forward to your feedback and suggestions to improve the API

> **v1.0.0 schedule**: end of September 2019

## Goals and features

- 🐣 **simple abstraction** and friendly DX: minimum boilerplate and tiny API
- ❗️ **static typed**: best type inference
- ⚡ **performance**: light tiny updates in huge state
- 🗜 **small size**: [2 KB](https://bundlephobia.com/result?p=@reatom/core) gzipped
- 📦 **modular**: reusable instances (SSR)
- 🍴 **lazy**: solution for code splitting out of the box
- 🧪 **testing**: simple mocking
- 🛠 **debugging**: immutable data, devtools (redux ecosystem support by adapter)
- 🔮 **deterministic**: declarative and predictable specification of state shape and its mutations
- 👴 **ES5 support**: by polyfills
- 🧯 **reliable**: predictable exeptions flow
- synchronous [glitch](https://stackoverflow.com/questions/25139257/terminology-what-is-a-glitch-in-functional-reactive-programming-rx) free: resolve [diamond problem](https://github.com/artalar/reatom/blob/master/packages/core/src/__tests__/diamond.ts)
- simple integration with other libraries (Observable, redux ecosystem, etc)
- awkward for write bad code
- handy for write good code

## Description

Reatom is blend of the one-way data flow (by [flux](https://github.com/facebook/flux) and global store) and decentralized [atoms](https://github.com/calmm-js/kefir.atom/blob/master/README.md#related-work) for [deterministic](https://en.wikipedia.org/wiki/Deterministic_algorithm) and flexible description of state and its changes.

> Inspired by [redux](https://github.com/reduxjs/redux), [kefir](https://github.com/kefirjs/kefir), [effector](https://github.com/zerobias/effector)


Data flow diagram:

<div align="center">

![reatom data flow](https://artalar.github.io/reatom/flow.svg)

</div>

## Installation

```sh
npm i @reatom/core
# or
yarn add @reatom/core
```

## Usage
[Open in CodeSandbox](https://codesandbox.io/s/reatom-intro-jlepp)

```js
import {
  declareAction,
  declareAtom,
  map,
  combine,
  createStore,
} from '@reatom/core'

/** Actions */
const increment = declareAction()
const add = declareAction()

/** Atoms */
const countAtom = declareAtom(1, on => [
  on(increment, state => state + 1),
  on(add, (state, payload) => state + payload),
])
const isOddAtom = map(countAtom, count => Boolean(count % 2))
const rootAtom = combine({ count: countAtom, isOdd: isOddAtom })

/** Store */
const store = createStore(rootAtom)

store.subscribe(countAtom, count => console.log('count: ', count))
store.subscribe(isOddAtom, isOdd => console.log('isOdd: ', isOdd))

store.dispatch(increment())
// count: 2
// isOdd: false

store.dispatch(add(2))
// count: 4
// here `isOdd` subscriber will not be called because its value is not changes
```

## Packages
| Package | Version | Size
--------|---------|----
| [`@reatom/core`](https://github.com/artalar/reatom/tree/master/packages/core) | [![npm](https://img.shields.io/npm/v/@reatom/core?style=flat-square)](https://www.npmjs.com/package/@reatom/core) | [![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/core?style=flat-square)](https://bundlephobia.com/result?p=@reatom/core)
| [`@reatom/react`](https://github.com/artalar/reatom/tree/master/packages/react) | [![npm](https://img.shields.io/npm/v/@reatom/react?style=flat-square)](https://www.npmjs.com/package/@reatom/react) | [![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/react?style=flat-square)](https://bundlephobia.com/result?p=@reatom/react)

## Motivation

<!-- 

### State management Zen

// https://en.wikipedia.org/wiki/Zen_of_Python

Guiding principles of state manager:

- The model of state must be determined
- The changes of state must be determined

-->

### Why not Redux
[link to repository](https://github.com/reduxjs/redux)

- Selectors are not inspectable (is lacking in devtools).
- Difficult static type inference (because every selector must to know full path to parent state).
- Hard for modular architecture (because every selector must to know about parent state).
- Separation of interfaces, to reducers and selectors, complicating build separated domains.
- Selectors - is **manual** API to state. It must be **manualy** described and memorized.
- Selectors execute after state change at subscriptions - error in selector will throw error and is no possibility (ok, all possible, but it is really hard) to restore previous valid state.
- classic reducer API is had much boilerplate and [static] type description boilerplate.
- Selectors "runtime" oriented, mean if some "feature" use any part of state (by selector) when you will remove that part, you get the error only when you will try to mount your "feature" at runtime (if you have not static typing). One of the solutions - is connect all features statically by imports.
- Middleware - is confound pattern that, sometimes unexpected, modify the behavior of store. Reference example: actions for redux-thunk don't logged.
  <!-- - Memorized selectors is extra computations by default, but it is defenetly unnecessary in SSR -->
  > A part of problems solves by various fabric functions, but without standardization it is harmful.

### Why not Effector
[link to repository](https://github.com/zerobias/effector)

- Effector is about _atomic **stores**_ - it statefull approach with problems:
  - probable [memory leaks](https://youtu.be/fbtElWjOXV0?t=1432)
  - difficult [store] instance reusability (for example, concurrences problems with SSR)
    > It can be solved, but better way solve it by design of library architecture and API
- Asynchronous and probably cyclic dependencies specification
- The [weight](https://bundlephobia.com/result?p=effector@20.1.2) can be smaller but it does not
- [Throw in reducer is not cancel computation of other reducers](https://github.com/zerobias/effector/issues/90)

### Why not MobX
[link to repository](https://github.com/mobxjs/mobx)

- Huge bundle size, unstandardized foreground syntax (decorators), ES5 limitations
- Doesn't move to separate _model_ and _view_.
- Runtime semantic and mutable state (is not a better way for debugging).
- [Proxy pattern](https://en.wikipedia.org/wiki/Proxy_pattern) is lack of visual part of code semantic.
- Is not simple under the hood and [it need to consider when choose algorithms for work with data-structure](https://twitter.com/art_al_ar/status/1162769896025075719)
- [And others...](https://mobx.js.org/best/pitfalls.html)

---

Next:

> - <a href="https://artalar.github.io/reatom/#/glossary">Glossary</a>
> - <a href="https://artalar.github.io/reatom/#/examples">Examples</a>
> - <a href="https://artalar.github.io/reatom/#/faq">FAQ</a>

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/artalar"><img src="https://avatars0.githubusercontent.com/u/27290320?v=4" width="100px;" alt="Arutyunyan Artyom"/><br /><sub><b>Arutyunyan Artyom</b></sub></a><br /><a href="https://github.com/artalar/reatom/commits?author=artalar" title="Code">💻</a> <a href="#ideas-artalar" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/artalar/reatom/commits?author=artalar" title="Tests">⚠️</a> <a href="#infra-artalar" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#tutorial-artalar" title="Tutorials">✅</a> <a href="#review-artalar" title="Reviewed Pull Requests">👀</a> <a href="#example-artalar" title="Examples">💡</a> <a href="https://github.com/artalar/reatom/commits?author=artalar" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/belozer"><img src="https://avatars1.githubusercontent.com/u/1655916?v=4" width="100px;" alt="Sergey Belozyorcev"/><br /><sub><b>Sergey Belozyorcev</b></sub></a><br /><a href="https://github.com/artalar/reatom/commits?author=belozer" title="Code">💻</a> <a href="#ideas-belozer" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/artalar/reatom/commits?author=belozer" title="Tests">⚠️</a> <a href="#infra-belozer" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#tutorial-belozer" title="Tutorials">✅</a> <a href="#review-belozer" title="Reviewed Pull Requests">👀</a> <a href="#design-belozer" title="Design">🎨</a> <a href="#example-belozer" title="Examples">💡</a> <a href="https://github.com/artalar/reatom/commits?author=belozer" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/Wroud"><img src="https://avatars2.githubusercontent.com/u/811729?v=4" width="100px;" alt="Alexey"/><br /><sub><b>Alexey</b></sub></a><br /><a href="https://github.com/artalar/reatom/commits?author=Wroud" title="Code">💻</a> <a href="#ideas-Wroud" title="Ideas, Planning, & Feedback">🤔</a> <a href="#infra-Wroud" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="https://github.com/artalar/reatom/commits?author=Wroud" title="Tests">⚠️</a> <a href="#platform-Wroud" title="Packaging/porting to new platform">📦</a> <a href="#plugin-Wroud" title="Plugin/utility libraries">🔌</a> <a href="#tool-Wroud" title="Tools">🔧</a></td>
    <td align="center"><a href="https://github.com/antonk52"><img src="https://avatars1.githubusercontent.com/u/5817809?v=4" width="100px;" alt="Anton"/><br /><sub><b>Anton</b></sub></a><br /><a href="https://github.com/artalar/reatom/commits?author=antonk52" title="Documentation">📖</a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
