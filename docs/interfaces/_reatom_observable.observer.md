# Interface: Observer <**T**>

## Type parameters

▪ **T**

## Hierarchy

- **Observer**

## Index

### Methods

- [complete](_reatom_observable.observer.md#markdown-header-optional-complete)
- [error](_reatom_observable.observer.md#markdown-header-optional-error)
- [next](_reatom_observable.observer.md#markdown-header-next)
- [start](_reatom_observable.observer.md#markdown-header-optional-start)

## Methods

### <a id="markdown-header-optional-complete" name="markdown-header-optional-complete"></a> `Optional` complete

▸ **complete**(): _void_

**Returns:** _void_

---

### <a id="markdown-header-optional-error" name="markdown-header-optional-error"></a> `Optional` error

▸ **error**(`errorValue`: string): _void_

**Parameters:**

| Name         | Type   |
| ------------ | ------ |
| `errorValue` | string |

**Returns:** _void_

---

### <a id="markdown-header-next" name="markdown-header-next"></a> next

▸ **next**(`value`: [ActionOrValue](../modules/_reatom_observable.md#markdown-header-actionorvalue)‹T›): _void_

**Parameters:**

| Name    | Type                                                                               |
| ------- | ---------------------------------------------------------------------------------- |
| `value` | [ActionOrValue](../modules/_reatom_observable.md#markdown-header-actionorvalue)‹T› |

**Returns:** _void_

---

### <a id="markdown-header-optional-start" name="markdown-header-optional-start"></a> `Optional` start

▸ **start**(`subscription`: [Subscription](_reatom_observable.subscription.md)): _void_

**Parameters:**

| Name           | Type                                               |
| -------------- | -------------------------------------------------- |
| `subscription` | [Subscription](_reatom_observable.subscription.md) |

**Returns:** _void_
