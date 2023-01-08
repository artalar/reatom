## Installation

```sh
npm i @reatom/undo
```

## Usage

```ts
import { atom } from '@reatom/core'
import { withUndo } from '@reatom/undo'

const inputAtom = atom('').pipe(withUndo(/* { length = 30 } */))

inputAtom.historyAtom // Atom<Array<T>>
inputAtom.isUndoAtom // Atom<boolean>
inputAtom.isRedoAtom // Atom<boolean>
inputAtom.undo // Action<[], T>
inputAtom.redo // Action<[], T>
```
