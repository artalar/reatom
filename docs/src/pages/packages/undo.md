---
layout: ../../layouts/Layout.astro
title: undo
description: Reatom for undo
---

## Installation

```sh
npm i @reatom/undo
```

## Usage

Add undo hooks to an atom.

```ts
import { atom } from '@reatom/core'
import { withUndo } from '@reatom/undo'

const inputAtom = atom('').pipe(withUndo(/* { length = 30 } */))

inputAtom.clearHistory // Action<[], void>
inputAtom.historyAtom // Atom<Array<T>>
inputAtom.positionAtom // Atom<number>
inputAtom.isRedoAtom // Atom<boolean>
inputAtom.isUndoAtom // Atom<boolean>
inputAtom.jump // Action<[by: number], T>
inputAtom.redo // Action<[], T>
inputAtom.undo // Action<[], T>
```

Add undo hooks to set of atoms and manage their history linear.

```ts
import { atom } from '@reatom/core'
import { reatomUndo } from '@reatom/undo'

const undoAtom = reatomUndo([input1Atom, input2Atom])

inputAtom.clearHistory // Action<[], void>
inputAtom.historyAtom // Atom<Array<T>>
inputAtom.positionAtom // Atom<number>
inputAtom.isRedoAtom // Atom<boolean>
inputAtom.isUndoAtom // Atom<boolean>
inputAtom.jump // Action<[by: number], T>
inputAtom.redo // Action<[], T>
inputAtom.undo // Action<[], T>
```
