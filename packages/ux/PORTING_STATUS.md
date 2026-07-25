# `@reatom/ux` porting status

Tracks which Ariakit features have been ported to Reatom headless models.

Regenerate the unlocked set with:

```sh
pnpm -F @reatom/ux port-status
```

Source of truth for _how_ to port: [`PORTING_PLAN.md`](PORTING_PLAN.md).

## Attribution

- **Ariakit** ([github.com/ariakit/ariakit](https://github.com/ariakit/ariakit),
  MIT) — primary source of truth for state shapes, DOM quirks, and a11y
  behavior. Special thanks to Diego Haz and the Ariakit contributors, and to the
  [`solid/next` work in PR #4378](https://github.com/ariakit/ariakit/pull/4378)
  which extracted framework-agnostic stores in `@ariakit/components`.
- **Chromvoid headless-ui**
  ([github.com/chromvoid/headless-ui](https://github.com/chromvoid/headless-ui),
  MIT) — Reatom-first UI modeling precedent (pure intent mappers, APG
  contracts, TDD culture). Architectural ideas adopted selectively; see the
  plan for adopt vs avoid.

## Legend

| Status    | Meaning                                                                |
| --------- | ---------------------------------------------------------------------- |
| `todo`    | Not started                                                            |
| `partial` | Model started; prop records, tests, or docs incomplete                 |
| `ported`  | Model + tests (+ browser tests when Bucket B) + export — DoD items 1–4 |
| `skipped` | Explicitly out of scope                                                |

## Features (Ariakit store inventory)

| Feature              | Wave | Depends on                                        | Status  | Notes                                                                 |
| -------------------- | ---- | ------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| `disclosure`         | 1    | —                                                 | ported  | Layer 1 + props + animation DOM + browser tests                       |
| `collection`         | 1    | —                                                 | ported  | `reatomLinkedList` + `withDomOrder`                                   |
| `checkbox`           | 1    | —                                                 | ported  | Group/item models; `valueAtom` for forms; indeterminate browser tests |
| `focusable`          | 1    | —                                                 | ported  | No Ariakit store — modality + per-element model                       |
| `command`            | 1    | —                                                 | ported  | Pure `mapActivationIntent` + thin model                               |
| `composite`          | 2    | `collection`                                      | todo    | Keystone for navigable widgets                                        |
| `dialog`             | 2    | `disclosure`                                      | todo    | Thin store; Layer 2 focus trap / inert                                |
| `popover`            | 3    | `dialog`                                          | todo    |                                                                       |
| `radio`              | 3    | `composite`                                       | todo    |                                                                       |
| `toolbar`            | 3    | `composite`                                       | todo    |                                                                       |
| `tag`                | 3    | `composite`                                       | todo    |                                                                       |
| `menubar`            | 3    | `composite`                                       | todo    |                                                                       |
| `composite-overflow` | 3    | `popover`                                         | todo    |                                                                       |
| `hovercard`          | 4    | `popover`                                         | todo    |                                                                       |
| `combobox`           | 4    | `composite`, `popover`, (`tag`)                   | todo    |                                                                       |
| `select`             | 4    | `composite`, `popover`, (`combobox`)              | todo    |                                                                       |
| `tooltip`            | 5    | `hovercard`                                       | todo    |                                                                       |
| `menu`               | 5    | `composite`, `hovercard`, (`combobox`, `menubar`) | todo    |                                                                       |
| `tab`                | 5    | `collection`, `composite`, (`combobox`, `select`) | todo    |                                                                       |
| `menu-bar`           | —    | `menubar`                                         | skipped | Deprecated alias of `menubar`                                         |
| `form`               | —    | `collection`                                      | skipped | Use `reatomForm` / `reatomField` in `@reatom/core`                    |

## Package foundation (Wave 0)

| Item                                      | Status  |
| ----------------------------------------- | ------- | ----------------------------------------------------- |
| Package scaffold (`package.json`, tsdown) | done    |
| Vitest unit config                        | done    |
| Vitest browser config (Playwright)        | done    |
| Root vitest projects registration         | done    |
| `PORTING_PLAN.md`                         | done    |
| `PORTING_STATUS.md` (this file)           | done    |
| `tools/port-status.ts`                    | done    |
| Public `src/index.ts` exports             | done    |
| Shared `src/interactions/` helpers        | done    |
| Delete throwaway `spike/`                 | done    |
| Vendored / dep `@ariakit/utils` subset    | partial | Needed helpers inlined/adapted in feature Dom modules |
| Boundary lint for Layer 1 / Layer 2       | todo    |
| Handbook docs per feature                 | todo    |

## Progress snapshot

- **Ported (Wave 1):** disclosure, collection, checkbox, focusable, command
- **Unit tests:** 192 passing
- **Browser tests:** 34 passing
- **Unlocked next:** `composite`, `dialog`
