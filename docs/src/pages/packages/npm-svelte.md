---
layout: ../../layouts/Layout.astro
title: npm-svelte
description: Reatom adapter for Svelte
---

## Installation

```sh
npm i @reatom/npm-svelte
```

## Usage

First of all, you need to setup `ctx` for svelte context in your root component.

```ts
import { setupCtx } from '@reatom/npm-svelte'

setupCtx()
```

We recommend to add logger for dev environment, from [@reatom/logger](/packages/logger) directly, or from [@reatom/framework](/packages/framework).

```ts
import { createCtx, connectLogger } from '@reatom/framework'
import { setupCtx } from '@reatom/npm-svelte'
import { dev } from '$app/environment' // SvelteKit

const ctx = createCtx()
if (dev) connectLogger(ctx)
setupCtx(ctx)
```

Than you can bind `subscribe` and `set` (for mutable atoms) to your atoms by `withSvelte` and use it as a store.

```svelte
<script>
  import { atom } from '@reatom/core'
  import { withSvelte } from '@reatom/npm-svelte'

  const count = atom(0).pipe(withSvelte())
</script>

<button on:click={() => $count++}>
	Clicked {$count} {$count === 1 ? 'time' : 'times}
</button>
```

Of course, you could describe atoms as a [separate module](/guides/architecture) and bind actions by `bindSvelte`.

```svelte
<script>
  import { bindSvelte } from '@reatom/npm-svelte'
  import { countAtom, timesAtom, increment } from './model'
</script>

<button on:click={bindSvelte(handleClick)}>
	Clicked {$countAtom} {$timesAtom}
</button>
```

```ts
// model.ts
import { atom, action } from '@reatom/core'
import { withSvelte } from '@reatom/npm-svelte'

export const countAtom = atom(0).pipe(withSvelte())
export const timesAtom = atom((ctx) =>
  ctx.spy(countAtom) === 1 ? 'time' : 'times',
).pipe(withSvelte())

export const increment = action((ctx) => countAtom(ctx, (s) => ++s))
```
