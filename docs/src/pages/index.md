---
layout: ../layouts/Layout.astro
title: Main
description: Reatom - tiny and powerful reactive system with immutable nature
---

Reatom is the ultimate [state manager](/general/what-is-state-manager) with a unique set of features. It offers the most modern techniques for describing, executing, and debugging code in a small package. Reatom is an opinionated data manager with strict but flexible rules that enable you to write simple and maintainable code.

Key principles:

- **simple** and powerful abstractions - the whole ecosystem is built on top of a three primitives: ctx, atom, action
- **immutable** and reliable computations with [atomicity](/general/what-is-state-manager#state) guaranties
- **explicit reactivity** - maximum [performance](#how-performant-reatom-is) with [atomization](/guides/atomization) without proxies
- perfect **effects management** and **debugging** experience by [immutable cause (call) stack](/guides/debug). Advanced [async package](/packages/async) allows you to describe complex async flows with caching, retrying and automatic cancellation of entire chain - like redux-saga, but with native `await` and `AbortController`
- implicit **DI** for simple SSR and [testing](/packages/testing)
- actor-like **lifecycle hooks** for declarative description of [self-sufficient models](/guides/lifecycle)
- **smallest bundle** size: [2 KB](https://bundlejs.com/?q=%40reatom%2Fcore) gzipped
- [automatic type inference](/guides/typescript)

[The core package](/core) includes most these features and you may use it anywhere, from huge apps to even small libs, as the overhead is tiny. Also, you could reuse our carefully written [helper tools](/packages/framework) to solve complex tasks in a couple lines of code. We are trying to build a stable and balanced ecosystem for perfect DX and predictable maintains even for years ahead.

## Simple example

Let's define input state and compute a greeting from it.

### Install

```sh
npm i @reatom/core
```

[vanilla codesandbox](https://codesandbox.io/s/reatom-vanila-hello-world-6oo36v?file=/src/index.ts)

[react codesandbox](https://codesandbox.io/s/reatom-react-hello-world-fgt6jn?file=/src/model.ts)

```ts
import { action, atom, createCtx } from '@reatom/core'

// primitive mutable atom
const inputAtom = atom('')
// computed readonly atom
// `spy` dynamically reads the atom and subscribes to it
const greetingAtom = atom((ctx) => `Hello, ${ctx.spy(inputAtom)}!`)

// all updates in action processed by a smart batching
const onInput = action((ctx, event) => {
  // update the atom value by call it as a function
  inputAtom(ctx, event.currentTarget.value)
})

// global application context
const ctx = createCtx()

document
  .getElementById('name-input')
  .addEventListener('input', (event) => onInput(ctx, event))

ctx.subscribe(greetingAtom, (greeting) => {
  document.getElementById('greeting').innerText = greeting
})
```

Check out [@reatom/core docs](/core) for detailed explanation of key principles and features.

Do you use React.js? Check out [npm-react](/packages/npm-react) package!

## Advanced example

This example is close to real life and shows the complexity of interactive UI. It is a simple search input with debouncing and autocomplete. It uses [GitHub API](https://docs.github.com/en/rest/reference/search#search-issues-and-pull-requests) to fetch issues by query. The limitations of this API are described in [GitHub docs](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting). We need to reduce the number of requests and retry them if we hit the limit. Also, we need to cancel all previous requests if a new one is created, to prevent race conditions - when the previous request resolves after the new one.

### Install framework

```sh
npm i @reatom/framework @reatom/npm-react
```

[codesandbox](https://codesandbox.io/s/reatom-react-hello-world-fgt6jn)

We will use [@reatom/core](/core), [@reatom/async](/packages/async) and [@reatom/hooks](/packages/hooks) packages in this example by importing it from the meta package [@reatom/framework](/packages/framework) - it simplifies imports and dependencies management.

`reatomAsync` is a simple decorator which wraps your async function and adds extra actions and atoms to track creating promise statuses.

`withDataAtom` adds property `dataAtom` which subscribes to the effect results, it is like a simple cache implementation. `withAbort` allows to define concurrent requests abort strategy, by using `ctx.controller` ([AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)) from `reatomAsync`. `withRetry` and `onReject` handler help to handle temporal rate limit.

Simple `sleep` helper (for debounce) gotten from [utils package](/packages/utils) - it is a built-in microscopic lodash alternative for most popular and tiny helpers.

`onUpdate` is a [hook](/packages/hooks) which link to the atom and calls passed callback on every update.

```ts
import { atom, reatomAsync, withAbort, withDataAtom, withRetry, sleep, onUpdate } from '@reatom/framework' /* prettier-ignore */
import { useAtom } from '@reatom/npm-react'
import * as api from './api'

const searchAtom = atom('', 'searchAtom')
const fetchIssues = reatomAsync(async (ctx, query: string) => {
  await sleep(250) // debounce
  const { items } = await api.fetchIssues(query, ctx.controller)
  return items
}, 'fetchIssues').pipe(
  withDataAtom([]),
  withAbort({ strategy: 'last-in-win' }),
  withRetry({
    onReject(ctx, error: any, retries) {
      // return delay in ms or -1 to prevent retries
      return error?.message.includes('rate limit')
        ? 100 * Math.min(500, retries ** 2)
        : -1
    },
  }),
)
// run fetchIssues on every searchAtom update
onUpdate(searchAtom, fetchIssues)

export default function App() {
  const [search, setSearch] = useAtom(searchAtom)
  const [issues] = useAtom(fetchIssues.dataAtom)
  // we could pass a callback to `useAtom` to create a computed atom
  const [isLoading] = useAtom(
    (ctx) =>
      // even if there are no pending requests, we need to wait for retries
      // let do not show the limit error to make him think that everything is fine for a better UX
      ctx.spy(fetchIssues.pendingAtom) + ctx.spy(fetchIssues.retriesAtom) > 0,
  )

  return (
    <main>
      <input
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        placeholder="Search"
      />
      {isLoading && 'Loading...'}
      <ul>
        {issues.map(({ title }, i) => (
          <li key={i}>{title}</li>
        ))}
      </ul>
    </main>
  )
}
```

The whole logic definition is only about 15 LoC and it is not coupled to React and could be tested easily. What would the lines count be in a different library? The most impressive thing is that the overhead is [less than 4KB (gzip)](https://bundlejs.com/?q=%28import%29%40reatom%2Fframework%2C%28import%29%40reatom%2Fnpm-react&treeshake=%5B%7B%0A++atom%2CcreateCtx%2ConUpdate%2CreatomAsync%2Csleep%2CwithAbort%2CwithDataAtom%2CwithRetry%2C%7D%5D%2C%5B%7B+useAtom+%7D%5D&share=MYewdgzgLgBBCmBDATsAFgQSiAtjAvDItjgBQBE5ANDOQiulruQJQDcAUKJLAGbxR0ASQgQArvAgEYyJCQwQAnmGClESlTFLAoADxoBHCckUAuOFGQBLMAHMWBAHwwA3hxhEA7oiuwIAG3h4AAdSACYAVgAGdhgAejiYABN4ACMQMRV4dxhuaFcYX3gcKQBfaURvXyJgqwA6fkE0EXFJUiN4ExodXTruSxB-QOR2HNkoMWQwQqhiiE5SmnJG4VEJCFY62uD4UhzPXzQAEWJEJjIAbQBdFip9w4x05ChSFwtkYnhbM1p-dSgALQ2AEHMDkGClW73KBoABKAhMrxyHnA8IAVvAdNo9DROsgQMhzIgwIoaONrJIHG4PDT4olxpNpik-opCtMSjACTAAQBGGDYGDBWQAN3gYFg5KskmRNIZUxgeIJAH46jhJBBELZ4HUbMB-GIUhAKB9ZjB-FYcL5WDLaUqYDyolEYAAqGAAWWIaFVNlI0SiZIRUqkztdYRYNpp5l5nFpixykLuowSMkyMBWzTWkk503gopMcCQqEwJBgYmCSU%2BHHAAFVy59SPQi%2BcaOmWutRlxZJ8AMJ6UijMQIc6kVuZiB1CtQM4kFhAA&config=%7B%22esbuild%22%3A%7B%22external%22%3A%5B%22react%22%2C%22use-sync-external-store%22%5D%7D%7D) could you imagine?! And you are not limited to network cache, Reatom is powerful and expressive enough for describing any kind of state.

To get maximum of Reatom and the ecosystem just go to [tutorial](/tutorial). If you need something tiny - check out [the core package docs](https://reatom.dev/core). Also, we have a [package for testing](/packages/testing)!

## Roadmap

- Finish [forms package](https://github.com/artalar/reatom/tree/v3/packages/form)
- Finish [persist](https://github.com/artalar/reatom/tree/v3/packages/persist) and [navigation](https://github.com/artalar/reatom/tree/v3/packages/navigation) packages
- Add adapters for most popular ui frameworks: ~~[react](/packages/npm-react)~~, angular, vue, ~~[svelte](/packages/npm-svelte)~~, solid.
- Port some components logic from reakit.io, to made it fast, light and portable.
- Add ability to made async transaction and elaborate optimistic-ui patterns and helpers / package.
- Try to write own jsx renderer.

## FAQ

### Why not X?

**Redux** is awesome and Reatom is heavy inspired by it. Immutability, separation of computations and effects are good architecture designs principles. But there are a lot of missing features, when you trying to build something huge, or want to describe something small. Some of them is just impossible to fix, like [batching](/core#ctxget-batch-api), [O(n) complexity](/guides/atomization#ref-pattern) or that selectors is not inspectable and breaks [the atomicy](/general/what-is-state-manager#state). Others is really [hard to improve](https://github.com/reduxjs/reselect/discussions/491). And boilerplate, yeah, [the difference is a huge](https://github.com/artalar/RTK-entities-basic-example/pull/1/files#diff-43162f68100a9b5eb2e58684c7b9a5dc7b004ba28fd8a4eb6461402ec3a3a6c6).
Reatom solves all this problems and bring much more features by the almost same size.

**MobX** brings too big bundle to use it in a small widgets, Reatom is more universal in this case. Also, MobX has mutability and implicit reactivity, which is usefull for simple cases, but could be not obvious and hard to debug in complex cases. There is no separate thing like action / event / effect to describe some dependent effects sequences (FRP-way). [There is not atomicy too](https://github.com/artalar/state-management-specification/blob/master/src/index.test.js#L60).

**Effector** is too opinionated. There is **no** first-class support for **lazy** reactive computations and all connections are [hot](https://luukgruijs.medium.com/understanding-hot-vs-cold-observables-62d04cf92e03) everytime, which is could be more predictable, but defenetly is not optimal. Effector is not friendly for fabric creation (because of it hotness), which disallow us to use [atomization](/guides/atomization#ref-pattern) patterns, needed to handle immutability efficient. [The bundle size is 2-3 times larger](https://bundlejs.com/?q=effector&treeshake=%5B%7BcraeteStore%2CcreateEvent%2Ccombine%7D%5D) and [performance is lower](https://github.com/artalar/reactive-computed-bench).

[Zustand](https://github.com/pmndrs/zustand), [nanostores](https://github.com/nanostores/nanostores), [xstate](https://xstate.js.org) and [many other](https://gist.github.com/artalar/e5e8a7274dfdfbe9d36c9e5ec22fc650) state managers have no so great combination of type inference, features, bundle size and performance, as Reatom have.

### Why immutability?

Immutable data is much predictable and better for debug, than mutable states and wrapers around that. Reatom specialy designed with focus on [simple debug of async chains](/guides/debug) and [have a patterns](/guides/atomization) to handle [greate performance](#how-performant-reatom-is).

### What LTS policy is used and what about bus factor?

Reatom always developed for long time usage. Our first LTS (Long Time Support) version (v1) [was released in December 2019](https://github.com/artalar/reatom/releases/tag/v1.0) and in 2022 we provided breaking changes less [Migration guid](/core-v1#migration-guide) to the new LTS (v3) version. 3 years of successful maintains is not ended, but continued in [adapter package](/core-v1). We hope it shows and prove our responsibility.

To be honest, right now bus factor is one, [@artalar](https://github.com/artalar/) - the creator and product owner of this, but it wasn't always like this [as you can see](https://github.com/artalar/reatom/graphs/contributors). Reatom PR wasn't great in a past couple of years and a lot of APIs was experimental during development, but now with the new LST version (v3) we bring to new feature of this lib and application development experience for a long time.

### How performant Reatom is?

[Here is the benchmark](https://github.com/artalar/reactive-computed-bench) of complex computations for different state managers. Note that Reatom by default uses immutable data structures, works in a separate context (DI-like) and keeps [atomicity](/general/what-is-state-manager#state), which means the Reatom test checks more features, than other state manager tests. Anyway, for the middle numbers Reatom faster than MobX which is pretty impressive.

Also, check out [atomization guild](/guides/atomization).

### Limitations

Of course there are no software without limitations. Reatom is trying to be a silver bullet but we still have some cases witch you should know about.

- Immutable data always have an additional performance impact and in critical cases you should think well about your structures and how you could handle it better. The good news is that you [don't have to use normalization](/guides/atomization).
- Laziness could be not obvious in some cases and will cause some updates missing. But it easy to debug a missing update, which is more explicit, than memory leaks and performance issues of hot observables. Anyway, we have [hooks](/packages/hooks) for hot linking.
- Currently, there is no way to subscribe on error of any dependency, but we are working on it. In [reatomAsync](/packages/async) passed effects wraps to an error handler and allow you to handle errors, but again - you should wrap it explicit.
- Currently, there is no asynchronous transactions support, but we are working on it. It is important feature for simplify building of optimistic UI and we really think it will improve UX a lot.
- We have a lot of utils and the ecosystem is growing all the time, but the target of that is have a set of well done logic primitives, and there is no architecture framework or codestyle / declarative framework to fit you in one strict flow. Reatom trying to be in the middle of a library and a framework. We love procedural programming with minimum extra API and semantic overhead. Our defaults are good already to help to you to write a better code: immutability and lazyness, transactions and separation of pure computations and effects, `ctx` and connections and processes virtualizations.

### Community

- [en](https://github.com/artalar/reatom/discussions)
- [ru](https://t.me/reatom_ru)
- [twitter](https://twitter.com/ReatomJS)

### How to support the project?

https://www.patreon.com/artalar_dev

### Credits

Software development in 202X is hard and we really appreciate all [contributors](https://github.com/artalar/reatom/graphs/contributors) and free software maintainers, who make our life easier. Special thanks to:

- [React](https://reactjs.org), [Redux](https://redux.js.org) and [Effector](https://effector.dev/) for inspiration
- [microbundle](https://github.com/developit/microbundle) for handling all bundling complexity
- [Quokka](https://wallabyjs.com/oss/) and [uvu](https://github.com/lukeed/uvu) for incredible testing experience
- [TURBO](https://turbo.build) for simple monorepo management
- [Astro](https://astro.build) for best in class combine of performance and developer experience
- [Vercel](https://vercel.com/) for free hosting and perfect CI/CD (preview branches are <3)
