> ## Work In Progress

# FLAXOM

<div align="center"><img src="logo.png" alt="blend of one way data flow by global store and decentralizated atoms" align="center"></div>

Event driven state manager with focus on **all** need

- small size (2 KB gziped) and ES5 support
- simple abstraction and friendly DX with minimum boilerplate
- scaling (performance) and modular
- static typed (TS, Flow)
- easy testing
- DI (by functional composition)
- atomic stores (reducers) and subscribtions
- usefull debugging, devtools (redux support)
- declarative and predictable specification of state shape and state mutation
- synchronous glitch free (diamond problem free)
- usefull store fabric (locales, SSR)
- simple integration with other libraries (Observable, etc)
- awkward for write bad code
- handy for write good code

## Example

### Todo-list

[![Todo-list](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/flaxom-todo-app-fikvf)

> Also see tests

## Motivation

> Inspired by redux and effector

### Problems (with redux)

- Selectors are not inspectable (have not in devtools)
- Memorized selectors is extra computations by default, but it is defenetly unnecessary in SSR
- Difficult static type inference
- Selectors must know about all parents - path to the root. It hard for modular architecture
- Separation of interfaces, to reducers and selectors, complicating build separated domains
- Selectors - is **manual** API to state. It must be **manualy** memorized - and you always need to think when you need it or not (it one of the reasons of performance problems)
- Selectors execute at render - error in selector will break render (computed properties must separated from view)
- classic API reducer is had much boilerplate and [static] type description boilerplate
- Selectors "runtime" oriented, mean if some "feature" use any part of state (by selector) when you will remove that part, you get the error only when you will try to mount your "feature" at runtime (if you have not static typing). Right way - is connect all features staticaly by imports.
- A part of problems solves by various fabric functions, but without standardization it is harmful

### So why single global state?

Immutable data-structures and single entry point for reading and writing are most debuggable things ever (I think). And it most important, because programmer read and debug code much more than write

### Goals

- Reducers may depend from other reducers
- Each reducer must know and react only to depended actions
- Subscribes to reducers
- No glitches
- No breaking changes (at all)

## FAQ

- **Why API so strange, it can't be simpler?**
  > API was designed for bet static types inference (Flow, TS)

## TODO:

- API for `.doNotTrack()` version of reducer for receive it state, but not subscribe to it
- friendly API for work with collections (based on lenses?)
