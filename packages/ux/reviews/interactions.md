# `interactions` review

Scope: `packages/ux/src/interactions/**` (5 files, including tests).

## Counts

- Findings: 3 total — 0 critical, 0 high, 1 medium, 2 low.
- Resolution: 2 fixed, 1 open.
- Bundle-size checks: no private single-use helper remains to inline; 1
  production-unused public helper flagged.
- Code changed: yes.

## Findings

- [Medium][Fixed] `isTextFieldElement`: the global
  `HTMLInputElement` constructor rejected inputs created by a same-origin
  iframe because each window has a different constructor realm.
  Why it matters: command, composite, combobox, and focusable keyboard policies
  could misclassify an iframe text input as a non-text control and handle keys
  that should remain available for text editing.
  Fix: identify inputs and textareas by `tagName`, then probe
  `selectionStart`. A Chromium regression test proves that an input which is
  not an instance of the parent window's `HTMLInputElement` is still detected.

- [Low][Fixed] `ElementDescriptor.ariaDisabled`: the type allowed only
  `'true'`, `'false'`, and `null`, while `describeElement` force-cast the
  unrestricted string returned by `getAttribute`.
  Why it matters: a descriptor could violate its declared type whenever the
  DOM contained another authored token, making exhaustive consumer logic
  unsound.
  Fix: accept authored strings in the descriptor and remove the cast. Unit and
  browser coverage preserve unknown values while treating them as enabled.

- [Low][Open] `isDisabledDescriptor`: this runtime helper has no production
  call sites, but is re-exported from the package barrel.
  Why it matters: the CJS bundle retains a function and public API entry that
  only tests consume.
  Fix: remove the helper, its tests, and its package-barrel re-export in a
  coordinated API cleanup. The re-export is outside this review's authorized
  scope, so the potentially breaking removal was not applied.

## Reatom async/context audit

`queueBeforeEvent` correctly enters Reatom context through `wrap` for animation
frame and timer callbacks and through `onEvent` for the event callback. Its
cancel path tears down both triggers, and direct browser tests cover event-first
execution and cancellation. No awaited continuation, stale API, eager effect,
or abort/status misuse exists in this scope.

## Verification

- `pnpm exec vitest run src/interactions`: 1 file passed, 3 tests passed, no
  type errors.
- `pnpm exec vitest run --config=vitest.browser.config.ts src/interactions`: 1
  file passed, 4 Chromium tests passed.
- `pnpm exec prettier --check "src/interactions/**/*.ts"`: passed.

## Residual risks

- The selection probe's Safari-specific exception path is retained but is not
  exercised by the Chromium browser project.
- Removing the production-unused public helper requires an explicit API-surface
  decision and an edit to `src/index.ts`.
