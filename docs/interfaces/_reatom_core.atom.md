# Interface: Atom ‹**T**›

Atoms\* are state**less** instructions to calculate derived state in the right order (without [glitches](https://stackoverflow.com/questions/25139257/terminology-what-is-a-glitch-in-functional-reactive-programming-rx)).

> For redux users: **atom - is a thing that works concomitantly like reducer and selector.**

Atom reducers may depend on declared action or other atoms and must be pure functions that return new immutable version of the state. If a reducer returns old state – depended atoms and subscribers will not be triggered.

> [\*](https://github.com/calmm-js/kefir.atom/blob/master/README.md#related-work) The term "atom" is borrowed from [Clojure](http://clojure.org/reference/atoms) and comes from the idea that one only performs ["atomic"](https://en.wikipedia.org/wiki/Read-modify-write), or [race-condition](https://en.wikipedia.org/wiki/Race_condition) free, operations on individual atoms. Besides that reatoms atoms is stateless and seamlessly like [Futures](https://en.wikipedia.org/wiki/Futures_and_promises) in this case.
