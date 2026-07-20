# `@reatom/core` benchmarks

All kernel / cross-library benches live in this folder. Run from
`packages/core` via the `package.json` scripts, or directly with `tsx` /
`node --import=tsx`.

| Script                          | File                    | Purpose                                       |
| ------------------------------- | ----------------------- | --------------------------------------------- |
| `pnpm run bench_compare`        | `bench_compare.ts`      | Reatom-only A/B scenarios (kernel hot paths)  |
| `pnpm run bench_compare:mem`    | same + `--expose-gc`    | + heap-per-batch                              |
| `pnpm run bench_dynamic_ab`     | `bench_dynamic_ab.ts`   | Reatom-only dynamic dependency lists          |
| `pnpm run bench_dynamic_ab:mem` | same + `--expose-gc`    | + heap                                        |
| `pnpm run bench_profile`        | `bench_profile.ts`      | Diamond hot loop for CPU profiling            |
| `pnpm run bench_computed`       | `bench_computed.ts`     | Cross-library deep-computed comparison        |
| `pnpm run bench_computed:mem`   | same + `--expose-gc`    | + GC-aware run                                |
| `pnpm run bench_dynamic`        | `bench_dynamic.ts`      | Cross-library dynamic dependency comparison   |
| `pnpm run bench_unlink`         | `bench_unlink_order.ts` | Shared-pub teardown in LIFO/FIFO/random order |

Env filters shared by the A/B harnesses:

- `LIB=core|next` — which sources to load (`core` = `../src`, `next` =
  `../../next/src`). Default `core`. Variants must run in **separate
  processes** — they share `globalThis.__REATOM`.
- `SCENARIO=<substr>` — keep only matching scenario names.
- `BATCHES=<n>` — `bench_compare` batch count (default 30).
- `COUNTS=2048,512` — `bench_dynamic_ab` list sizes.

**Do not** wrap these A/B benches in `context.start` / `test` from
`src/test.ts`. The single-context frame-cache fast path
(`ROOTS.count === 1`) is what production apps use; starting a second
context permanently disables it for the process.

---

## `bench_compare.ts`

Reatom-only microbench of the kernel hot paths. Each scenario builds a
graph once, then runs `BATCHES` timed batches; reported value is the
median wall-clock ms (and median heap delta with `--expose-gc`).

| Scenario                          | What it stresses                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| deep diamond update ×1000         | write → mark → recompute through 8 subscribed computeds                             |
| wide fan-out (1→100) ×100         | one write, many independent subscribers                                             |
| cutoff ×1000                      | unchanged computed short-circuits downstream                                        |
| dynamic deps switch ×1000         | `link`/`unlink` on a toggle                                                         |
| unsubscribed reads ×10000         | pull-based recompute without subscribers                                            |
| action calls ×1000                | action middleware + state append (notifies periodically to avoid quadratic history) |
| wrap(fn) + variable find ×1000    | `wrap` + `Variable.find` on a short stack                                           |
| create+subscribe+unsubscribe ×500 | atom/computed lifecycle                                                             |

Constraints: no `context.start`; periodic `notify()` in action/wrap
scenarios is required (otherwise `ActionState` grows unboundedly inside
a sync batch — a bench artifact, not a library leak).

### Last results

Post-kernel-optimization `core` (Apple M-class, Node 25, `BATCHES=20`,
`--expose-gc`, 2026-07-09). Pre-opt numbers from the `next` fork A/B
report (same machine family, `BATCHES=30`).

| Scenario                   | pre-opt core | current core | heapKb/batch |
| -------------------------- | -----------: | -----------: | -----------: |
| deep diamond update ×1000  |         2.26 |     **1.66** |         5236 |
| wide fan-out ×100          |         3.23 |     **2.83** |         7139 |
| cutoff ×1000               |         0.75 |     **0.40** |         1485 |
| dynamic deps switch ×1000  |         0.76 |     **0.44** |         1485 |
| unsubscribed reads ×10000  |         2.52 |     **2.06** |         7747 |
| action calls ×1000         |         0.34 |     **0.32** |         2104 |
| wrap + variable find ×1000 |         0.72 |     **0.66** |         2971 |
| create+sub+unsub ×500      |         2.69 |     **2.58** |         4816 |

Reproduce:

```bash
pnpm run bench_compare:mem
# or
BATCHES=30 LIB=core node --expose-gc --import=tsx bench/bench_compare.ts
```

---

## `bench_dynamic_ab.ts`

Reatom-only port of the dynamic-list scenarios from `bench_dynamic.ts`.
A subscribed `sum` computed tracks a growing/shrinking/shuffling array of
atoms; each batch mutates the list and calls `notify()`.

| Scenario               | Mutation                                             |
| ---------------------- | ---------------------------------------------------- |
| growing push / unshift | append / prepend a new atom, write the previous edge |
| shrinking pop / shift  | remove from end / front, write the removed atom      |
| shuffle removal        | remove a random index                                |
| middle removal         | remove at `length/2`                                 |

Constraints: same single-context rule as `bench_compare`. `growing
unshift` writes the newly adjacent atom so the subscribed sum actually
invalidates (the upstream multi-lib bench historically wrote a
not-yet-tracked atom and all libraries "passed" equality by lagging
together).

### Last results

Current `core`, `COUNTS=512`, batchSize=4, `--expose-gc` (2026-07-09).
Pre-opt reference at count=2048 from the fork report is shown for
relative scale only (different `count`).

| Scenario        | current core (count=512, ms) | heapKb | pre-opt → opt at count=2048 |
| --------------- | ---------------------------: | -----: | --------------------------- |
| growing push    |                        0.089 |   39.7 | 0.245 → 0.175 (−29%)        |
| growing unshift |                        0.074 |   32.1 | —                           |
| shrinking pop   |                        0.056 |   26.7 | 0.224 → 0.161 (−28%)        |
| shrinking shift |                        0.061 |   19.6 | 0.229 → 0.190 (−17%)        |
| shuffle removal |                        0.073 |   20.4 | 0.239 → 0.175 (−27%)        |
| middle removal  |                        0.063 |   22.4 | 0.211 → 0.173 (−18%)        |

```bash
pnpm run bench_dynamic_ab:mem
COUNTS=2048,512 node --expose-gc --import=tsx bench/bench_dynamic_ab.ts
```

---

## `bench_profile.ts`

Fixed diamond (same shape as `bench_compare`'s deep diamond) run for
300k updates. Intended for `node --cpu-prof --import=tsx
bench/bench_profile.ts`.

### Last results

| Build        |      total ms (300k updates) |
| ------------ | ---------------------------: |
| pre-opt core |                         ~790 |
| current core | **~490–540** (one run 511.5) |

```bash
pnpm run bench_profile
node --cpu-prof --import=tsx bench/bench_profile.ts
```

---

## `bench_computed.ts`

Cross-library comparison of a deep computed diamond. Median is reported
as **% of the fastest library** per iteration; charts are written next
to this README when `chart_template.svg` is present.

Constraints (do not relax — they keep the comparison honest):

- User-space compute is integer summarization only (cheap, pure, forces
  a new value every time).
- Libraries are **shuffled** each iteration; a given library is updated
  at most once per iteration (no back-to-back same-lib updates that
  over-train the JIT).
- A minimum timeout between iterations reduces GC noise (not a perfect
  GC accounting, but the practical alternative).

Requires a built `../dist` (`pnpm run build`). Node 18+.

### Results (`bench_computed`)

Historical chart snapshots (paths relative to this folder):

### Intel(R)\_Core(TM)\_Ultra_9_185H

![](<./popular_chart_Intel(R)_Core(TM)_Ultra_9_185H.svg>)

<details>
<summary>all results</summary>

![](<./all_chart_Intel(R)_Core(TM)_Ultra_9_185H.svg>)

</details>

<!-- ### Intel(R)_Core(TM)_Ultra_9_185H -->

### AMD_EPYC_7B13

![](./popular_chart_AMD_EPYC_7B13.svg)

<details>
<summary>all results</summary>

![](./all_chart_AMD_EPYC_7B13.svg)

</details>

<!-- ### AMD_EPYC_7B13 -->

### Apple_M1

![](./popular_chart_Apple_M1.svg)

<details>
<summary>all results</summary>

![](./all_chart_Apple_M1.svg)

</details>

<!-- ### Apple_M1 -->

```bash
pnpm run build
pnpm run bench_computed
# or with heap stats:
pnpm run bench_computed:mem
```

> Notes about Reatom performance:
> https://www.reatom.dev/#how-performant-reatom-is

---

## `bench_dynamic.ts`

Cross-library dynamic dependency lists (grow / shrink / shuffle). Same
spirit as `bench_dynamic_ab`, but against MobX, mol.wire, alien-signals,
Jotai, Act, etc. Uses `../dist`.

```bash
pnpm run build
pnpm run bench_dynamic
```

---

## Kernel changes these benches track

The current `core` numbers above already include the optimizations
developed in `packages/next` and ported back:

1. `scheduled` + cached `queueMicrotask` drain (`queues.ts`)
2. `ROOTS`-gated per-atom frame cache (skip WeakMap while
   `context.start` has only run once)
3. Clean-read fast path for default middleware chains
4. Monomorphic `_cacheImpl` / `_computedImpl`
5. `Frame.vars` bag for user variables (`var#abort` stays dedicated)

Ablation (revert-one-at-a-time on the fork) showed **scheduling** and
the **monomorphic pipeline** as the two large wins (~30% each on the
diamond microbench); the clean-read fast path is a few percent; the
frame cache is within noise on most scenarios but removes WeakMap
traffic in the single-context case.
