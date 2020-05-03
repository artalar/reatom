# Module: @reatom/debug

<div align="center">
<br/>

[![reatom logo](https://reatom.js.org/logos/logo.svg)](https://reatom.js.org)

</div>

Package of Reatom for generating dynamic names with contain source path

[![npm](https://img.shields.io/npm/v/@reatom/debug?style=flat-square)](https://www.npmjs.com/package/@reatom/debug)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/debug?style=flat-square)](https://bundlephobia.com/result?p=@reatom/debug)

[Open in docs](https://reatom.js.org/#/packages/debug)

## Install

```sh
npm i -D @reatom/debug
```

or

```sh
yarn add @reatom/debug --dev
```

> NOTE. **@reatom/debug** depends on and works with [@reatom/core](https://reatom.js.org/#/reatom-core).

## Usage

### redux-devtools

Basic

```js
import { createStore } from '@reatom/core'
import { connectReduxDevtools } from '@reatom/debug'

const store = createStore()

const unsubscribeDevTools = connectReduxDevtools(store)
```

With React

```js
import { createStore } from '@reatom/core'
import { context } from '@reatom/react'
import { connectReduxDevtools } from '@reatom/debug'

function App() {
  const store = createStore()

  useEffect(() => connectReduxDevtools(store), [])

  return (
    <context.Provider value={store}>
      <Main />
    </context.Provider>
  )
}
```

### add file path to names of actions and atoms declarations

```js
import { genIdFromLine } from '@reatom/debug'
import { declareAtom, declareAction, setNameToId } from '@reatom/core'

setNameToId(
  genIdFromLine({
    showColumn: false,
  }),
)

// Now genIdFromLine will be used for processing id generation
// for actions and atoms

// Examples:

const action = declareAction('myAction')
// myAction [/src/folder/index.js:4]

const atom = declareAtom('myAtom', 0, () => {})
// myAtom [/src/folder/index.js:5]
```

## Index

### References

- [connectReduxDevtools](_reatom_debug.md#markdown-header-connectreduxdevtools)
- [genIdFromLine](_reatom_debug.md#markdown-header-genidfromline)

### Functions

- [connectReduxDevtools](_reatom_debug.md#markdown-header-connectreduxdevtools)
- [genIdFromLine](_reatom_debug.md#markdown-header-genidfromline)

## References

### <a id="markdown-header-connectreduxdevtools" name="markdown-header-connectreduxdevtools"></a> connectReduxDevtools

• **connectReduxDevtools**:

---

### <a id="markdown-header-genidfromline" name="markdown-header-genidfromline"></a> genIdFromLine

• **genIdFromLine**:

## Functions

### <a id="markdown-header-connectreduxdevtools" name="markdown-header-connectreduxdevtools"></a> connectReduxDevtools

▸ **connectReduxDevtools**(`store`: [Store](_reatom_core.md#markdown-header-store), `config`: object): _undefined | function_

**Parameters:**

| Name     | Type                                           | Default |
| -------- | ---------------------------------------------- | ------- |
| `store`  | [Store](_reatom_core.md#markdown-header-store) | -       |
| `config` | object                                         | {}      |

**Returns:** _undefined | function_

---

### <a id="markdown-header-genidfromline" name="markdown-header-genidfromline"></a> genIdFromLine

▸ **genIdFromLine**(`config`: Partial‹GenConfiguration›): _\_genIdFromLine_

**Parameters:**

| Name     | Type                      | Default              |
| -------- | ------------------------- | -------------------- |
| `config` | Partial‹GenConfiguration› | configurationDefault |

**Returns:** _\_genIdFromLine_
