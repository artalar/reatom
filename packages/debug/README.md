# @reatom/debug

## Install

```sh
npm install @reatom/debug
# OR
yarn add @reatom/debug
```
## Ussage

```js
import { genIdFromLine } from '@reatom/debug'
import { declareAtom, declareAction, setNameToId } from '@reatom/core'

setNameToId(genIdFromLine({
  showColumn: false,
}))

// now genIdFromLine will be used for processing id generation for actions and atoms
const action = declareAction('myAction') // myAction [/src/folder/index.js:4]
const atom = declareAtom('myAtom', 0, () => {}) // myAtom [/src/folder/index.js:5]
```
