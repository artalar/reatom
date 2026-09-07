---
name: reatom
description: Implements and documents Reatom v1001 (@reatom/core) using project conventions. Use when a touched file imports `@reatom/*`, when the code declares Reatom atoms, computeds, actions, or effects (with or without a type argument), calls `wrap`, or chains `.extend`, when it defines or edits `reatom*` factories and the models built on them, and when writing or changing Reatom async flows, routing, forms, persistence, framework adapters, examples, or docs — or when answering a Reatom API question. Load it the moment such code is in scope, even if the user never says "Reatom" and only says "fix this store", "add a field to the model", or "why does this not update".
---

# Reatom

Use this skill when implementing or explaining Reatom v1001. Treat [REFERENCE.md](REFERENCE.md) as the canonical API reference bundled with this skill.

## How to use

1. Read the sections of [REFERENCE.md](REFERENCE.md) that match the task — do not load generic React/Solid/Vue state patterns when they conflict with the reference.
2. Follow existing code in the touched package or example for naming, file layout, and extension style.
3. For deep async flows (`wrap`, `withAsyncData`, `withAbort`, sampling, Suspense), switch to the `reatom-async` skill.
4. For `@reatom/jsx` (native DOM JSX, mount, props, css prop), switch to the `reatom-jsx` skill.
5. For pull requests, reviews, or skeptic validation of agent output, switch to the `reatom-review` skill.

## Section map

Use this map to open only the relevant parts of [REFERENCE.md](REFERENCE.md):

| Topic                                   | Section                                   |
| --------------------------------------- | ----------------------------------------- |
| Atoms, computed, action, effect, extend | Core primitives and mental model          |
| Queries and mutations                   | withAsync                                 |
| Async context after await / callbacks   | **wrap** rules                            |
| Collections, boolean, route helpers     | Primitives quick usage                    |
| Nested reactive fields                  | Atomization                               |
| Subscribe error callback                | Subscribe error listener                  |
| Logging, log.label, log.state           | Full SPA example (logging setup)          |
| Hooks, connect/disconnect, lazy work    | Lifecycle and extension hooks             |
| DOM / external events                   | Event sampling and orchestration          |
| Hot derivations                         | Memoization: **memo** and **memoKey**     |
| Fields and validation                   | Forms: base usage and reactive validation |
| SPA routes and loaders                  | Routing                                   |
| Search params, storage                  | URL sync and persistence helpers          |
| React Suspense integration              | Suspense notes                            |
| Batched updates                         | Transactions notes                        |
| Tests and SSR                           | SSR and testing                           |
| Upgrades from older Reatom              | v3 migration highlights                   |

Deeper recipes and adapter docs live on [v1001.reatom.dev](https://v1001.reatom.dev) under `/docs/handbook/*` and `/docs/reference/*`.

## Implementation defaults

- Named atoms, actions, computed values, and effects; factory names use the `reatom*` prefix.
- Reads: zero-arg call. Writes: `.set(...)`.
- Idempotent reads: `computed(async () => ...).extend(withAsyncData(...))`.
- Commands/mutations: `action(async () => ...).extend(withAsync(...))`.
- Async boundaries that leave the Reatom frame: `await wrap(promise)`; external callbacks: pass `wrap(fn)`.
- Derived state in `computed`; side effects in `effect` with explicit lifetime (route loader, init action, or mount scope — not unscoped module effects for feature work).
- Forms (fields, validation, submit) through `reatomForm` / `reatomField` instead of hand-rolled per-field atoms and submit actions.
- Route data through `reatomRoute` loaders; navigation with `.go(...)`, links with `.path(...)`.

When the reference and local examples disagree, prefer the reference and fix the example if it is wrong.
