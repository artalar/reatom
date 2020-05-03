# Class: Observable <**T, T**>

## Type parameters

▪ **T**

▪ **T**

## Hierarchy

- **Observable**

## Implements

- [Observable](_reatom_observable.observable.md)‹T›

## Implemented by

- [Observable](_reatom_observable.observable.md)

## Index

### Constructors

- [constructor](_reatom_observable.observable.md#markdown-header-constructor)

### Properties

- [atom](_reatom_observable.observable.md#markdown-header-optional-atom)
- [store](_reatom_observable.observable.md#markdown-header-store)

### Methods

- [[\$\$observable]](_reatom_observable.observable.md#markdown-header-[$$observable])
- [[Symbol.observable]](_reatom_observable.observable.md#markdown-header-[symbol.observable])
- [subscribe](_reatom_observable.observable.md#markdown-header-subscribe)

## Constructors

### <a id="markdown-header-constructor" name="markdown-header-constructor"></a> constructor

\+ **new Observable**(`store`: [Store](../modules/_reatom_core.md#markdown-header-store), `atom?`: [Atom](../interfaces/_reatom_core.atom.md)‹T›): _[Observable](_reatom_observable.observable.md)_

**Parameters:**

| Name    | Type                                                      |
| ------- | --------------------------------------------------------- |
| `store` | [Store](../modules/_reatom_core.md#markdown-header-store) |
| `atom?` | [Atom](../interfaces/_reatom_core.atom.md)‹T›             |

**Returns:** _[Observable](_reatom_observable.observable.md)_

## Properties

### <a id="markdown-header-optional-atom" name="markdown-header-optional-atom"></a> `Optional` atom

• **atom**? : _[Atom](../interfaces/_reatom_core.atom.md)‹T›_

---

### <a id="markdown-header-store" name="markdown-header-store"></a> store

• **store**: _[Store](../modules/_reatom_core.md#markdown-header-store)_

## Methods

### <a id="markdown-header-[$$observable]" name="markdown-header-[$$observable]"></a> [$$observable]

▸ **[$$observable]**(): _this_

**Returns:** _this_

---

### <a id="markdown-header-[symbol.observable]" name="markdown-header-[symbol.observable]"></a> [Symbol.observable]

▸ **[Symbol.observable]**(): _[Observable](_reatom_observable.observable.md)‹T›_

**Returns:** _[Observable](_reatom_observable.observable.md)‹T›_

---

### <a id="markdown-header-subscribe" name="markdown-header-subscribe"></a> subscribe

▸ **subscribe**(`observer`: [Observer](../interfaces/_reatom_observable.observer.md)‹T›): _[Subscription](../interfaces/_reatom_observable.subscription.md)_

Subscribes observer for Store or Atom<T> updates

**Parameters:**

| Name       | Type                                                        |
| ---------- | ----------------------------------------------------------- |
| `observer` | [Observer](../interfaces/_reatom_observable.observer.md)‹T› |

**Returns:** _[Subscription](../interfaces/_reatom_observable.subscription.md)_

▸ **subscribe**(`onNext`: function, `onError?`: Function, `onComplete?`: Function): _[Subscription](../interfaces/_reatom_observable.subscription.md)_

Subscribes onNext handler for Store or Atom<T> updates

**Parameters:**

▪ **onNext**: _function_

called when action dispatched or atom state changed

▸ (`value`: [ActionOrValue](../modules/_reatom_observable.md#markdown-header-actionorvalue)‹T›): _void_

**Parameters:**

| Name    | Type                                                                               |
| ------- | ---------------------------------------------------------------------------------- |
| `value` | [ActionOrValue](../modules/_reatom_observable.md#markdown-header-actionorvalue)‹T› |

▪`Optional` **onError**: _Function_

will never be called

▪`Optional` **onComplete**: _Function_

will never be called

**Returns:** _[Subscription](../interfaces/_reatom_observable.subscription.md)_
