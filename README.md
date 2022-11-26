Reatom is a state manager with quite unique set of features, it provides the most modern techniques for describing, executing, and debugging code in a tiny package. It opinionated data manager with strict, but flexible rules, which allows you to write simple and maintainable code.

Key principles are **immutability** and **explicit reactivity** (no proxies), implicit **DI** and actor-like **lifecycle hooks**. All this with simple API and **automatic type inference**.

[The core package](https://www.reatom.dev/packages/core) is included all this features and you may use it anywhere, from huge apps to even small libs, as the overhead only [2 KB](https://bundlejs.com/?q=%40reatom%2Fcore%40alpha). Also, you could reuse our carefully written [helper tools](https://www.reatom.dev/packages/framework) to solve complex tasks in a couple lines of code. We trying to build stable and balanced ecosystem for perfect DX and predictable maintains even for years ahead.

Do you React.js user? Check out [npm-react](https://www.reatom.dev/packages/npm-react) package!

## Simple example

[repl](https://replit.com/@artalar/reatom-react-ts).

```ts
import { action, atom, createCtx } from 'reatom/core'

// primitive mutable atom
const inputAtom = atom('')
// computed readonly atom
// `spy` reads the atom and subscribes to it
const greetingAtom = atom((ctx) => `Hello, ${ctx.spy(inputAtom)}!`)

// all updates in action processed by a smart batching
const onInput = action((ctx, event) =>
  // update the atom value by call it as a function
  inputAtom(ctx, event.currentTarget.value),
)

// global application context
const ctx = createCtx()

document
  .getElementById('name-input')
  .addEventListener('input', (event) => onInput(ctx, event))

ctx.subscribe(greetingAtom, (greeting) => {
  document.getElementById('greeting').innerText = greeting
})
```

## Advanced example

[repl](https://replit.com/@artalar/reatom-react-ts-search-example#src/App.tsx).

We will use [@reatom/core](https://www.reatom.dev/packages/core), [@reatom/async](https://www.reatom.dev/packages/async) and [@reatom/hooks](https://www.reatom.dev/packages/hooks) packages in this example by importing it from the meta package [@reatom/framework](https://www.reatom.dev/packages/framework).

`withDataAtom` saves the result of async function to separate atom, it is like a simple cache implementation. `withAbort` allow to define concurrent requests abort strategy, by using `ctx.controller` ([AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)) from `reatomAsync`. `withRetryAction` and `onReject` handler helps to handle temporal rate limit.

Simple `sleep` helper gotten from [utils package](https://www.reatom.dev/packages/utils) - it is a built-in microscopic lodash alternative for most popular and tiny helpers.

```ts
import { atom, reatomAsync, withAbort, withDataAtom, withRetryAction, onUpdate, sleep } from "@reatom/framework";
import { useAtom } from '@reatom/npm-react'

const searchAtom = atom('', 'searchAtom')
const fetchIssues = reatomAsync(async (ctx, query: string) => {
  await sleep(250)
  const { items } = await fetchIssuesApi(query, ctx.controller)
  return items
}, 'fetchIssues').pipe(
  withDataAtom([]),
  withAbort({ strategy: 'last-in-win' }),
  withRetryAction({
    onReject: (ctx, error: any, retries) => error?.message.includes('rate limit')
      ? 100 * Math.min(500, retries ** 2)
      : -1
  }),
)
onUpdate(searchAtom, fetchIssues)

export default function App() {
  const [search, setSearch] = useAtom(searchAtom)
  const [issues] = useAtom(fetchIssues.dataAtom)
  const [isLoading] = useAtom(
    (ctx) =>
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
      <ul>{issues.map(({ title }, i) => <li key={i}>{title}</li>)}</ul>
    </main>
  )
}
```

The whole logic definition is only about 15 LoC, what is the count would be in a different library? The most impressed thing is that the overhead is only [6KB (gzip)](https://bundlejs.com/?q=%28import%29%40reatom%2Fframework%2C%28import%29%40reatom%2Fnpm-react&treeshake=%5B%7B%0A++atom%2CcreateCtx%2ConUpdate%2CreatomAsync%2Csleep%2CwithAbort%2CwithDataAtom%2CwithRetryAction%2C%7D%5D%2C%5B%7B+useAtom+%7D%5D&share=MYewdgzgLgBBCmBDATsAFgQSiAtjAvDItjgBQBE5ANDOQiulruQJQDcAUKJLAGbxR0ASQgQArvAgEYyJCQwQAnmGClESlTFLAoADxoBHCckUAuOFGQBLMAHMWBAHwwA3hxhEA7oiuwIAG3h4AAdSACYAVgAGdncYbmhXGF94HCkAX2lEb18YfkE0EXFJDGCrUiN4ExodXQA6bksQf0DkWI9ZKDFkMGSoVIhOdJpyfOFRCQhWOrLg%2BFI4z180ABFiRCYyAG0AXRYqReWMACMQZChSFwtkYnhbM1p-dSgAWhsXpbByGHT9w6g0AAlAQmDA6KzgS5xDzgYEAK3gOnM2j0NCqyDO5kQYEUNE61kkDnwjmhHhg6LOAH46jhJBBELZ4HUbMB-GIACaSCg3fowfxWHC%2BVikskwSkwACMUSiMAAVDAALLENA0mykaJRPEgqySOXysIsEVk8wvCUHDy-A6xcAAVWC7NupHoqEwJBoY0KE0JnA48F0wTOsCuwFktwAwqiYGIEJsfmwgA) and you not limited only for network cache, Reatom is enough powerful and expression for describing any kind of states.

<!-- Reatom is a mix of all best from MobX and Redux. It processes immutable data by separated atoms and use single global store, which make dataflow controllable and predictable, but granular and efficient. -->

To get maximum of Reatom and the ecosystem just go to [tutorial](https://www.reatom.dev/tutorial). If you need something tiny - check out [the core package docs](https://reatom.dev/packages/core). Also, we have a [package for testing](https://www.reatom.dev/packages/testing)!

## Roadmap

- Finish [forms package](https://github.com/artalar/reatom/tree/v3/packages/form)
- Finish [persist](https://github.com/artalar/reatom/tree/v3/packages/persist) and [navigation](https://github.com/artalar/reatom/tree/v3/packages/navigation) packages
- Add adapters for most popular ui frameworks: ~~react~~ ([already have](https://www.reatom.dev/packages/npm-react)), angular, vue, svelte, solid.
- Port some components logic from reakit.io, to made it fast, light and portable.
- Add ability to made async transaction and elaborate optimistic-ui patterns and helpers / package.
- Try to write own jsx renderer.

## FAQ

### Why not Redux?

Redux is awesome and Reatom is heavy inspired by it. Immutability, separation of computations and effects are good architecture designs principles. But there are a lot of missing features, when you trying to build something huge, or want to describe something small. Some of them is just impossible to fix, like O(n) complexity, others is really [hard to improve](https://github.com/reduxjs/reselect/discussions/491). Here is a list.

- Selectors are not inspectable, it caches are not displayed in devtools.
- Difficult static type inference, every selector must know the full path to parent state.
- Hard for modular architecture: lazy loading is not handy, every selector must know about parent state.
- Separation of interfaces (reducers and selectors) is excessively for feature-first / component architecture.
- Selectors - **manual** API for state, they must be **manually** described and memoized, which takes a lot of work (code).
- Selectors are executed after state change at subscriptions - error in selector will throw an error and it is not possible to restore the previous valid state, which is not compatible with [ACID](/general/what-is-state-manager#transaction).
- Classic reducer API and [static] type descriptions have a lot of boilerplate, even with RTK.
- Only one subscriptions queue made Redux performance O(n) for any small update.
- If selector is not memoized or it have mistakes and produce unique reference each time (which happens often) it would call trigger dependencies recalculations even if update was come for different part of the state.
- Middleware is a confusing pattern that can unexpectedly modify the behavior of the store. For example, actions for redux-thunk do not log.
- No good effect-management.

Reatom solves all this problems and bring much more features by the almost same size.

### Why immutability?

When Redux brings to our world it perfectly solved the concurrency problem ([glitches](https://en.wikipedia.org/wiki/Reactive_programming#Glitches)) of dependent computations and increase debug experience a lot, as it allows you to log and asynchronously inspect each update snapshot in any time.

### What LTS policy is used and what about bus factor?

Reatom always developed for long time usage. Our first LTS (Long Time Support) version (v1) [was released in December 2019](https://github.com/artalar/reatom/releases/tag/v1.0) and in 2022 we provided breaking changes less [Migration guid](https://www.reatom.dev/packages/core-v1#migration-guide) to the new LTS (v3) version. 3 years of successful maintains is not ended, but continued in [adapter package](https://www.reatom.dev/packages/core-v1). We hope it shows and prove our responsibility.

To be honest, right now bus factor is one, [@artalar](https://github.com/artalar/) - the creator and product owner of this, but it wasn't always like this [as you can see](https://github.com/artalar/reatom/graphs/contributors). Reatom PR wasn't great in a past couple of years and a lot of APIs was experimental during development, but now with the new LST version (v3) we bring to new feature of this lib and application development experience for a long time.

### How performant Reatom is?

[Here is the benchmark](https://github.com/artalar/reactive-computed-bench) of complex computations for different state managers. Note that Reatom by default uses immutable data structures and all atoms has a lifecycle hooks and works in a separate context, which means the Reatom test checks more features, than other state manager tests. Anyway, for the middle numbers Reatom faster than MobX which is pretty impressive.

Also, check out [atomization guild](https://www.reatom.dev/guides/atomization).

### Community

- [en](https://github.com/artalar/reatom/discussions)
- [ru](https://t.me/reatom_ru)

### How to support the project?

https://www.patreon.com/artalar_dev
