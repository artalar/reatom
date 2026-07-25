# `@reatom/ux` porting status

Tracks which Ariakit features have been ported to Reatom headless models.

```sh
pnpm -F @reatom/ux port-status
```

See [`PORTING_PLAN.md`](PORTING_PLAN.md) for the universal port template.

## Attribution

- **Ariakit** ([github.com/ariakit/ariakit](https://github.com/ariakit/ariakit),
  MIT) — primary source of truth for state shapes, DOM quirks, and a11y
  behavior. Special thanks to Diego Haz and the Ariakit contributors, and to the
  [`solid/next` work in PR #4378](https://github.com/ariakit/ariakit/pull/4378)
  which extracted framework-agnostic stores in `@ariakit/components`.
- **Chromvoid headless-ui**
  ([github.com/chromvoid/headless-ui](https://github.com/chromvoid/headless-ui),
  MIT) — Reatom-first UI modeling precedent. Ideas adopted selectively.

## Legend

| Status    | Meaning                                              |
| --------- | ---------------------------------------------------- |
| `todo`    | Not started                                          |
| `partial` | Model started; prop records/tests/docs incomplete    |
| `ported`  | Model + tests (+ browser when needed) + export (1–4) |
| `skipped` | Explicitly out of scope                              |

`ported` covers steps 1–4 of the per-feature definition of done
([`PORTING_PLAN.md`](PORTING_PLAN.md) §11): model, prop records and Layer 2 DOM
behavior, the node/type/browser test tiers, and the `src/index.ts` export. The
handbook page (step 5), the example (step 6), and the lint half of step 7 are
tracked in [Known gaps](#known-gaps) rather than per feature, because they are
missing uniformly for every feature.

## Wave 0 — package foundation

Not a feature: the wiring every feature depends on. `done` / `adapted` / `todo`
here are independent of the feature legend above.

| Item                                            | Status  | Notes                                                                                     |
| ----------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `package.json` publish shape                    | done    | `exports`, `main`/`module`/`types`, `sideEffects: false`, `tsdown` entry, `1001.0.0`      |
| Public entry `src/index.ts`                     | done    | Re-exports every Layer 1/Layer 2 module: 651 names, 276 of them runtime values            |
| Node + browser vitest projects                  | done    | `vitest.config.ts` and `vitest.browser.config.ts`, both registered in the root config     |
| `tools/port-status.ts`                          | done    | Reads real `import` edges between Ariakit stores; prints ported/partial/unlocked          |
| `interactions/` shared helpers                  | done    | `describeElement`, `element`, `queueBeforeEvent` — kept to the "≥2 consumers" rule        |
| `@ariakit/utils` subset                         | adapted | Ported per feature into `reatom<Feature>Dom.ts` rather than a `src/vendor/ariakit-utils/` |
| Reference spike (`reatomDisclosure`/`Checkbox`) | done    | Its four API corrections are folded into the plan; `spike/` is removed                    |
| Boundary lint (Layer 1 vs Layer 2 imports)      | todo    | §9.4.2 — nothing fails a framework import or a raw `addEventListener` yet                 |
| `@reatom/eslint-plugin` on `packages/ux`        | todo    | §9.4.3 — the plugin block is still commented out in the root `eslint.config.js`           |
| `size-limit` per wave                           | todo    | §9.4.5                                                                                    |
| Handbook pages + `examples/` entry              | todo    | §11 steps 5–6, see [Known gaps](#known-gaps)                                              |
| `private: true` removed / package published     | todo    | Stays private until the docs and examples land                                            |

## Features

Parenthesised dependencies are **type-only** import edges: they constrain option
types, not runtime, so `port-status` lists them as plain deps while the port only
needed a structural option type.

| Feature              | Wave | Depends on                                        | Status  | Notes                                                     |
| -------------------- | ---- | ------------------------------------------------- | ------- | --------------------------------------------------------- |
| `disclosure`         | 1    | —                                                 | ported  | `mounted` is a `computed`, `animating` a `withComputed`   |
| `collection`         | 1    | —                                                 | ported  | `reatomLinkedList`; `withDomOrder()` lives in Layer 2     |
| `checkbox`           | 1    | —                                                 | ported  | `.item(value)` sub-models; `indeterminate` in Layer 2     |
| `focusable`          | 1    | — (no Ariakit store)                              | ported  | Modality atom + per-element model; quirk-dense Layer 2    |
| `command`            | 1    | — (no Ariakit store)                              | ported  | Pure activation intent + thin model                       |
| `composite`          | 2    | `collection`                                      | ported  | Keystone navigation; `getNextId` family is pure           |
| `dialog`             | 2    | `disclosure`                                      | ported  | Focus trap / `inert` / scroll lock / nested stack         |
| `popover`            | 3    | `dialog`                                          | ported  | Positioner injected via `withFloating()`, not bundled     |
| `radio`              | 3    | `composite`                                       | ported  | Roving tabindex + native `<input>` sync                   |
| `toolbar`            | 3    | `composite`                                       | ported  | Composite + separator orientation                         |
| `tag`                | 3    | `composite`                                       | ported  | Input caret + delimiter intents                           |
| `menubar`            | 3    | `composite`                                       | ported  | `menu` adopts one through its `menubar` option            |
| `composite-overflow` | 3    | `popover`                                         | ported  | Transparent wrapper, not `display: none`                  |
| `hovercard`          | 4    | `popover`                                         | ported  | Delays sampled with `withAbort()`; safe polygon           |
| `combobox`           | 4    | `composite`, `popover`, (`tag`)                   | ported  | Inline completion + virtual focus + Safari-touch override |
| `select`             | 4    | `composite`, `popover`, (`combobox`)              | ported  | `undefined` replaces Ariakit's `new String('')` sentinel  |
| `tooltip`            | 5    | `hovercard`                                       | ported  | Thin over hovercard + a global skip-timeout registry      |
| `menu`               | 5    | `composite`, `hovercard`, (`combobox`, `menubar`) | ported  | Submenu tree via `parent`; `values` for checkbox/radio    |
| `tab`                | 5    | `collection`, `composite`, (`combobox`, `select`) | ported  | Tabs + panels collections; `selectOnMove`; restore action |
| `menu-bar`           | —    | `menubar`                                         | skipped | Deprecated Ariakit alias of `menubar`                     |
| `form`               | —    | `collection`                                      | skipped | `@reatom/core` owns forms (`reatomForm` / `reatomField`)  |

## Progress snapshot

**Every Ariakit behavior feature is ported.** 19 models — the 17 store-backed
features `port-status` scans, plus `focusable` and `command`, which have no
Ariakit store at all (their behavior lives in `focusable.tsx` / `command.tsx`)
and so are tracked only here. `form` and `menu-bar` are the two deliberate
skips, leaving nothing `todo` or `partial`.

Verified on this branch:

| Command                           | Result                                                       |
| --------------------------------- | ------------------------------------------------------------ |
| `pnpm -F @reatom/ux typecheck`    | clean                                                        |
| `pnpm -F @reatom/ux test:unit`    | 66 files, **1077** tests passed, no type errors              |
| `pnpm -F @reatom/ux test:browser` | 19 files, **162** tests passed                               |
| `pnpm -F @reatom/ux port-status`  | scanned 19, ported 17, partial 0, unlocked (none)            |

`menubar` and `toolbar` have no dedicated browser files on purpose: both are thin
`composite` wrappers whose DOM story is already asserted in
`composite.test.browser.ts`.

### Ariakit `main` sync

Compared against Ariakit `main` after the solid/next fork — see
[`MAIN_GAP_ANALYSIS.md`](MAIN_GAP_ANALYSIS.md). Store inventories match; gaps
were post-fork behavior deltas and one React-only feature:

| Item | Status |
| ---- | ------ |
| `composite-typeahead` + `typeaheadText` | done (`src/composite/typeahead.ts`) |
| Anchor-element precedence (popover/combobox) | done |
| Tag literal delimiter matching | done |
| Disclosure per-property animation end time | done |
| Dialog `scrollbar-gutter` scroll lock | done |
| Dialog Esc containment | done |
| Changelog regression sweep | done ([`MAIN_SWEEP_NOTES.md`](MAIN_SWEEP_NOTES.md)) |

Still deferred from that analysis: `composite-container`, `UndoManager` (core),
virtualized renderers.

### Known gaps

None of these blocks a feature's `ported` status, and all of them are Wave 0 or
definition-of-done items rather than behavior work:

- **Handbook docs.** `docs/src/content/docs/handbook/ux/<feature>.md` does not
  exist for any feature (§11 step 5). The a11y invariants and Ariakit provenance
  currently live only in JSDoc and in the browser tests' source citations.
- **Examples.** No `examples/` entry mounts a `@reatom/ux` model, so
  view-library independence is argued rather than demonstrated (§11 step 6).
- **Boundary lint.** The Layer 1/Layer 2 import check and the
  `@reatom/eslint-plugin` rules (`unit-naming-rule`, `wrap-rule`) are still
  unwired, so layering and unit naming are review-enforced only (§9.4.2–9.4.3).
- **`size-limit`.** No per-wave budget guards Layer 2 DOM code out of bundles
  (§9.4.5).
- **Package visibility.** `package.json` keeps `"private": true` until the
  handbook pages and the examples land.
