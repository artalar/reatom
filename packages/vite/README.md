# @reatom/vite

Vite plugin that automatically handles Reatom [routing HMR](https://www.reatom.dev/handbook/routing/#hot-module-replacement-vite) and [`@reatom/jsx` mount HMR](https://www.reatom.dev/reference/jsx#hot-module-replacement-vite).

## Installation

```sh
npm install -D @reatom/vite
```

## Usage

```ts
import { defineConfig } from 'vite'
import { reatom } from '@reatom/vite'

export default defineConfig({
  plugins: [reatom()],
})
```

In development the plugin:

1. **Routes** — tracks `reatomRoute(...)` / `parent.reatomRoute(...)` calls, then on hot dispose removes the old child from `parent.routes` / `urlAtom.routes` and `retryComputed(parent.outlet)` when the parent has an outlet.
2. **JSX** — tracks `mount(...)` from `@reatom/jsx`, then on hot dispose calls `unmount()` so the re-executed module can mount a fresh tree.

Modules that already contain `import.meta.hot` are left untouched so manual HMR keeps working.

### Options

```ts
reatom({
  routes: true, // default
  jsx: true, // default
  include: [/src\//],
  exclude: [/stories\//],
})
```
