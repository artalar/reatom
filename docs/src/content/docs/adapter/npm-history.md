---
title: npm-history
description: Reatom for npm-history
---

## Installation

```sh
npm i @reatom/npm-history
```

## Usage

You should setup `historyAtom` in the root of your app, before other dependent atoms will touch the ctx.

```ts
import { historyAtom } from '@reatom/npm-history'
import { createBrowserHistory } from 'history'

historyAtom(ctx, createBrowserHistory())
```

```ts
import { History, Location, To, Blocker } from 'history'

export interface HistoryAtom extends AtomMut<History> {
  back: Action<[]>
  block: Action<[blocker: Blocker], () => void>
  forward: Action<[]>
  go: Action<[delta: number]>
  location: Atom<Location>
  push: Action<[to: To, state?: any]>
  replace: Action<[to: To, state?: any]>
}

export const historyAtom: HistoryAtom
```
