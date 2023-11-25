# Reatom + Next.js example

A sample project with Reatom and SSR fetching and caching. The key feature is that the fetching code is isomorphic: it has no environment dependencies and no custom logic, all the work involved is done in the root of the application: just cache aggregation, serialisation and restoration.

Related docs:

- https://www.reatom.dev/package/persist
- https://www.reatom.dev/package/url
- https://www.reatom.dev/package/effects

[Open in StackBlitz](https://stackblitz.com/github/artalar/reatom/tree/v3/examples/nextjs)

Commit with the key changes for SSR support: https://github.com/artalar/reatom-nextjs/commit/ca0099bcddc0fbd5bc8c76eeb160f828838453d7
