## 1001.0.1 (2026-07-21)

[Changes since `v1001`](https://github.com/reatom/reatom/compare/v1001.0.0...1001.0.1).

### React

- fix(react): don't crash `useAtom(value, deps)` with primitive initial value (#1305) ([0c1b7df](https://github.com/reatom/reatom/commit/0c1b7dff9aef693c203bdb53b92549eeeea36c5d))
- fix(react): subscribe to mount via `useLayoutEffect` (#1312) ([b9b73ae](https://github.com/reatom/reatom/commit/b9b73ae76e1a951094749044782a62962c29f82f))

## 1001.0.0 (2026-05-14)

[Changes since `v1000`](https://github.com/reatom/reatom/compare/v1000...v1001).

### React

- feat(react)!: `reatomComponent` defaults `abortOnUnmount` to `false`; set `abortOnUnmount: true` for the previous abort-on-unmount behavior ([fb605fc](https://github.com/reatom/reatom/commit/fb605fcead07d9f8f7d58a242451c276c409ffe7))
- fix(react): route child types ([8e40c93](https://github.com/reatom/reatom/commit/8e40c93ee81ff421da3efc0f070941f5fd259a2f))

### Build

- feat(all): package build on tsdown ([348fe94](https://github.com/reatom/reatom/commit/348fe94b3b94909c818a453cf18f682958733e3d))

## 1000.2.2 (2026-01-29)

### Fix

- **react**: react use method inside reatomComponent

## 1000.2.1 (2026-01-21)

### Fix

- **react**: suspense

## 1000.2.0 (2025-12-23)

### Feat

- **react**: add hooks

## 1000.1.0 (2025-12-09)

### Feat

- **react**: add deps options to reatomComponent
