# Interface: Atom <**T**>

Atoms\* are state**less** instructions to calculate derived state in the right order (without [glitches](https://stackoverflow.com/questions/25139257/terminology-what-is-a-glitch-in-functional-reactive-programming-rx)).

> For redux users: **atom - is a thing that works concomitantly like reducer and selector.**

Atom reducers may depend on declared action or other atoms and must be pure functions that return new immutable version of the state. If a reducer returns old state – depended atoms and subscribers will not be triggered.

> [\*](https://github.com/calmm-js/kefir.atom/blob/master/README.md#related-work) The term "atom" is borrowed from [Clojure](http://clojure.org/reference/atoms) and comes from the idea that one only performs ["atomic"](https://en.wikipedia.org/wiki/Read-modify-write), or [race-condition](https://en.wikipedia.org/wiki/Race_condition) free, operations on individual atoms. Besides that reatoms atoms is stateless and seamlessly like [Futures](https://en.wikipedia.org/wiki/Futures_and_promises) in this case.

#### Signature

```typescript
```

## Type parameters

▪ **T**

## Hierarchy

- object

  ↳ **Atom**

## Callable

▸ (`state?`: [State](../modules/_reatom_core.md#markdown-header-state), `action?`: [Action](../modules/_reatom_core.md#markdown-header-action)‹any›): _Record‹string, T | any›_

Atoms\* are state**less** instructions to calculate derived state in the right order (without [glitches](https://stackoverflow.com/questions/25139257/terminology-what-is-a-glitch-in-functional-reactive-programming-rx)).

> For redux users: **atom - is a thing that works concomitantly like reducer and selector.**

Atom reducers may depend on declared action or other atoms and must be pure functions that return new immutable version of the state. If a reducer returns old state – depended atoms and subscribers will not be triggered.

> [\*](https://github.com/calmm-js/kefir.atom/blob/master/README.md#related-work) The term "atom" is borrowed from [Clojure](http://clojure.org/reference/atoms) and comes from the idea that one only performs ["atomic"](https://en.wikipedia.org/wiki/Read-modify-write), or [race-condition](https://en.wikipedia.org/wiki/Race_condition) free, operations on individual atoms. Besides that reatoms atoms is stateless and seamlessly like [Futures](https://en.wikipedia.org/wiki/Futures_and_promises) in this case.

#### Signature

```typescript
```

**Parameters:**

| Name      | Type                                                             |
| --------- | ---------------------------------------------------------------- |
| `state?`  | [State](../modules/_reatom_core.md#markdown-header-state)        |
| `action?` | [Action](../modules/_reatom_core.md#markdown-header-action)‹any› |

**Returns:** _Record‹string, T | any›_

## Index

### Properties

- [[DEPS]](_reatom_core.atom.md#markdown-header-[deps])
- [[DEPS_SHAPE]](_reatom_core.atom.md#markdown-header-optional-[deps_shape])
- [[TREE]](_reatom_core.atom.md#markdown-header-[tree])

## Properties

### <a id="markdown-header-[deps]" name="markdown-header-[deps]"></a> [DEPS]

• **[DEPS]**: _Set‹[TreeId](../modules/_reatom_core.md#markdown-header-treeid)›_

---

### <a id="markdown-header-optional-[deps_shape]" name="markdown-header-optional-[deps_shape]"></a> `Optional` [DEPS_SHAPE]

• **[DEPS_SHAPE]**? : _AtomsMap | TupleOfAtoms_

---

### <a id="markdown-header-[tree]" name="markdown-header-[tree]"></a> [TREE]

• **[TREE]**: _[Tree](../classes/_reatom_core.tree.md)_

_Inherited from **type.**computed_
