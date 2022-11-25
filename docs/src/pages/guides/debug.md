---
layout: ../../layouts/Layout.astro
title: Debug
description: How to debug state change cause and asynchronous requests
---

Immutable nature of Reatom give us incredible possibilities for debugging any data flow kind: synchronous and asynchronous. The internal data structures of atoms data designed specially for simple investigation and analytics. The simples way to debug data states and it change causes is by logging `ctx`, which includes `cause` property with internal representation and all meta information.

Lets check out [this example](https://replit.com/@artalar/reatom-debug-example#src/App.tsx).

```ts
import {
  atom,
  reatomAsync,
  withDataAtom,
  withReducers,
  onUpdate,
} from '@reatom/framework'

export const fetchIssues = reatomAsync(
  (ctx, page = 1) =>
    fetch(
      `https://api.github.com/search/issues?q=reatom&page=${page}&per_page=10`,
      ctx.controller,
    ).then<{ items: Array<{ title: string }> }>((r) => {
      if (r.status !== 200) throw r.status
      return r.json()
    }),
  'fetchIssues',
).pipe(withDataAtom({ items: [] }))

export const pageAtom = atom(0, 'pageAtom').pipe(
  withReducers({
    next: (state) => state + 1,
    prev: (state) => Math.max(1, state - 1),
  }),
)

onUpdate(pageAtom, fetchIssues)

export const issuesTitlesAtom = atom((ctx) => {
  console.log('issuesTitlesAtom ctx', ctx)
  return ctx.spy(fetchIssues.dataAtom).items.map(({ title }) => title)
}, 'issuesTitlesAtom')
```

Here is what you will see inside `issuesTitlesAtom ctx` log (some data below omitted for a short, check the real log by [this link](https://reatom-debug-example.artalar.repl.co))

```json
{
  "proto": { "name": "issuesTitlesAtom" },
  "state": [],
  "cause": {
    "proto": { "name": "fetchIssues.dataAtom" },
    "state": { "total_count": 202, "incomplete_results": false, "items": [] },
    "cause": {
      "proto": { "name": "fetchIssues.onFulfill" },
      "state": [],
      "cause": {
        "proto": { "name": "fetchIssues" },
        "state": [],
        "cause": {
          "proto": { "name": "pageAtom" },
          "state": 1,
          "cause": {
            "proto": { "name": "pageAtom.next" },
            "state": [],
            "cause": { "proto": { "name": "root" } }
          }
        }
      }
    }
  }
}
```

As you could see `cause` property includes all state changes causes, even asynchronous.

**Important note** you should care: `ctx.cause` specifying after atom reducer return, so do not log `ctx.cause` directly, log `ctx` and read `cause` property in your console. Also, empty array in `state` property of actions is ok, coz it clears after transaction (computations) end, normally it includes `{ params: [...], payload: ReturnType }` of each call, you could see it persisted values by `connectLogger` from [@reatom/logger](https://www.reatom.dev/packages/logger).

By the way, you could inspect all atom and action patches by `ctx.subscribe(logs => console.log(logs))` or in the second log of `connectLogger` output.
