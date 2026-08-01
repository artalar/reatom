---
title: History
description: How Reatom evolved — from ACID atoms to async context, atomization, and the sync engine
---

## Zen

- **Primitives outperform frameworks**
- **Composition beats configuration**
- **Explicit specifics, implicit generics**
- **Compatibility worth complexity**

<!-- Our long term goal it is to add "Easy to use, hard to misuse" (To fall into the pit of success), but it is really hard to archive -->

## Goal

The main goal of Reatom is to be the best universal state manager for any kind of application. We believe that UX is a pillar of a good app, and great UX is built from a set of complex local states, so Reatom is a tool to manage it properly.

## Evolution

Reatom is built for the long haul.
We dropped our first Long Term Support (LTS) version (v1) in [December 2019](https://github.com/reatom/reatom/releases/tag/v1.0). And it was supported for a half of decade. We are always open to is sues and PRs for older versions, if it will help you!

We have [a lot of contributors](https://github.com/reatom/reatom/graphs/contributors) working on different packages. We are trying to build a super stable and predictable ecosystem. To achieve this, we welcome you to put your package into our monorepo and check the [contribution](/contributing) guidelines.

### Versioning

Since the 1k version (`1000`), Reatom uses epoch-based versioning inspired [by Antfu's post](https://antfu.me/posts/epoch-semver). The next epoch release (`2000`) will be in 2026-2027 and may include meaningful changes; the whole ecosystem will be migrated together with the core package. The classic major versions (`1001`, `1002`, `1042`) and other minor and patch versions follow standard SemVer and represent small changes in a general epoch context.

## How performant Reatom is?

Reatom has best possible performance according to its features! The more complex your application, the faster Reatom will be compared to competitors.

Check out this [benchmark](https://github.com/artalar/reactive-computed-bench) for complex computations across different state managers.
Note that Reatom uses immutable data structures and operates in a separate async context, which bring a lot of features, which will take too many overhead with other set of tools. That means the Reatom test covers more features than other state manager tests
Still, Reatom performs faster than MobX for mid-range numbers, which is pretty impressive.

Also, remember to check out our [atomization guide](/recipes/atomization).

### Why not Proxy?

Proxy is a common pattern for working with signals, but it could be pretty messy in a scale. Atomization, as Reatom employs it, offers several advantages over Proxy-based reactivity:

- **Explicit Reactivity**: With atomization, it's always clear what is reactive and what isn't - hover a property and you get a type-hint. Proxies can make reactivity implicit and harder to trace in your codebase.
- **Simplified Debugging**: Mutable structures, often used with Proxies, are inherently more complex to debug, especially in asynchronous scenarios. Atomization, combined with Reatom's immutable approach, provides a clearer path for inspecting state changes and understanding data flow. You're also less likely to encounter situations requiring a `toJS`-like conversion (common in MobX) to inspect or pass data.
- **Controlled Performance**: While a direct Proxy interface might seem lightweight, it still heavier than an atom function call. But the real performance challenge arises from the often-uncontrolled creation of reactive structures. Atomization gives you fine-grained control, allowing you to define reactive elements precisely where needed, avoiding unnecessary overhead.

Also, with `@reatom/zod`, you can create safer reactive structures even shorter than with Proxy.

## Package Updates

> Keywords: "package duplication", "deduplication", "dedupe"...

When updating Reatom packages, you may encounter type incompatibilities, unexpected build or runtime errors due to your package manager's deduplication policy. Reatom core package is singleton, it uses internal `STACK` for the frames stack management and other singleton variables and services. However, there are no standards for this type of package, and different package managers may deduplicate them differently.

Therefore, we recommend running deduplication manually after updating Reatom packages. For example, if you have installed `@reatom/core` and `@reatom/react`, and you want to update the react adapter to the latest version, use one of the following commands.

NPM has special flag to deduplicate related packages during installation:

```bash
npm i --prefer-dedupe @reatom/react@latest
```

`yarn@1` deduplicates packages by default during installation, but `yarn@3` and `yarn@4` do not. For these versions, you need to run deduplication manually:

```sh
yarn add @reatom/react@latest && yarn dedupe "@reatom/*"
```

PNPM does not deduplicate packages by default, and there isn't a deduplication command for a specific **set** of packages. You can run `pnpm dedupe @reatom/core`, but for sure you will need to manually remove all installed Reatom packages and install it again:

```sh
pnpm rm @reatom/core @reatom/react && pnpm i @reatom/core@latest @reatom/react@latest
```

## Build Target Compatibility

The `wrap` function preserves Reatom's reactive context across async boundaries using a microtask-based seal mechanism. This mechanism relies on native `async`/`await` behavior. If your bundler or compiler targets below **ES2017**, it will transform `async`/`await` into `.then()` chains, which introduces extra microtask ticks and breaks the seal — resulting in a `"missing async stack"` error at runtime.

Ensure your **entire** toolchain (TypeScript, bundler, test runner) targets `es2017` or higher. Most modern defaults are safe (e.g., Vite targets Chrome 107+), but an explicit lower target anywhere in the chain can trigger the issue. See [#1250](https://github.com/reatom/reatom/issues/1250) for details and per-tool configuration guidance.

## Media

- [en twitter](https://twitter.com/ReatomJS)
- [en discord](https://discord.gg/EPAKK5SNFh)
- [en github discussion](https://github.com/reatom/reatom/discussions)
- [ru telegram](https://t.me/reatom_ru)
- [llms.txt](https://v1001.reatom.dev/_llms-txt/getting-started.txt)

## Migration from v3

v1000 solves the most annoying problem of v3 - explicit context management. Now, as others signals libraries, Reatom operate context by global variable which is hidden from public API. **But** the ability to create your own custom context and scope your processes is still here! With:

- `clearStack()` you can throw away the default context, and add runtime checks that there should be your custom context.
- `context.start()` you can create your own context, for SSR handler or each test run. You should use it for React `reatomContext.Provider`, but the provider required only if you choose to start with clearStack.
- `wrap` for context preservation across async boundaries. Check the rules above.

New rules:

- **NEVER** use `ctx` or `Ctx`. The API is context-based implicitly via `wrap`.
- `ctx.schedule(() => promise)` -> `wrap(promise)`
- `ctx.spy(dataAtom)` -> `data()`
- `ctx.get(dataAtom)` -> `peek(data)`
- `atom(callback)` -> `computed(callback)`
- `dataAtom(ctx, newState)` -> `data.set(newState)`
- `dataAtom(ctx, (state) => newState)` -> `data.set((state) => newState)`
- `ctx.spy(dataAtom, callback)` -> `ifChanged(data, callback)`
- `ctx.spy(doSome, callback)` -> `getCalls(doSome).forEach(callback)`
- Type `Atom` -> `AtomLike`
- Type `AtomMut` -> `Atom`

### Methods

- `reatomAsync(cb)` -> `action(cb).extend(withAsync())`
- `reatomResource(cb)` -> `computed(cb).extend(withAsyncData())`
- `reaction` -> `effect`
- `anAtom.onChange(cb)` -> `anAtom.extend(withChangeHook(cb))`
- `onConnect(anAtom, cb)` -> `anAtom.extend(withConnectHook(cb))`
- `take(anAtom, (ctx, value, SKIP) => value || SKIP)` -> `take(anAtom, (value) => value || throwAbort())`
- `withConcurrency` -> `withAbort`
- `onCtxAbort` -> `abortVar.subscribe`
