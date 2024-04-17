Adapter for [svelte](https://svelte.dev/) framework

## Installation

<Tabs>
<TabItem label="npm">

  ```sh
npm install @reatom/npm-svelte
  ```

</TabItem>
<TabItem label="pnpm">

  ```sh
pnpm add @reatom/npm-svelte
  ```

</TabItem>
<TabItem label="yarn">

  ```sh
yarn add @reatom/npm-svelte
  ```

</TabItem>
<TabItem label="bun">

  ```sh
bun add @reatom/npm-svelte
  ```

</TabItem>
</Tabs>


## Usage

First of all, you need to setup `ctx` for svelte context in your root component.

```ts
import { setupCtx } from '@reatom/npm-svelte'

setupCtx()
```

We recommend to add logger for dev environment, from [@reatom/logger](https://www.reatom.dev/package/logger) directly, or from [@reatom/framework](https://www.reatom.dev/package/framework).

```ts
import { createCtx, connectLogger } from '@reatom/framework'
import { setupCtx } from '@reatom/npm-svelte'
import { dev } from '$app/environment' // SvelteKit

const ctx = createCtx()
if (dev) connectLogger(ctx)
setupCtx(ctx)
```

Than you can bind `subscribe` and `set` (for mutable atoms) to your atoms by `withSvelte` and use it as a store.

> **IMPORTANT**, use `withSvelte` only in component `script` tag, as it reads the context.

```svelte
<script>
  import { atom } from '@reatom/core'
  import { withSvelte } from '@reatom/npm-svelte'

  const count = atom(0).pipe(withSvelte)
</script>

<button on:click={() => $count++}>
	Clicked {$count} {$count === 1 ? 'time' : 'times'}
</button>
```

Of course, you could describe atoms as a [separate module](https://www.reatom.dev/guides/architecture) and bind actions with the same `withSvelte(anAction).set`.

[repl](https://svelte.dev/repl/416d3e07447440729416e77e45071b87?version=3.55.0).

```svelte
<script>
	import { withSvelte } from '@reatom/npm-svelte'
  import { countAtom, timesAtom, increment } from './model'

	const count = withSvelte(countAtom)
	const times = withSvelte(timesAtom)
	const handleIncrement = withSvelte(increment).set
</script>

<button on:click={handleIncrement}>
	Clicked {$count} {$times}
</button>
```

```ts
// model.ts
import { atom, action } from '@reatom/core'

export const countAtom = atom(0, 'countAtom')
export const timesAtom = atom(
  (ctx) => (ctx.spy(countAtom) === 1 ? 'time' : 'times'),
  'timesAtom',
)
export const increment = action(
  (ctx) => countAtom(ctx, (s) => ++s),
  'increment',
)
```

### Data fetching and Svelte

https://svelte.dev/repl/0613e23e6aa74246afad6d726d6c5a33?version=3.55.0
