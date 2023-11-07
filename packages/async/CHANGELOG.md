# Changelog

## [3.12.1](https://github.com/artalar/reatom/compare/async-v3.12.0...async-v3.12.1) (2023-11-07)


### Bug Fixes

* **async:** errorAtom: AtomMut ([a1349a8](https://github.com/artalar/reatom/commit/a1349a8118366a75d4cb9bf40d6e94274a2a87f2))

## [3.12.0](https://github.com/artalar/reatom/compare/async-v3.11.0...async-v3.12.0) (2023-11-05)


### Features

* **async:** add shouldPending and swrPendingAtom ([103e30c](https://github.com/artalar/reatom/commit/103e30c7aa8bd7879da347d2653389a39221d952))


### Bug Fixes

* **async:** reatomResource small mem leak ([408d916](https://github.com/artalar/reatom/commit/408d9167712cf53dc4381caee3c08f353752d990))

## [3.11.0](https://github.com/artalar/reatom/compare/async-v3.10.1...async-v3.11.0) (2023-10-31)


### Features

* **async:** add reset action to statusesAtom ([7803168](https://github.com/artalar/reatom/commit/78031689792d7737641fc822324dbe482c4a8fec))


### Bug Fixes

* **async:** improve withStatusesAtom update order ([316bac5](https://github.com/artalar/reatom/commit/316bac55d18cdd24c743e3e6e6eb5645b2ebf5c6))
* **async:** withAbort + withRetry ([d5190ab](https://github.com/artalar/reatom/commit/d5190ab87d57e3925652e07c0741c2938b80cd39))

## [3.10.1](https://github.com/artalar/reatom/compare/async-v3.10.0...async-v3.10.1) (2023-10-23)


### Bug Fixes

* **async:** allow empty deps for reatomResource ([47c9a2e](https://github.com/artalar/reatom/commit/47c9a2e4350522ca39af3c5c4cf848a1ad5f967a))

## [3.10.0](https://github.com/artalar/reatom/compare/async-v3.9.4...async-v3.10.0) (2023-10-20)


### Features

* **async:** deprecate reatomAsyncReaction in favor of reatomReactiveAsync ([678adf2](https://github.com/artalar/reatom/commit/678adf2b337b6a895f94e5997739274822332c4f))


### Bug Fixes

* **async:** do not cache aborted promise ([1b6fbe8](https://github.com/artalar/reatom/commit/1b6fbe83ae10a0b170996a16c272a1783d77cb39))

## [3.9.4](https://github.com/artalar/reatom/compare/async-v3.9.3...async-v3.9.4) (2023-10-09)


### Bug Fixes

* **async:** reatomAsyncReaction direct call ([e88b96c](https://github.com/artalar/reatom/commit/e88b96cadfe40ff25432d6bb5d69cbbc20ce67f8))
* **async:** retry abort ([7722626](https://github.com/artalar/reatom/commit/7722626effd408f81a6a1864ce12faa43a617581))

## [3.9.3](https://github.com/artalar/reatom/compare/async-v3.9.2...async-v3.9.3) (2023-09-26)


### Bug Fixes

* **async:** abort should not stale for reatomAsyncReaction ([2a7e272](https://github.com/artalar/reatom/commit/2a7e2720bb5e8a681128eac161535e350fc04c59))
* **async:** prevent unhandled exception for reatomAsyncReaction ([4b940ae](https://github.com/artalar/reatom/commit/4b940aee188ccfcb66a137834f5b877b24321e00))

## [3.9.2](https://github.com/artalar/reatom/compare/async-v3.9.1...async-v3.9.2) (2023-09-13)


### Bug Fixes

* **async:** reatomAsyncReaction withCache ([3bfee9d](https://github.com/artalar/reatom/commit/3bfee9de70e5c645979e81abb6edacde3e8ecac7))

## [3.9.1](https://github.com/artalar/reatom/compare/async-v3.9.0...async-v3.9.1) (2023-09-13)


### Bug Fixes

* **async:** promiseAtomConnection ([cc3b707](https://github.com/artalar/reatom/commit/cc3b707312ba504e8853facf5dce3dbbfafd4bbe))

## [3.9.0](https://github.com/artalar/reatom/compare/async-v3.8.3...async-v3.9.0) (2023-09-13)


### Features

* **async:** add reatomAsyncReaction ([e44e641](https://github.com/artalar/reatom/commit/e44e6417b5795c380e8c2e5dd1e576e7a6462bc0))


### Bug Fixes

* **async:** reatomAsyncReaction AsyncCtxSpy ([c0d014d](https://github.com/artalar/reatom/commit/c0d014d987cf1b3081133b45a146c30e107fb063))

## [3.8.3](https://github.com/artalar/reatom/compare/async-v3.8.2...async-v3.8.3) (2023-08-08)


### Bug Fixes

* **async:** add mapFulfill to dataAtom for correct cache init ([994c0ff](https://github.com/artalar/reatom/commit/994c0ff483c0c8aafea276bc4bc6006bc7b5a1b9))

## [3.8.2](https://github.com/artalar/reatom/compare/async-v3.8.1...async-v3.8.2) (2023-07-22)


### Bug Fixes

* **async:** withStatusesAtom missing ctx ([9c12a7c](https://github.com/artalar/reatom/commit/9c12a7c74dcb2ac5394251e9e0a7fd3c3896d42a))

## [3.8.1](https://github.com/artalar/reatom/compare/async-v3.8.0...async-v3.8.1) (2023-07-12)


### Bug Fixes

* **async:** errorAtom AtomMut ([774ebc0](https://github.com/artalar/reatom/commit/774ebc0c649cac50073c0bdeae47a27780577c5c))

## [3.8.0](https://github.com/artalar/reatom/compare/async-v3.7.0...async-v3.8.0) (2023-07-07)


### Features

* **async:** add "ignoreAbort" and refactor withCache ([f404abf](https://github.com/artalar/reatom/commit/f404abfa36e91db9d109094eee672098ad7c6536))


### Bug Fixes

* **async:** shallow equal memo for withStatusesAtom ([8042e18](https://github.com/artalar/reatom/commit/8042e18dc0d38844628c73ba6a7a2bb2beaf4256))
* **async:** withStatusesAtom and SWR ([b8d2798](https://github.com/artalar/reatom/commit/b8d2798a29b37cbb5f3a441adf4ca332a449ace9))

## [3.7.0](https://github.com/artalar/reatom/compare/async-v3.6.1...async-v3.7.0) (2023-06-12)


### Features

* **async:** refactor withCache, add shouldFulfill option for SWR ([eb54d34](https://github.com/artalar/reatom/commit/eb54d34598ad48dd51ee21cfd2e3c0964bfdc7ae))

## [3.6.1](https://github.com/artalar/reatom/compare/async-v3.6.0...async-v3.6.1) (2023-05-21)


### Bug Fixes

* **all-settled:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **async:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **async:** withCache and withAbort same params ([0466036](https://github.com/artalar/reatom/commit/0466036a2f6cf1dbc3a2f8ce70a5a586825fba85))
* **core-v1:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **core-v2:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **core:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **effects:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **eslint-plugin:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **form-web:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **form:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **framework:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **hooks:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **lens:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **logger:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **navigation:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* new way of hooking up typings [#560](https://github.com/artalar/reatom/issues/560) ([#568](https://github.com/artalar/reatom/issues/568)) ([99550e9](https://github.com/artalar/reatom/commit/99550e98c34df7efd8431282a868a0483bed5dc8))
* **npm-cookie-baker:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **npm-history:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **npm-lit:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **npm-react:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **npm-svelte:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **persist-web-storage:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **persist:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **primitives:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **react-v1:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **react-v2:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **testing:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **timer:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **undo:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))
* **utils:** change build output ([5bedebd](https://github.com/artalar/reatom/commit/5bedebda3a1ee92850d10f767686303b8ec2ba0e))

## [3.6.0](https://github.com/artalar/reatom/compare/async-v3.5.2...async-v3.6.0) (2023-05-10)


### Features

* **async:** add withPersist for withCache ([dab74e9](https://github.com/artalar/reatom/commit/dab74e964d8092387e9bcfb24f3724cb088ec38c))

## [3.5.2](https://github.com/artalar/reatom/compare/async-v3.5.1...async-v3.5.2) (2023-04-18)


### Bug Fixes

* **async:** withCache for reject ([034d5ec](https://github.com/artalar/reatom/commit/034d5ec5cc4e7581083707275a6c3dd83f1507e0))

## [3.5.1](https://github.com/artalar/reatom/compare/async-v3.5.0...async-v3.5.1) (2023-04-10)


### Bug Fixes

* **async:** [#489](https://github.com/artalar/reatom/issues/489) error in console ([#534](https://github.com/artalar/reatom/issues/534)) ([2f75da5](https://github.com/artalar/reatom/commit/2f75da59325062c05168199a0c247da79fd3fc38))
