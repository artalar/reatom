# Class: Tree

## Hierarchy

- **Tree**

## Index

### Constructors

- [constructor](_reatom_core.tree.md#markdown-header-constructor)

### Properties

- [fnsMap](_reatom_core.tree.md#markdown-header-fnsmap)
- [id](_reatom_core.tree.md#markdown-header-id)
- [isLeaf](_reatom_core.tree.md#markdown-header-isleaf)

### Methods

- [\_getFns](_reatom_core.tree.md#markdown-header-_getfns)
- [addFn](_reatom_core.tree.md#markdown-header-addfn)
- [disunion](_reatom_core.tree.md#markdown-header-disunion)
- [forEach](_reatom_core.tree.md#markdown-header-foreach)
- [union](_reatom_core.tree.md#markdown-header-union)

## Constructors

### <a id="markdown-header-constructor" name="markdown-header-constructor"></a> constructor

\+ **new Tree**(`id`: [TreeId](../modules/_reatom_core.md#markdown-header-treeid), `isLeaf`: boolean): _[Tree](_reatom_core.tree.md)_

**Parameters:**

| Name     | Type                                                        | Default |
| -------- | ----------------------------------------------------------- | ------- |
| `id`     | [TreeId](../modules/_reatom_core.md#markdown-header-treeid) | -       |
| `isLeaf` | boolean                                                     | false   |

**Returns:** _[Tree](_reatom_core.tree.md)_

## Properties

### <a id="markdown-header-fnsmap" name="markdown-header-fnsmap"></a> fnsMap

• **fnsMap**: _Map‹[Leaf](../modules/_reatom_core.md#markdown-header-leaf), SetCounted›_

---

### <a id="markdown-header-id" name="markdown-header-id"></a> id

• **id**: _[TreeId](../modules/_reatom_core.md#markdown-header-treeid)_

---

### <a id="markdown-header-isleaf" name="markdown-header-isleaf"></a> isLeaf

• **isLeaf**: _boolean_

## Methods

### <a id="markdown-header-_getfns" name="markdown-header-_getfns"></a> \_getFns

▸ **\_getFns**(`key`: [Leaf](../modules/_reatom_core.md#markdown-header-leaf)): _SetCounted‹›_

**Parameters:**

| Name  | Type                                                    |
| ----- | ------------------------------------------------------- |
| `key` | [Leaf](../modules/_reatom_core.md#markdown-header-leaf) |

**Returns:** _SetCounted‹›_

---

### <a id="markdown-header-addfn" name="markdown-header-addfn"></a> addFn

▸ **addFn**(`fn`: [Fn](../modules/_reatom_core.md#markdown-header-fn), `key`: [Leaf](../modules/_reatom_core.md#markdown-header-leaf)): _void_

**Parameters:**

| Name  | Type                                                    |
| ----- | ------------------------------------------------------- |
| `fn`  | [Fn](../modules/_reatom_core.md#markdown-header-fn)     |
| `key` | [Leaf](../modules/_reatom_core.md#markdown-header-leaf) |

**Returns:** _void_

---

### <a id="markdown-header-disunion" name="markdown-header-disunion"></a> disunion

▸ **disunion**(`tree`: [Tree](_reatom_core.tree.md), `cb`: function): _void_

**Parameters:**

▪ **tree**: _[Tree](_reatom_core.tree.md)_

▪ **cb**: _function_

▸ (`key`: [TreeId](../modules/_reatom_core.md#markdown-header-treeid)): _any_

**Parameters:**

| Name  | Type                                                        |
| ----- | ----------------------------------------------------------- |
| `key` | [TreeId](../modules/_reatom_core.md#markdown-header-treeid) |

**Returns:** _void_

---

### <a id="markdown-header-foreach" name="markdown-header-foreach"></a> forEach

▸ **forEach**(`key`: [Leaf](../modules/_reatom_core.md#markdown-header-leaf), `ctx`: [Ctx](../modules/_reatom_core.md#markdown-header-ctx)): _void_

**Parameters:**

| Name  | Type                                                    |
| ----- | ------------------------------------------------------- |
| `key` | [Leaf](../modules/_reatom_core.md#markdown-header-leaf) |
| `ctx` | [Ctx](../modules/_reatom_core.md#markdown-header-ctx)   |

**Returns:** _void_

---

### <a id="markdown-header-union" name="markdown-header-union"></a> union

▸ **union**(`tree`: [Tree](_reatom_core.tree.md)): _void_

**Parameters:**

| Name   | Type                         |
| ------ | ---------------------------- |
| `tree` | [Tree](_reatom_core.tree.md) |

**Returns:** _void_
