# redux-steroid
super powers for redux

> ## **WIP**

<!-- <div align="center"><img src="logo.png" alt="template logo" align="center"></div> -->

## Example

[![tr-redux example](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/4w5k42vzw9) Todo-list

> Also see tests

## Motivation

### Problems

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
- mutable version of combine and disunity vertices (when store in not notifies) for performance reasons
- delayed combine and disunity vertices for performance reasons
- friendly API for work with collections
