**Reatom is a ultimate logic and state manager for small widgets and huge SPAs.**

## Key features

- **simple** and powerful abstractions.
  <small>There are only three main primitives: `ctx`, `atom`, `action`, all other features and packages works on top of that.</small>
- **immutable** and reliable.
  <small>All pure computations processed with [atomicity](https://www.reatom.dev/general/what-is-state-manager#state) guaranties.</small>
- **explicit reactivity** without proxies.
  <small>To archive [maximum](#how-performant-reatom-is) performance we have [atomization](https://www.reatom.dev/guides/atomization) pattern.</small>
- perfect **effects management**.
  <small>Advanced [async package](https://www.reatom.dev/package/async) allows you to describe complex async flows with caching, retrying and automatic cancellation with native `await` and `AbortController`.</small>
- nice **debugging** experience.
  <small>Each atom and action update stores [immutable cause (call) stack](https://www.reatom.dev/guides/debug) which is super helpful for debugging complex async flows. To simplify this we have [logger package](https://www.reatom.dev/package/logger).</small>
- implicit **DI**.
  <small>To run tests and SSR <strong>100% safety</strong> you need an isolation layer, which `ctx` is! We have the extra [testing package](https://www.reatom.dev/package/testing) with pack of helpers for a mocking.</small>
- actor-like **lifecycle hooks**
  <small> To archive a trhtully modularity you have ability to describe [self-sufficient models](https://www.reatom.dev/guides/lifecycle)</small>
- **smallest bundle** size: [2 KB](https://bundlejs.com/?q=%40reatom%2Fcore) gzipped
  <small>Because of the power of the base primitives all ecosystem with A LOT of enterprize-grade helpers took only [~15KB](https://bundlejs.com/?q=%40reatom%2Fframework%2C%40reatom%2Fnpm-react%2C%40reatom%2Fpersist-web-storage%2C%40reatom%2Fundo%2C%40reatom%2Fform-web&config=%7B%22esbuild%22%3A%7B%22external%22%3A%5B%22react%22%2C%22use-sync-external-store%22%5D%7D%7D) - insane!</small>
- **best TypeScript** experience
  <small>[Automatic type inference](https://www.reatom.dev/guides/typescript) is one of the main priority of Reatom developement.</small>

[The core package](https://www.reatom.dev/core) includes most these features and you may use it anywhere, from huge apps to even small libs, as the overhead is tiny. Also, you could reuse our carefully written [helper tools](https://www.reatom.dev/package/framework) to solve complex tasks in a couple lines of code. We are trying to build a stable and balanced ecosystem for perfect DX and predictable maintains even for years ahead.

## Simple example

Let's define input state and compute a greeting from it.

### Install

```sh
npm i @reatom/core
```

[vanilla codesandbox](https://codesandbox.io/s/reatom-vanila-hello-world-6oo36v?file=/src/index.ts)

[react codesandbox](https://codesandbox.io/s/reatom-react-hello-world-fgt6jn?file=/src/model.ts)

### Simple example model

The concept is _dumb_ - if you want to make a variable reactive, wrap the init state in `atom`, you will alow to change the state by calling it as a function. Need reactive computed? - wrap it to `atom`!

`action`s needed to separate logic and batch atom updates.

All data processing should be immutable, all side-effects should be wrapped to `ctx.schedule`.

What is `ctx`? It is the most powerful feature of Reatom. It flows as the first argument across all Reatom functions, bringing you enterprise-grade features with only three extra symbols!

```ts
import { action, atom } from '@reatom/core'

const initState = localStorage.getItem('name') ?? ''
export const inputAtom = atom(initState)

export const greetingAtom = atom((ctx) => {
  // `spy` dynamically reads the atom and subscribes to it
  const input = ctx.spy(inputAtom)
  return input ? `Hello, ${input}!` : ''
})

export const onSubmit = action((ctx) => {
  const input = ctx.get(inputAtom)
  ctx.schedule(() => {
    localStorage.setItem('name', input)
  })
})
```

### Simple example context

The context set up once for the whole app, or multiple times if you need isolation in SSR or tests.

```ts
import { createCtx } from '@reatom/core'

const ctx = createCtx()
```

### Simple example view

```ts
import { inputAtom, greetingAtom, onSubmit } from './model'

ctx.subscribe(greetingAtom, (greeting) => {
  document.getElementById('greeting')!.innerText = greeting
})

document.getElementById('name').addEventListener('input', (event) => {
  inputAtom(ctx, event.currentTarget.value)
})
document.getElementById('save').addEventListener('click', () => {
  onSubmit(ctx)
})
```

Check out [@reatom/core docs](https://www.reatom.dev/core) for detailed explanation of key principles and features.

Do you use React.js? Check out [npm-react](https://www.reatom.dev/adapter/npm-react) package!

## Advanced example

The core package is already profitable and you could use only it as a most simple and featured solution for your state and logic management. If you want to solve common system logic with advanced libraries to care more optimizations and UX tasks - continue and check this small guide out.

This example is close to real life and shows the complexity of interactive UI. It is a simple search input with debouncing and autocomplete. It uses [GitHub API](https://docs.github.com/en/rest/reference/search#search-issues-and-pull-requests) to fetch issues by query. The limitations of this API are described in [GitHub docs](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting). We need to reduce the number of requests and retry them if we hit the limit. Also, we need to cancel all previous requests if a new one is created, to prevent race conditions - when the previous request resolves after the new one.

### Install framework

```sh
npm i @reatom/framework @reatom/npm-react
```

[codesandbox](https://codesandbox.io/s/reatom-react-search-component-l4pe8q?file=/src/App.tsx)

### Advanced example description

We will use [@reatom/core](https://www.reatom.dev/core), [@reatom/async](https://www.reatom.dev/package/async) and [@reatom/hooks](https://www.reatom.dev/package/hooks) packages in this example by importing it from the meta package [@reatom/framework](https://www.reatom.dev/package/framework) - it simplifies imports and dependencies management.

`reatomAsync` is a simple decorator which wraps your async function and adds extra actions and atoms to track creating promise statuses.

`withDataAtom` adds property `dataAtom` which saves the last effect result and allow you to subscribe to it. `withCache` enable function middleware which prevent it's extra calls based on passed arguments identity - classic cache. `withAbort` allows to define concurrent requests abort strategy, by using `ctx.controller` ([AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)) from `reatomAsync`. `withRetry` and `onReject` handler help to handle temporal rate limit.

Simple `sleep` helper (for debounce) gotten from [utils package](https://www.reatom.dev/package/utils) - it is a built-in microscopic lodash alternative for most popular and tiny helpers.

`onUpdate` is a [hook](https://www.reatom.dev/package/hooks) which link to the atom and calls passed callback on every update.

### Advanced example model

```ts
import { atom, reatomAsync, withAbort, withDataAtom, withRetry, onUpdate, sleep, withCache } from "@reatom/framework"; // prettier-ignore
import * as api from './api'

const searchAtom = atom('', 'searchAtom')

const fetchIssues = reatomAsync(async (ctx, query: string) => {
  await sleep(350) // debounce
  const { items } = await api.fetchIssues(query, ctx.controller)
  return items
}, 'fetchIssues').pipe(
  withAbort({ strategy: 'last-in-win' }),
  withDataAtom([]),
  withCache({ length: 50, swr: false, paramsLength: 1 }),
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
```

### Advanced example view

```tsx
import { useAtom } from '@reatom/npm-react'

export const Search = () => {
  const [search, setSearch] = useAtom(searchAtom)
  const [issues] = useAtom(fetchIssues.dataAtom)
  // you could pass a callback to `useAtom` to create a computed atom
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

To get maximum of Reatom and the ecosystem just go to [tutorial](https://www.reatom.dev/tutorial). If you need something tiny - check out [the core package docs](https://www.reatom.dev/core). Also, we have a [package for testing](https://www.reatom.dev/package/testing)!

## Roadmap

- Finish [forms package](https://www.reatom.dev/package/form)
- Finish [persist](https://www.reatom.dev/package/persist) and [navigation](https://github.com/artalar/reatom/tree/v3/packages/navigation) packages
- Add adapters for most popular ui frameworks: ~~[react](https://www.reatom.dev/adapter/npm-react)~~, angular, vue, ~~[svelte](https://www.reatom.dev/adapter/npm-svelte)~~, solid.
- Port some components logic from reakit.io, to made it fast, light and portable.
- Add ability to made async transaction and elaborate optimistic-ui patterns and helpers / package.
- Try to write own jsx renderer.

## FAQ

### Why not X?

**Redux** is awesome and Reatom is heavy inspired by it. Immutability, separation of computations and effects are good architecture designs principles. But there are a lot of missing features, when you trying to build something huge, or want to describe something small. Some of them is just impossible to fix, like [batching](https://www.reatom.dev/core#ctxget-batch-api), [O(n) complexity](https://www.reatom.dev/guides/atomization#reducing-computational-complexity) or that selectors is not inspectable and breaks [the atomicy](https://www.reatom.dev/general/what-is-state-manager#state). Others is really [hard to improve](https://github.com/reduxjs/reselect/discussions/491). And boilerplate, yeah, [the difference is a huge](https://github.com/artalar/RTK-entities-basic-example/pull/1/files#diff-43162f68100a9b5eb2e58684c7b9a5dc7b004ba28fd8a4eb6461402ec3a3a6c6).
Reatom solves all this problems and bring much more features by the almost same size.

**MobX** brings too big bundle to use it in a small widgets, Reatom is more universal in this case. Also, MobX has mutability and implicit reactivity, which is usefull for simple cases, but could be not obvious and hard to debug in complex cases. There is no separate thing like action / event / effect to describe some dependent effects sequences (FRP-way). [There is not atomicy too](https://github.com/artalar/state-management-specification/blob/master/src/index.test.js#L60).

**Effector** is too opinionated. There is **no** first-class support for **lazy** reactive computations and all connections are [hot](https://luukgruijs.medium.com/understanding-hot-vs-cold-observables-62d04cf92e03) everytime, which is could be more predictable, but defenetly is not optimal. Effector is not friendly for fabric creation (because of it hotness), which disallow us to use [atomization](https://www.reatom.dev/guides/atomization#ref-pattern) patterns, needed to handle immutability efficient. [The bundle size is 2-3 times larger](https://bundlejs.com/?q=effector&treeshake=%5B%7BcraeteStore%2CcreateEvent%2Ccombine%7D%5D) and [performance is lower](https://github.com/artalar/reactive-computed-bench).

[Zustand](https://github.com/pmndrs/zustand), [nanostores](https://github.com/nanostores/nanostores), [xstate](https://xstate.js.org) and [many other](https://gist.github.com/artalar/e5e8a7274dfdfbe9d36c9e5ec22fc650) state managers have no so great combination of type inference, features, bundle size and performance, as Reatom have.

### Why immutability?

Immutable data is much predictable and better for debug, than mutable states and wrapers around that. Reatom specialy designed with focus on [simple debug of async chains](https://www.reatom.dev/guides/debug) and [have a patterns](https://www.reatom.dev/guides/atomization) to handle [greate performance](#how-performant-reatom-is).

### What LTS policy is used and what about bus factor?

Reatom always developed for long time usage. Our first LTS (Long Time Support) version (v1) [was released in December 2019](https://github.com/artalar/reatom/releases/tag/v1.0) and in 2022 we provided breaking changes less [Migration guide](https://www.reatom.dev/compat/core-v1#migration-guide) to the new LTS (v3) version. 3 years of successful maintains is not ended, but continued in [adapter package](https://www.reatom.dev/compat/core-v1). We hope it shows and prove our responsibility.

To be honest, right now bus factor is one, [@artalar](https://github.com/artalar/) - the creator and product owner of this, but it wasn't always like this [as you can see](https://github.com/artalar/reatom/graphs/contributors). Reatom PR wasn't great in a past couple of years and a lot of APIs was experimental during development, but now with the new LTS version (v3) we bring to new feature of this lib and application development experience for a long time.

### What build target and browser support?

All packages are configured based on [Browserslist's "last 1 year" query](https://browsersl.ist/#q=last+1+year). If you need to support older environments, you should handle transpilation yourself.

All builds have two types of output formats: CJS (`exports.require`, `main`) and ESM (`exports.default`, `module`). You can check `package.json` for more details.

### How performant Reatom is?

[Here is the benchmark](https://github.com/artalar/reactive-computed-bench) of complex computations for different state managers. Note that Reatom by default uses immutable data structures, works in a separate context (DI-like) and keeps [atomicity](https://www.reatom.dev/general/what-is-state-manager#state), which means the Reatom test checks more features, than other state manager tests. Anyway, for the middle numbers Reatom faster than MobX which is pretty impressive.

Also, check out [atomization guide](https://www.reatom.dev/guides/atomization).

### Limitations

Of course there are no software without limitations. Reatom is trying to be a silver bullet but we still have some cases which you should know about.

- Immutable data always have an additional performance impact and in critical cases you should think well about your structures and how you could handle it better. The good news is that you [don't have to use normalization](https://www.reatom.dev/guides/atomization).
- Laziness could be not obvious in some cases and will cause some updates missing. But it easy to debug a missing update, which is more explicit, than memory leaks and performance issues of hot observables. Anyway, we have [hooks](https://www.reatom.dev/package/hooks) for hot linking.
- Currently, there is no way to subscribe on error of any dependency, but we are working on it. In [reatomAsync](https://www.reatom.dev/package/async) passed effects wraps to an error handler and allow you to handle errors, but again - you should wrap it explicit.
- Currently, there is no asynchronous transactions support, but we are working on it. It is important feature for simplify building of optimistic UI and we really think it will improve UX a lot.
- We have a lot of utils and the ecosystem is growing all the time, but the target of that is have a set of well done logic primitives, and there is no architecture framework or codestyle / declarative framework to fit you in one strict flow. Reatom trying to be in the middle of a library and a framework. We love procedural programming with minimum extra API and semantic overhead. Our defaults are good already to help to you to write a better code: immutability and lazyness, transactions and separation of pure computations and effects, `ctx` and connections and processes virtualizations.

### Media

- [en twitter](https://twitter.com/ReatomJS)
- [ru telegram](https://t.me/reatom_ru)
- [ru youtube](https://www.youtube.com/playlist?list=PLXObawgXpIfxERCN8Lqd89wdsXeUHm9XU)

### How to support the project?

https://www.patreon.com/artalar_dev

## Zen

- **Good primitive is more than a framework**
- Composition beats configuration
<!--
- General context explicit enough to be hidden
  - A feature semantic should be visible

-->

## Credits

Software development in 202X is hard and we really appreciate all [contributors](https://github.com/artalar/reatom/graphs/contributors) and free software maintainers, who make our life easier. Special thanks to:

- [React](https://reactjs.org), [Redux](https://redux.js.org) and [Effector](https://effector.dev/) for inspiration
- [microbundle](https://github.com/developit/microbundle) for handling all bundling complexity
- [Quokka](https://wallabyjs.com/oss/) and [uvu](https://github.com/lukeed/uvu) for incredible testing experience
- [TURBO](https://turbo.build) for simple monorepo management
- [Astro](https://astro.build) for best in class combine of performance and developer experience
- [Vercel](https://vercel.com/) for free hosting and perfect CI/CD (preview branches are <3)
