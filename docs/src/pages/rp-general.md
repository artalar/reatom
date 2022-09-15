---
layout: ../layouts/Layout.astro
title: A General Theory of Reactivity
description: A main definition of reactivity pattern with pros and cons
---

# A General Theory of Reactivity

Reactivity is a simple pattern which you could use in many complex cases, but you always should figure out the basis to understand each case. Don't try to understand a reactivity by [how](https://github.com/kriskowal/gtor) you can use it, just always repeat [what](#definition) it is and try it yourself:

## Definition

**Reactive programming is a pattern of delegating responsibility for initializing data processing to a data source, which doesn't know dependent units and can't interact with them outside one-way notification.**

The main reason for that is to move components coupling from static definition in a code to dynamic runtime linking.

Is is simpler to apply a caches for reactive interfaces, so, eventually, it helps you to built a fully-automatic cache invalidation system, which is huge!

It is a good for data flow description and a bad for data transaction description ([pitfalls](#pitfalls)).

FRP, OORP, Flux, two-way binding, single-store, granular updates are just buzzwords on top of that, other high order patterns.
Rx, Solid, React, Even Emmiter are all about reactive programming.
Proxies / lenses / pull or push are just an API, not a sense.

## Pitfalls

In one to many data structures it is a perfect way to manage coupling by reactive programming: it is just a way to remove a bottle neck of code size and complexity. But when you need to describe a step-by-step business flow you should do it in one place (one code part), otherwise it will be hard to inspect and debug it, specially with a complicated reproduction with a lot of conditions.

## Notes

- [Implementation challenges in reactive programming](https://en.wikipedia.org/wiki/Reactive_programming#Implementation_techniques_and_challenges)
