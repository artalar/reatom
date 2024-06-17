Developer tools for states and actions inspecting

## Installation

```sh
npm install @reatom/devtools
```

## Usage

You typical setup would look like that.

```ts
import { createCtx, connectLogger } from '@reatom/framework'
import { connectDevtools } from '@reatom/devtools'

const ctx = createCtx()

if (import.meta.env.DEV) {
  connectLogger(ctx)
  connectDevtools(ctx)
}

// ...
```
