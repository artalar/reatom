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

export const pageAtom = reatomNumber(0, 'pageAtom').pipe(withSearchParamsPersist('page', (page = '1') => Number(page)))
```

Now you have handy `increment` and `decrement` actions in `pageAtom` and synchronization with "page" search parameter.

Also, both `searchParamsAtom.lens` and `withSearchParamsPersist` accepts options object by the second argument, which you can use to specify `replace` strategy (`false` by default).

```ts
import qs from 'qs'
import { atom } from '@reatom/core'
import { withSearchParamsPersist } from '@reatom/url'

export const filtersAtom = atom<Filters>({}, 'filtersAtom').pipe(
  withSearchParamsPersist('filter', {
    replace: true,
    parse: (v = '') => qs.parse(v, { arrayFormat: 'bracket' }),
    serialize: (v) => qs.stringify(v, { arrayFormat: 'bracket' }),
  }),
)
```

### Types

Here are the types of the key features.

```ts
// used by `urlAtom`
export interface UrlAtom extends Atom<URL> {
  (ctx: Ctx, url: URL, replace?: boolean): URL
  (ctx: Ctx, update: (url: URL, ctx: Ctx) => URL, replace?: boolean): URL

  go: Action<[path: string, replace?: boolean], URL>
  settingsAtom: AtomMut<AtomUrlSettings>
}

// used by `searchParamsAtom`
export interface SearchParamsAtom extends Atom<Rec<string>> {
  set: Action<[key: string, value: string, replace?: boolean], void>
  del: Action<[key: string, replace?: boolean], void>
  /** create AtomMut which will synced with the specified query parameter */
  lens<T = string>(key: string, parse?: (value?: string) => T, serialize?: (value: T) => undefined | string): AtomMut<T>
  /** create AtomMut which will synced with the specified query parameter */
  lens<T = string>(
    key: string,
    options: {
      parse?: (value?: string) => T
      serialize?: (value: T) => undefined | string
      replace?: boolean
    },
  ): AtomMut<T>
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

### Integrations

By default urlAtom uses `window.location` as the source of truth (SoT). But if you using any other router manager, you should setup reactive integrations by yourself, as the native `location` API is not reactive and can't be used as the SoT.

To put the new URL from the the source of truth to `urlAtom` you should always use `updateFromSource` action, because only this updates will not be synced back and it will help you to prevent cyclic stack.

Here is the example of integration with https://reactrouter.com. Put this component in the top of your application tree (as a child of RR provider and Reatom provider)!

> You could play with it in [Tanstack VS Reatom example](https://github.com/artalar/reatom/blob/v3/examples/tanstack-vs-reatom)

```tsx
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCtx } from '@reatom/npm-react'
import { updateFromSource, urlAtom } from '@reatom/url'

export const RouterSync = () => {
  const ctx = useCtx()
  const setupRef = React.useRef(false)

  // subscribe to location changes
  useLocation()
  if (ctx.get(urlAtom).href !== location.href && setupRef.current) {
    // do not use `useEffect` to prevent race conditions (`urlAtom` reading during the render)
    updateFromSource(ctx, new URL(location.href))
  }

  const navigate = useNavigate()
  if (!setupRef.current) {
    setupRef.current = true
    urlAtom.settingsAtom(ctx, {
      init: () => new URL(location.href),
      sync: (_ctx, url, replace) => navigate(url.pathname + url.search, { replace }),
    })
    // trigger `onChange` hooks.
    urlAtom(ctx, new URL(location.href))
  }

  return null
}
```

The warning `Cannot update a component while rendering a different component ("RouterSync")` is ok, there are no way to write it in another way and fix it, as the `Router.subscribe` method is deprecated.
