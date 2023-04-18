# Changelog

## [3.4.0](https://github.com/artalar/reatom/compare/lens-v3.3.3...lens-v3.4.0) (2023-04-18)


### Features

* **lens:** add new operators and onLensUpdate ([#533](https://github.com/artalar/reatom/issues/533)) ([2442ca3](https://github.com/artalar/reatom/commit/2442ca34b6ab1fdc0c0aff52d18e85999e6de607))


### Bug Fixes

* **lens:** add LensEffect ([c304f4d](https://github.com/artalar/reatom/commit/c304f4d5a6d5230a906fdad3891043c5f1543a63))
* **lens:** mapPayload 4 arg state ([0f527ed](https://github.com/artalar/reatom/commit/0f527ed66a9b1f7d622f17fa77d995652edfe7d7))
* **lens:** use onUpdate ([230a9c9](https://github.com/artalar/reatom/commit/230a9c9f920273d16eae67344acc309ad583f068))

## [3.3.0](https://github.com/artalar/reatom/compare/lens-v3.2.0...lens-v3.3.0) (2023-04-10)

**feat(lens): new operators for onLensUpdate**

Add onDeepUpdate to handle updates from the whole chain.

add new operators: combine, effect, withOnUpdate, toAction.

Refactor existed operators to add "deps" property with a list of dependencies.

**feat(lens): add general delay operator**

made limits optional atoms (for debounce too) add throttle, add tests

separate operators to different files

change return type of all operators to LensAtom / LensAction

**docs(lens): add small peace of docs**

**feat(lens): rename onDeepUpdate to onLensUpdate**

add toLens
