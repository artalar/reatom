Adapter for [cookie-baker](https://github.com/BataevDaniil/cookie-baker) package

## Installation
For browser

<Tabs>
<TabItem label="npm">

  ```sh
npm install @reatom/npm-cookie-baker @cookie-baker/core @cookie-baker/browser
  ```

</TabItem>
<TabItem label="pnpm">

  ```sh
pnpm add @reatom/npm-cookie-baker @cookie-baker/core @cookie-baker/browser
  ```

</TabItem>
<TabItem label="yarn">

  ```sh
yarn add @reatom/npm-cookie-baker @cookie-baker/core @cookie-baker/browser
  ```

</TabItem>
<TabItem label="bun">

  ```sh
bun add @reatom/npm-cookie-baker @cookie-baker/core @cookie-baker/browser
  ```

</TabItem>
</Tabs>
For Node.js

<Tabs>
<TabItem label="npm">

  ```sh
npm install @reatom/npm-cookie-baker @cookie-baker/core @cookie-baker/node
  ```

</TabItem>
<TabItem label="pnpm">

  ```sh
pnpm add @reatom/npm-cookie-baker @cookie-baker/core @cookie-baker/node
  ```

</TabItem>
<TabItem label="yarn">

  ```sh
yarn add @reatom/npm-cookie-baker @cookie-baker/core @cookie-baker/node
  ```

</TabItem>
<TabItem label="bun">

  ```sh
bun add @reatom/npm-cookie-baker @cookie-baker/core @cookie-baker/node
  ```

</TabItem>
</Tabs>

## Example
[codesandbox](https://codesandbox.io/s/reatom-cookie-baker-ec6h63-ec6h63?file=/src/App.tsx)


```ts
import {
  Cookie as CookieClient,
  createRealTimeCookie,
} from '@cookie-baker/browser'
import { reatomCookie } from '@reatom/npm-cookie-baker'

type CookieModel = {
  ga?: string
  adc?: string
}

const cookie = new CookieClient<CookieModel>()
const realTimeCookie = createRealTimeCookie(cookie)

const { cookieAtom, set, remove } = reatomCookie(cookie, realTimeCookie)

const ctx = createContext()
ctx.subscribe(cookieAtom, console.log)

set(ctx, 'adc', 'dasf')
remove(ctx, 'ga')
cookie.set('adc', 'set-cookie-from-imperative-modify')
```
