# Interface: Atom <**T**>

## Type parameters

▪ **T**

## Hierarchy

- object

  ↳ **Atom**

## Callable

▸ (`state?`: [State](../modules/_reatom_core.md#markdown-header-state), `action?`: [Action](../modules/_reatom_core.md#markdown-header-action)‹any›): _Record‹string, T | any›_

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
