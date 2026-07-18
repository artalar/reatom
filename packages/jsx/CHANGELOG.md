## 1001.2.0 (2026-07-19)

[Changes since `v1001.1`](https://github.com/reatom/reatom/compare/1001.1.0...1001.2.0).

Requires `@reatom/core@1001.2`.

### JSX

- feat(jsx): `model:field` ([b91a0a0](https://github.com/reatom/reatom/commit/b91a0a0d123a60fd76bc9eb96203815ad51357c6))
- fix(jsx): dispose stale `$spread` bindings and drain pending mutations on unmount ([dfca155](https://github.com/reatom/reatom/commit/dfca155e1828c39546151719043d810735456ed0))
- fix(jsx): corner cases ([199b212](https://github.com/reatom/reatom/commit/199b212e6c9bb65d6e2e646e52262bb2c266c8bd))

## 1001.1.0 (2026-06-03)

[Changes since `v1001`](https://github.com/reatom/reatom/compare/v1001...v1001.1).

Requires `@reatom/core@1001`.

### JSX

- feat(jsx)!: `reatomLinkedList` supports multiple lists via per-list `LL_NEXT` from core ([f29804f](https://github.com/reatom/reatom/commit/f29804fbd9508658e810ed0ea5864923592dfe7c))
- fix(jsx): linked-list reconciliation ([2f0c7fe](https://github.com/reatom/reatom/commit/2f0c7fe637014fe9ee9bf64f2519acce5652a1d8))
- fix(jsx): CSS custom property names for `style` objects ([feecc555](https://github.com/reatom/reatom/commit/feecc555778aa4e35b03ce03a5d80e72f3a96ea0))
- fix(jsx): build and compilation ([a5377d4](https://github.com/reatom/reatom/commit/a5377d4912833d495783db09ed3b16e29fecc9f1))
- fix(jsx): event handler action names in logs (handler name, noisy events hidden) ([ba4b863](https://github.com/reatom/reatom/commit/ba4b86336429c3274fc0c1cf367996e5611b62d2))
- fix(jsx): `DOM`, `DEBUG`, `stylesheet`, and per-node `metaSymbol` use shared globals to avoid extra linking ([575b7df](https://github.com/reatom/reatom/commit/575b7dfcdaaa66f93f02ec758a0b1fe8ef137cd4))
- fix(jsx): function `children` get stable `computed` names in logs ([d6e0e48](https://github.com/reatom/reatom/commit/d6e0e48faebe2ed009c2bb316e9f7c78179ed655))
- feat(jsx): jsx registries share `globalThis.__REATOM` across duplicate bundles (HMR, #1283) ([a9cacdf](https://github.com/reatom/reatom/commit/a9cacdf409465b08ea0936e247e009ef86dcad63))

### Build

- feat(all): package build on tsdown ([348fe94](https://github.com/reatom/reatom/commit/348fe94b3b94909c818a453cf18f682958733e3d))

## 1000.1.0 (2025-12-21)

### Feat

- **jsx**: add unmount

## 1000.0.1 (2025-12-07)

### Fix

- **jsx**: createMany and removeMany
