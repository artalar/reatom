# Profiling harness

Headless profiling of the tree example against the workspace builds of `@reatom/core` and `@reatom/jsx` (`pnpm --filter @reatom/core run build && pnpm --filter @reatom/jsx run build` first).

Run from the repo root:

```bash
SCENARIO=toggle N=512 ITER=100 \
  node --import=tsx --cpu-prof --expose-gc \
  examples/reatom-jsx-tree/profile/harness.tsx
```

| Script         | DOM               | Scenarios                                                |
| -------------- | ----------------- | -------------------------------------------------------- |
| `harness.tsx`  | happy-dom         | `build`, `toggle`, `add-remove`, `rebuild`, `leak-check` |
| `core-only.ts` | none (model only) | `build`, `toggle`, `add-remove`                          |

Env vars: `SCENARIO`, `N` (tree node count), `ITER` (iterations).

## Caveats

- happy-dom's `NodeIterator` lacks `referenceNode`, which `@reatom/jsx` `mount` relies on for subscription bookkeeping; the harness polyfills it. Without the polyfill subscriptions never attach and measurements are meaningless.
- happy-dom's `Range#deleteContents`, node traversal, and `MutationObserver` are much slower than native (quadratic in places) and dominate DOM-heavy profiles (`rebuild`). Treat absolute DOM numbers as emulator-skewed; use `core-only.ts` or a real browser for kernel measurements.
- happy-dom's imperfect `MutationObserver` also produces false-positive "leaks" in `leak-check` for the mount-time generation. Real Chromium disconnects all generations — see `packages/jsx/src/leaks.tree.test.tsx`.

## Findings history

Profiling this app found the tracked-read leak in `walkLinkedList`: rendering a linked list inside a reactive function child made the wrapper computed depend on every nested list, so a single `create` remounted and remapped the entire tree (regression test: `packages/jsx/src/linked-list.remap.test.tsx`). After the fix, `add-remove` (N=256) dropped from ~19 s to ~2.6 ms per iteration in this harness.
