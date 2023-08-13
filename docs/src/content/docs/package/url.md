---
title: url
description: Reatom for url
---

This package provides a set of helpers to be sync with the url, search parameters, change it and react to it changes.

## Installation

```sh
npm i @reatom/url
```

## Usage

Base primitive is `urlAtom`, it contains `URL` and by default initiates with a browser `location.href` (see [Behavior](#behavior) for details).

You can call the `urlAtom.go` action with a root path to navigate programmatically.

### Search parameters

There is also `searchParamsAtom` which derives from `urlAtom` and allow you to handle search params reactively. You could pick needed parameter by `searchParamsAtom.lens` method just by passed key or specify the type of the parameter by providing optional `parse` and `serialize` functions.

```ts
import { searchParamsAtom } from '@reatom/url'

export const filterAtom = searchParamsAtom.lens('filters')
```

In the code below `filterAtom` is a mutable atom which changes will be synced with the passed search parameter. If you want to setup the sync for some other atom, you could use `withSearchParamsPersist` decorator.

```ts
import { reatomNumber } from '@reatom/primitives'
import { withSearchParamsPersist } from '@reatom/url'

export const pageAtom = reatomNumber(0, 'pageAtom').pipe(
  withSearchParamsPersist('page', Number),
)
```

Now you have handy `increment` and `decrement` actions in `pageAtom` and synchronization with "page" search parameter.

### Types

Here are the types of the key features.

```ts
// exported by `urlAtom`
export interface UrlAtom extends AtomMut<URL> {
  go: Action<[path: `/${string}`], URL>
  settingsAtom: AtomMut<AtomUrlSettings>
}

// exported by `searchParamsAtom`
export interface SearchParamsAtom extends Atom<Rec<string>> {
  set: Action<[key: string, value: string], void>
  /** create AtomMut which will synced with the specified search parameter */
  lens: <T = string>(
    key: string,
    parse?: (value?: string) => T,
    serialize?: (value: T) => string,
  ) => AtomMut<T>
}
```

### Behavior

When `urlAtom` is first read (directly or indirectly through `searchParamsAtom`), a subscription to the `popstate` event and interception of the `document.body` click appears. If you don't want to handle and prevent link clicks, you could call `setupUrlAtomBrowserSettings(ctx, /* shouldCatchLinkClick: */false)` action.

If you need to run your code in a different environment (unit tests or SSR) you could replace the url handling behavior by calling `setupUrlAtomSettings` action with a function for getting URL (`init` parameter) and optional `sync` parameter for subscription to URL change.

```ts
// a server handler
export const handler = async (req) => {
  const ctx = createCtx()
  const url = new URL(req.url!, `http://${req.headers.host}`)
  setupUrlAtomSettings(ctx, () => url)
  // do your stuff...
}
```
