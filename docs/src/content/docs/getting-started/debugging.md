---
title: Debugging
description: Explaining how to install and use debug tools
sidebar:
  order: 3
show: false
---

<!-- TODO add `anAtom.onChange(console.log)` docs above -->

For debugging, we recommend using the `@reatom/logger` package, which is included in the `@reatom/framework`.

## Installation

```sh
npm i @reatom/logger
```

After the installation is finished, you need to connect the logger to the reatom context.

```ts
import { createCtx } from '@reatom/core'
import { connectLogger } from '@reatom/logger'

const ctx = createCtx()
connectLogger(ctx)
```

You can find more settings in the [@reatom/logger](/package/logger) documentation.

## Usage

The immutable nature of reatom gives us incredible possibilities for debugging any data flow, whether synchronous or asynchronous.
Let's start with a simple example.

```ts
import { createCtx, atom } from '@reatom/core'
import { connectLogger } from '@reatom/logger'

const ctx = createCtx()
connectLogger(ctx)

const counterAtom = atom(0)
const doubledAtom = atom((ctx) => counterAtom * 2)

counterAtom(ctx, 24)
```

Here is what we see in logs:

```
Reatom 1 transaction
├─ 3:37:34 PM 477ms
├─ counterAtom
│  ├─ cause: "root"
│  ├─ history: [...]
│  ├─ newState: 0
│  ├─ oldState: 24
│  ├─ patch: {...}
│  └─ time: 275.94
├─ 24
├─ doubledAtom
│  ├─ cause: "<-- counterAtom"
│  ├─ history: [...]
│  ├─ newState: 0
│  ├─ oldState: 48
│  ├─ patch: {...}
│  └─ time: 275.96
└─ 48
```

Records come in pairs: the atom and its new state value.
Under the atom name record, you can find a few properties:
 - cause: Describes why this update happened and what triggered it.
 - history: Shows the atom values before the update.

Check out the [@reatom/logger](/package/logger) package documentation for a more complex example.
