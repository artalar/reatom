<div align="center">
<br/>

[![reatom logo](https://reatom.js.org/logos/logo.svg)](https://reatom.js.org)

</div>

# @reatom/cookie

## Install

```
npm i @reatom/cookie @cookie-baker/core
```

or

```sh
yarn add @reatom/cookie @cookie-baker/core
```

### browser

```
yarn add @cookie-baker/browser
```

or

```
npm install @cookie-baker/browser
```

### node

```
yarn add @cookie-baker/node
```

or

```
npm install @cookie-baker/node
```

## Example

```ts
import {
    Cookie as CookieClient,
    createRealTimeCookie,
} from '@cookie-baker/browser'
import {reatomCookie} from "@reatom/cookie/src";

type CookieModel = {
    ga?: string
    adc?: string
}

const cookie = new CookieClient<CookieModel>()
const realTimeCookie = createRealTimeCookie(cookie)

const {cookieAtom, set, remove} = reatomCookie(cookie, realTimeCookie)

const ctx = createContext()
ctx.subscribe(cookieAtom, console.log)

set(ctx, 'adc', 'dasf')
remove(ctx, 'ga')
cookie.set('adc', 'set-cookie-from-imperative-modify')
```
