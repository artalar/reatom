# `@reatom/ux`

Headless UI behavior models for Reatom — view-library-agnostic state and action
factories inspired by [Ariakit](https://github.com/ariakit/ariakit) and informed
by [`@chromvoid/headless-ui`](https://github.com/chromvoid/headless-ui).

Models are created during DTO atomization: named atoms, actions, and computeds
with no React/Vue/Solid/JSX coupling. Bind them later with `bindField`-style
helpers, `$spread` in `@reatom/jsx`, or any other adapter.

> Ariakit store inventory is ported (see [`PORTING_STATUS.md`](PORTING_STATUS.md)).
> Package remains `private` pending handbook docs and examples. Port template:
> [`PORTING_PLAN.md`](PORTING_PLAN.md).

## Installation

```sh
npm install @reatom/ux @reatom/core
```

## Attribution

Behavior, accessibility invariants, and DOM quirk knowledge are ported from
[Ariakit](https://github.com/ariakit/ariakit) (MIT, © Ariakit FZ-LLC / Diego Haz
and contributors). Reatom-first modeling ideas and APG contract patterns are
noted from [`@chromvoid/headless-ui`](https://github.com/chromvoid/headless-ui)
(MIT, © Chromvoid contributors). Full respect to both projects and their authors.
