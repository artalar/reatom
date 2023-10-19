[`@reatom/persist`](https://www.reatom.dev/package/persist) adapter for the Web Storage APIs.

## Installation

```sh
npm i @reatom/persist-web-storage
```

## Usage

There are two similar types adapters for each storage: `withLocalStorage`, `withSessionStorage`.

## Simple example

```ts
import { atom } from '@reatom/framework'
import { withLocalStorage } from '@reatom/persist-web-storage'

export const tokenAtom = atom('', 'tokenAtom').pipe(withLocalStorage('token'))
```
