## 1001.3.0 (2026-07-21)

[Changes since `v1001.2`](https://github.com/reatom/reatom/compare/1001.2.0...1001.3.0).

### Core

- feat(core): `log.label` for custom logger titles ([4745a6f](https://github.com/reatom/reatom/commit/4745a6f7d5a94508a1b7f26c225c5f1c05e68b9b))
- feat(core,jsx): atom error subscription ([3c482b1](https://github.com/reatom/reatom/commit/3c482b13b11fe68bc2db775f0d887fce194eb239))
- fix(core,jsx): jsfb patch + browser vitest keyed-list bench (#1321) ([7cf67f6](https://github.com/reatom/reatom/commit/7cf67f61183f3b8ea04619f212421599c0dc568d))

## 1001.2.0 (2026-07-19)

[Changes since `v1001.1`](https://github.com/reatom/reatom/compare/1001.1.0...1001.2.0).

### Core

- feat(core): `instance` helper ([d6ae696](https://github.com/reatom/reatom/commit/d6ae696ea4f244d158e2653b297e9dff38fc685c))
- fix(core): subscription context ([046bb389](https://github.com/reatom/reatom/commit/046bb38933ca05b475998dd01d8d32f292633b36))
- fix(core): `addErrorHook` restore ([10e8025](https://github.com/reatom/reatom/commit/10e8025eeae39e62b417d35df7f654939855f044))
- fix(core): frame retrieval ([ecba464](https://github.com/reatom/reatom/commit/ecba4645705df1ff31a1d633e5058bab323dc854))
- fix(core): `toStringKey` and `isDeepEqual` edge cases ([8ce9a55](https://github.com/reatom/reatom/commit/8ce9a556b8ad5d0df50ead39a907e988191d8d17))

### Methods

- fix(methods): `withObservable` subscription binding ([6acb4b0](https://github.com/reatom/reatom/commit/6acb4b0d4bb824d53834b1a3e3db175dc36091d6))
- fix(methods): `flushRollbacks` ([e08eab8](https://github.com/reatom/reatom/commit/e08eab8924108d6098618d79fa3e2142f6bffd7f))
- fix(methods): `race` settled abortion ([8290741](https://github.com/reatom/reatom/commit/82907417eabe6bb5c545e3ac190f0ce316dcf52b))
- fix(methods): `schedule` queue handling ([e762dec](https://github.com/reatom/reatom/commit/e762dec7c3fa2a4d9c95f982ddba3f32e4abcd01))
- fix(transaction): rollback subscriber frame (#1317) ([79f7eb8](https://github.com/reatom/reatom/commit/79f7eb855678183cf38664ff054940ffbf7ea52b))
- fix(transaction): nested transaction rollback ([af2f81f](https://github.com/reatom/reatom/commit/af2f81f41da1e7f3cd815538d39c92cf4085a586))

### Primitives

- feat(extensions,primitives): `withFromJson` ([078d836](https://github.com/reatom/reatom/commit/078d83629be334afd93dd5c13974923739d5e124))
- fix(primitives): linked-list persist ([cc2697b](https://github.com/reatom/reatom/commit/cc2697b7c11d54419c980b07fcd5858aad1f797b))

### Extensions, async, persist, web, form

- feat(web): optional `name` and `query` on `reatomMediaQuery` (#1292) ([98f5a99](https://github.com/reatom/reatom/commit/98f5a997c7db552baa06cfa52c8e05dc1a1526c2))
- fix(web): URL hash handling ([23440f6](https://github.com/reatom/reatom/commit/23440f6727401bcfb97aaa30fb34ccdd339ac6a9))
- fix(persist): async persist ([f85d98c](https://github.com/reatom/reatom/commit/f85d98c22b55932a7fb491aa91825072b7ac612c))
- fix(persist): persist bugs ([e1f1b8a](https://github.com/reatom/reatom/commit/e1f1b8a821a3e6b1c72c88c755e240c4e9640e29))
- fix(persist): types ([8bcd036](https://github.com/reatom/reatom/commit/8bcd03661557c2df0fd829bcbe3cacd70c3fb763))
- fix(withCache): pending hydrated cache hit (#1316) ([3d6c542](https://github.com/reatom/reatom/commit/3d6c5421b0f01992fcff12b5bd59d2c8986a0e4e))
- fix(core,extensions): suspense reactive restoration ([11911b5](https://github.com/reatom/reatom/commit/11911b5429e28c6a3501d12c173847cbf93b425b))
- fix(extensions): `withSuspenseInit` params handling ([da32c08](https://github.com/reatom/reatom/commit/da32c0857478e95967803009f303f1053ed5672b))
- fix(extensions): `addChangeHook` unsubscribe ([ed0157e](https://github.com/reatom/reatom/commit/ed0157e6950fb96547bae346a435164214a994c9))
- fix(async): do not call `onReject` for abort rejections (#1294) ([4e2d941](https://github.com/reatom/reatom/commit/4e2d94195277918032e0a5dcfa4a7ce0a65f0b8b))
- fix(async,routing): `status.data` ([348d3b7](https://github.com/reatom/reatom/commit/348d3b7897cda34296110771c08df22befd2bdbe))
- fix(form): typo ([9b3d43b](https://github.com/reatom/reatom/commit/9b3d43bec2d984f3ddf6ec24eb190d8a53dc9693))

## 1001.1.0 (2026-06-03)

[Changes since `v1001`](https://github.com/reatom/reatom/compare/v1001...v1001.1).

### Core

- feat: shared Reatom globals on `globalThis.__REATOM` (#1283) ([a9cacdf](https://github.com/reatom/reatom/commit/a9cacdf409465b08ea0936e247e009ef86dcad63))
- fix(core): atom error restoration ([874d0a2](https://github.com/reatom/reatom/commit/874d0a29534ac89757f05ebae319fc5ceddde6c4))
- fix(core): `toJSON` types ([5dac68e](https://github.com/reatom/reatom/commit/5dac68e28da86e7d3b51474ace8639f4400a7800))
- fix(core,primitives): proper `toJSON` serialization ([8a4a135](https://github.com/reatom/reatom/commit/8a4a135c60d34b46a8172b61f2686f789d79e939))
- fix(core): sync atom from URL on back navigation when `false` param is omitted (#1285) ([be51ec3](https://github.com/reatom/reatom/commit/be51ec3d987baf0f9a3bf5172226297b8cbb70a2))

### Routing

- fix(routing): route validation and nested route handling (#1209) ([337f604](https://github.com/reatom/reatom/commit/337f60443f5ec2a7d8591101c41ca37fbdc8a104))
- fix(routing): routes naming ([6f65d8f](https://github.com/reatom/reatom/commit/6f65d8f4ec7b60758d6f15ddcb8d6593c4c97e3a))

### Methods

- feat(methods): dynamic (atom) keys in `reatomLens` ([330e856](https://github.com/reatom/reatom/commit/330e856cac88c1a6fc25f5d6364f322bcd5f84e5))
- fix(methods): `reatomLens` correctness ([7e053c9](https://github.com/reatom/reatom/commit/7e053c95ed94acc80b96a87aa2c2cbcc715e80eb))

### Primitives

- feat(primitives): JSON serialization for `reatomMap` and `reatomSet` ([5ef3b69](https://github.com/reatom/reatom/commit/5ef3b69120fd9442780c6a1b8e9fa45de80b6e85))

### Extensions, async, persist, web

- feat(extensions): `withErrorHook` ([aba3693](https://github.com/reatom/reatom/commit/aba36938ba04fa1111b617cfe689550aebc6593f))
- fix(extensions): hook error handling ([c551158](https://github.com/reatom/reatom/commit/c551158c0ecac0ffb259025511880175389bc04e))
- feat(extensions,primitives): `withToJson` ([7270c36](https://github.com/reatom/reatom/commit/7270c3642bdde99776faf5c7fbf83774b2b5100c))
- feat(async): `AsyncStatusAtom` error handling ([14ccb48](https://github.com/reatom/reatom/commit/14ccb48efb53bad1f5897ac645c4e6ef03dbd043))
- fix(extensions): `withSuspenseInit` OOM ([325ac4f](https://github.com/reatom/reatom/commit/325ac4f75903079640fc0e35223645e6c4bd575e))
- fix(extensions): `withSuspenseInit` types ([b9bb850](https://github.com/reatom/reatom/commit/b9bb850eff6b0fa94d7b20772224ecdc2fdda0cd))
- fix(extensions): `withSuspenseRetry` types for actions with params ([4cc46b3](https://github.com/reatom/reatom/commit/4cc46b3819edf7b7a924b28a2fdfa171359ac2d0))
- fix(async,extensions,methods,persist,routing,web): reduce default bundle size ([5f2d938](https://github.com/reatom/reatom/commit/5f2d938f9154b94558f3051e84e114f0d593f4bd))
- fix(persist): rehydrate all IndexedDB atoms from cold start (#1287) ([c1e8eaa](https://github.com/reatom/reatom/commit/c1e8eaa4c2d0fe3c6712b616226f7d286d8083b1))
- fix(fetch): fetch return type ([788778f](https://github.com/reatom/reatom/commit/788778ffa67b68df32dcb0a2172d569575705759))
- feat(web): expose `mediaQueryList` on `reatomMediaQuery` ([4fc88b5](https://github.com/reatom/reatom/commit/4fc88b50992ca4f8094447dce3d3547ffbdc7445))

## 1001.0.0 (2026-05-14)

[Changes since `v1000`](https://github.com/reatom/reatom/compare/v1000...v1001).

### Core

- feat(core)!: middleware pipeline and `reatomObservable` API ([83e05f1](https://github.com/reatom/reatom/commit/83e05f14efae2cdb1c1d59d2bcc84f0fb757d6ea))
- feat(core)!: action subscriptions refactor ([fe76e2a](https://github.com/reatom/reatom/commit/fe76e2a8a6638353c289ae8c9197170b1e8da0dc))
- feat(core): `batch` ([914a18d](https://github.com/reatom/reatom/commit/914a18d78de1d51e554d34820528cd1ee2eb18e0))
- feat: `fromEntries` ([1f62441](https://github.com/reatom/reatom/commit/1f62441a10004777f1a9bf740624f6fb0d5c3d00))
- async and core queue performance ([161b3fa](https://github.com/reatom/reatom/commit/161b3faae77055a857d62d4d18c62a3fe40f123a))
- fix(core): subscription callback tracking and payload ([7d4394e](https://github.com/reatom/reatom/commit/7d4394ed9f32b96667e7e31495c0291b4e2c8419), [a0c19eb](https://github.com/reatom/reatom/commit/a0c19ebd479fabdf3b7801efeec0418e66486e89), [380928d](https://github.com/reatom/reatom/commit/380928d409941b3f301155f41ffed1a81e8b66bd))
- fix(core): dependency cycles, recursion, memos, multiple subscriptions, action subscriptions ([3c7ee7b](https://github.com/reatom/reatom/commit/3c7ee7bd7d5c17e140cdcdee5b69011923682b4f), [16ed3c0](https://github.com/reatom/reatom/commit/16ed3c09810a51c5e80f89bf87b9ff17a645d04a), [6f77dd8](https://github.com/reatom/reatom/commit/6f77dd8f70fded89455fc1a68fc495deed40269e), [1f465c0](https://github.com/reatom/reatom/commit/1f465c0ad05c8fb158cea3073c59ee7d478cb720), [ad53fb2](https://github.com/reatom/reatom/commit/ad53fb205cc30a5729ef6f5913a2f7b77976227c), [813fa6c](https://github.com/reatom/reatom/commit/813fa6c6c6d87164888cfacafefc509c28d4f311), [086ab7d](https://github.com/reatom/reatom/commit/086ab7d7614e9054bae8009fbe68e1462bf2cc5f), [275ab7e](https://github.com/reatom/reatom/commit/275ab7e592adb6a74ee3e2f5d95b969cd9f4b41e))

### Routing

- feat(routing)!: `layout` replaces `exactRender` ([8470d02](https://github.com/reatom/reatom/commit/8470d025c6d2d69a748d9698ab9de25ba60bc5e1))
- feat(routing): URL codecs (#1266) ([e80d00c](https://github.com/reatom/reatom/commit/e80d00cb957236b3ee5f4dc14de75a199e31089f))
- feat(routing): relative navigation ([24866fe](https://github.com/reatom/reatom/commit/24866fe0aa5cd1f6f14737020b137ffc750b3a5d))
- fix(routing): params callback inherits search params ([d7bf4d0](https://github.com/reatom/reatom/commit/d7bf4d0333137eaa03eece99b8b844765ea354c4))
- fix(routing): encode/decode for path segments ([63ad3da](https://github.com/reatom/reatom/commit/63ad3dadbbdae8f125359092a7f7ea438788dc12))
- fix(routing): security hardening ([e1ca280](https://github.com/reatom/reatom/commit/e1ca2803644aeaea470841c3a6a4ef13aeb17a5e))

### Methods

- feat(methods): `shouldRollback` on `filter` ([3775734](https://github.com/reatom/reatom/commit/377573492dfda85e91fca1eaa9fb73dd8a1934e3))
- fix(methods): `abortVar.find` without callback ([541e9a9](https://github.com/reatom/reatom/commit/541e9a99f0a677bb8c65a4da29124958a921c8ad))
- refactor(methods)!: `framePromise` queue defaults to `'effect'` ([71239cf](https://github.com/reatom/reatom/commit/71239cf4b3b88ab82986165e665195216a55cdef))
- fix(methods): `take` with suspense ([7978182](https://github.com/reatom/reatom/commit/797818269abd840812031ffff2bd7edb840622ed))
- fix(methods): effect concurrent disposal ([f6d0b9e](https://github.com/reatom/reatom/commit/f6d0b9e7c17c14b7d2aa5723c3b53c002176f513))

### Primitives

- feat(primitives): enum setter accepts string values ([fd779df](https://github.com/reatom/reatom/commit/fd779dfa0ecce9e5c32056a81828d2737df68aaf))

### Extensions, async, persist, web

- fix(extend)!: stricter `withTap` typings ([3fb1311](https://github.com/reatom/reatom/commit/3fb13112b88a37256cd572ee53408748fcbdb0de))
- fix(extensions): `withSuspense` init promise rejections ([8871ef9](https://github.com/reatom/reatom/commit/8871ef930003a8a849e2307e94eeca7ef7b9cf89))
- fix(extensions): manual abort for stale async controllers ([177b781](https://github.com/reatom/reatom/commit/177b7810a3de405a0b52b5f9097f85eb5a02b777))
- feat(async,extensions): `withCache` ([e47e09b](https://github.com/reatom/reatom/commit/e47e09b3fa14641136a4cba6d9450202102f69b9))
- fix(extensions,methods,routing): abort ordering ([567ac95](https://github.com/reatom/reatom/commit/567ac95ae8b2d083f2020323cc4d6e6df9702a58))
- fix(persist): `BroadcastChannel` availability (#1269) ([fc1a756](https://github.com/reatom/reatom/commit/fc1a7562a8a0f00dd9d83f2e211096c34a818a5b))
- fix(web): URL handling performance ([dcef720](https://github.com/reatom/reatom/commit/dcef720fa7a54e70d60fb8aa519e93af97a585c0))

### Form and async

- refactor(async,form): follow-up fixes ([7601df5](https://github.com/reatom/reatom/commit/7601df5c82902239c21253f4fff84bcd11772e87))
- fix(form): submit includes status ([ae5a18d](https://github.com/reatom/reatom/commit/ae5a18d51439c4b4b871dd538082f2c60d83fcc2))

### React, Preact, JSX

- fix(react): route child types ([8e40c93](https://github.com/reatom/reatom/commit/8e40c93ee81ff421da3efc0f070941f5fd259a2f))
- feat(react): optional render abort on unmount ([fb605fc](https://github.com/reatom/reatom/commit/fb605fcead07d9f8f7d58a242451c276c409ffe7))
- fix(jsx): build and compilation ([2f0c7fe](https://github.com/reatom/reatom/commit/2f0c7fe637014fe9ee9bf64f2519acce5652a1d8), [a5377d4](https://github.com/reatom/reatom/commit/a5377d4912833d495783db09ed3b16e29fecc9f1))
- fix(preact): `reatomComponent` abort behavior ([9bb15dd](https://github.com/reatom/reatom/commit/9bb15ddd1aed4cafb8163b68fe19c28a6de41ee5))

### Build

- feat(all): core package build on tsdown ([348fe94](https://github.com/reatom/reatom/commit/348fe94b3b94909c818a453cf18f682958733e3d))

## 1000.15.2 (2026-02-11)

### Fix

- **form**: wrap transform in form submit

## 1000.15.1 (2026-02-11)

### Fix

- **web**: rAF logs spam
- **extensions**: unhandled abort

## 1000.15.0 (2026-02-04)

### Feat

- **async**: add retry

### Fix

- **routing**: route nested params
- **routing**: inherence of callback params
- **routing**: pattern collision
- **extensions**: add proper naming for connect hook
- **web**: urlAtom in node js

## 1000.14.1 (2026-01-29)

### Fix

- **core**: optimize perf

## 1000.14.0 (2026-01-29)

### Feat

- **extensions, methods**: add race

## 1000.13.0 (2026-01-29)

### Feat

- **core, extensions**: add withActionMiddleware

## 1000.12.2 (2026-01-29)

### Fix

- **routing**: input params navigation

## 1000.12.1 (2026-01-29)

### Fix

- **routing**: input params navigation

## 1000.12.0 (2026-01-28)

### Feat

- **extensions**: finally strategy

## 1000.11.0 (2026-01-28)

### Feat

- **extensions**: finally strategy
- **form**: add validateOnConnect

## 1000.10.2 (2026-01-27)

### Fix

- **methods**: reatomObservable subscription bind

## 1000.10.1 (2026-01-27)

### Fix

- **methods**: subscription bind
- **form**: initState and state init cycle

## 1000.10.0 (2026-01-21)

### Feat

- **routing**: better params handling

## 1000.9.5 (2026-01-20)

### Fix

- **form**: cycles

## 1000.9.4 (2026-01-20)

### Fix

- **extensions**: lazy abort cleanup

## 1000.9.3 (2026-01-20)

### Fix

- **core**: cyclic marking for reactive invalidation

## 1000.9.2 (2026-01-20)

### Fix

- **web**: initiate loaders route on url init

## 1000.9.1 (2026-01-20)

### Fix

- **extensions, methods**: abort controller leaks

## 1000.9.0 (2026-01-19)

### Feat

- **routing**: params computed callback

## 1000.8.2 (2026-01-19)

### Fix

- **async**: pending computed

## 1000.8.1 (2026-01-17)

### Fix

- **methods**: abortVar frame propagation

## 1000.8.0 (2026-01-16)

### Feat

- **extensions**: support withAbort options

## 1000.7.4 (2026-01-16)

### Fix

- **extensions**: withDisconnectHook spawn

## 1000.7.3 (2026-01-17)

### Fix

- **extensions**: withDisconnectHook spawn

## 1000.7.2 (2026-01-16)

### Fix

- **extensions, methods**: types of MaybeUnsubscribe

## 1000.7.1 (2026-01-17)

### Fix

- **extensions, methods**: types of MaybeUnsubscribe

## 1000.7.0 (2026-01-16)

### Feat

- **core**: allow action subscription

## 1000.6.0 (2026-01-16)

### Feat

- **core**: allow action subscription
- **methods**: add log.state to log changes only

## 1000.5.0 (2026-01-15)

### Feat

- **methods**: add log.state to log changes only

## 1000.4.2 (2026-01-13)

### Fix

- **methods**: retry subscribed computed #1234

## 1000.4.1 (2026-01-13)

### Fix

- **async**: negative pending in withAsync

## 1000.4.0 (2025-12-21)

### Feat

- **methods**: add logger match option

## 1000.3.1 (2025-12-21)

### Fix

- **extensions**: withSuspenseRetry middleware order

## 1000.3.0 (2025-12-21)

### Feat

- **routing**: add exactRender option

## 1000.2.0 (2025-12-21)

### Feat

- **routing**: add exactRender option

## 1000.1.0 (2025-12-13)

### Feat

- **methods**: add createAndRun to variable

## 1000.0.4 (2025-12-12)

### Fix

- **form**: internal typings

## 1000.0.3 (2025-12-12)

### Fix

- **form**: remove recursive type as default for some generics

## 1000.0.2 (2025-12-10)

### Fix

- **form**: some errors on concurrent async validation

## 1000.0.1 (2025-12-07)

### Fix

- **primitives**: createMany and removeMany
