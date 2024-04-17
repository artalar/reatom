Adapter for [history](https://github.com/remix-run/history) package

## Installation
<Tabs>
<TabItem label="npm">
  ```sh
npm install @reatom/npm-history
  ```
</TabItem>
<TabItem label="pnpm">
  ```sh
pnpm add @reatom/npm-history
  ```
</TabItem>
<TabItem label="yarn">
  ```sh
yarn add @reatom/npm-history
  ```
</TabItem>
<TabItem label="bun">
  ```sh
bun add @reatom/npm-history
  ```
</TabItem>
</Tabs>

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
