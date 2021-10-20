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

import { Cookie as CookieClient, createRealTimeCookie } from "@cookie-baker/browser";

type CookieModel = {
  ga?: string
  adc?: string
}

const cookie = new CookieClient<CookieModel>()
const realTimeCookie = createRealTimeCookie(cookie)

const cookieAtom = createCookieAtom(cookie, realTimeCookie)

cookieAtom.subscribe(console.log)
cookieAtom.set.dispatch('adc', 'dasf')
cookieAtom.remove.dispatch('ga')
cookie.set('adc', 'set-cookie-from-imperative-modify')
```

