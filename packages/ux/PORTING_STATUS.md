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

## Features

| Feature              | Wave | Depends on                                        | Status  | Notes                             |
| -------------------- | ---- | ------------------------------------------------- | ------- | --------------------------------- |
| `disclosure`         | 1    | —                                                 | ported  |                                   |
| `collection`         | 1    | —                                                 | ported  |                                   |
| `checkbox`           | 1    | —                                                 | ported  |                                   |
| `focusable`          | 1    | —                                                 | ported  | No store — modality + per-element |
| `command`            | 1    | —                                                 | ported  | Pure intent + thin model          |
| `composite`          | 2    | `collection`                                      | ported  | Keystone navigation               |
| `dialog`             | 2    | `disclosure`                                      | ported  | Focus trap / inert / nested stack |
| `popover`            | 3    | `dialog`                                          | ported  | Positioner injected, not bundled  |
| `radio`              | 3    | `composite`                                       | ported  | Roving tabindex + native sync     |
| `toolbar`            | 3    | `composite`                                       | ported  | Composite + separator orientation |
| `tag`                | 3    | `composite`                                       | ported  | Input caret + delimiter intents   |
| `menubar`            | 3    | `composite`                                       | ported  | Awaits `menu` for submenus        |
| `composite-overflow` | 3    | `popover`                                         | ported  | Transparent, not `display: none`  |
| `hovercard`          | 4    | `popover`                                         | ported  | Delays sampled; safe polygon      |
| `combobox`           | 4    | `composite`, `popover`, (`tag`)                   | ported  | Inline completion + virtual focus |
| `select`             | 4    | `composite`, `popover`, (`combobox`)              | todo    |                                   |
| `tooltip`            | 5    | `hovercard`                                       | todo    |                                   |
| `menu`               | 5    | `composite`, `hovercard`, (`combobox`, `menubar`) | todo    |                                   |
| `tab`                | 5    | `collection`, `composite`, (`combobox`, `select`) | todo    |                                   |
| `menu-bar`           | —    | `menubar`                                         | skipped | Alias of `menubar`                |
| `form`               | —    | `collection`                                      | skipped | Use `@reatom/core` forms          |

## Progress snapshot

- **Ported:** disclosure, collection, checkbox, focusable, command, composite,
  dialog, popover, radio, toolbar, tag, menubar, composite-overflow, hovercard,
  combobox
- **Unlocked next:** select, tooltip, menu, tab.
  - `select` — `composite` and `popover` are ported, and its `combobox` edge is
    type-only and satisfied anyway.
  - `tooltip` — needs `hovercard` only.
  - `menu` — `composite` and `hovercard` are ported; its `combobox` and
    `menubar` edges are type-only and both satisfied.
  - `tab` — `collection` and `composite` are ported; its `combobox` and `select`
    edges are type-only (`tab-store.ts` imports both with `import type`), so
    `port-status` still lists only menu, select, and tooltip — it reads import
    edges without distinguishing type-only ones.
