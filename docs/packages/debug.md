# @reatom/debug

Package of Reatom for generating dynamic names with contain source path 

[![npm](https://img.shields.io/npm/v/@reatom/debug?style=flat-square)](https://www.npmjs.com/package/@reatom/debug) 
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@reatom/debug?style=flat-square)](https://bundlephobia.com/result?p=@reatom/debug)

## Install

```sh
npm i -D @reatom/debug
```
or
```sh
yarn add @reatom/debug --dev
```

> NOTE. **@reatom/debug** depends on and works with [@reatom/core](https://artalar.github.io/reatom/#/reatom-core).

## Usage

```js
import { genIdFromLine } from '@reatom/debug'
import { declareAtom, declareAction, setNameToId } from '@reatom/core'

setNameToId(genIdFromLine({
  showColumn: false,
}))

// Now genIdFromLine will be used for processing id generation 
// for actions and atoms

// Examples:

const action = declareAction('myAction') 
// myAction [/src/folder/index.js:4]

const atom = declareAtom('myAtom', 0, () => {}) 
// myAtom [/src/folder/index.js:5]
```
---

[Open source code on GitHub](https://github.com/artalar/reatom/tree/master/packages/debug)
