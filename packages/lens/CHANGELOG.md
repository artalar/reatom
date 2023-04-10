# Changelog

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
