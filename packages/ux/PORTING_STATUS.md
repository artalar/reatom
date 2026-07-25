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

| Status    | Meaning                                                |
| --------- | ------------------------------------------------------ |
| `todo`    | Not started                                            |
| `partial` | Model started; prop records/tests/docs incomplete      |
| `ported`  | Model + tests (+ browser when needed) + export (1–4) |
| `skipped` | Explicitly out of scope                                |

## Features

| Feature              | Wave | Depends on                                        | Status  | Notes |
| -------------------- | ---- | ------------------------------------------------- | ------- | ----- |
| `disclosure`         | 1    | —                                                 | ported  | |
| `collection`         | 1    | —                                                 | ported  | |
| `checkbox`           | 1    | —                                                 | ported  | |
| `focusable`          | 1    | —                                                 | ported  | No store — modality + per-element |
| `command`            | 1    | —                                                 | ported  | Pure intent + thin model |
| `composite`          | 2    | `collection`                                      | ported  | Keystone navigation |
| `dialog`             | 2    | `disclosure`                                      | ported  | Focus trap / inert / nested stack |
| `popover`            | 3    | `dialog`                                          | todo    | |
| `radio`              | 3    | `composite`                                       | todo    | |
| `toolbar`            | 3    | `composite`                                       | todo    | |
| `tag`                | 3    | `composite`                                       | todo    | |
| `menubar`            | 3    | `composite`                                       | todo    | |
| `composite-overflow` | 3    | `popover`                                         | todo    | |
| `hovercard`          | 4    | `popover`                                         | todo    | |
| `combobox`           | 4    | `composite`, `popover`, (`tag`)                   | todo    | |
| `select`             | 4    | `composite`, `popover`, (`combobox`)              | todo    | |
| `tooltip`            | 5    | `hovercard`                                       | todo    | |
| `menu`               | 5    | `composite`, `hovercard`, (`combobox`, `menubar`) | todo    | |
| `tab`                | 5    | `collection`, `composite`, (`combobox`, `select`) | todo    | |
| `menu-bar`           | —    | `menubar`                                         | skipped | Alias of `menubar` |
| `form`               | —    | `collection`                                      | skipped | Use `@reatom/core` forms |

## Progress snapshot

- **Ported:** disclosure, collection, checkbox, focusable, command, composite, dialog
- **Unlocked next:** popover, radio, toolbar, tag, menubar
