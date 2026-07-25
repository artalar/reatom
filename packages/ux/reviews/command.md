# `command` review

Scope: `packages/ux/src/command/**` (6 files).

## Counts

- Findings: 3 total — 0 critical, 1 high, 0 medium, 2 low.
- Resolution: 2 fixed, 1 open.
- Bundle-size checks: 1 unnecessary payload fixed; 1 single-use helper and 6 implementation-only exports flagged.

## Findings

- [High][Fixed] `mapKeyUpIntent`: changing reactive `clickOnSpace` to `false` between a handled Space keydown and its keyup returned `IGNORE` before clearing `pressed` and `active`.
  Why it matters: the command could remain permanently `data-active`; an option that suppresses activation must not suppress cleanup of an activation already in progress.
  Fix: release a matching Space press before the `clickOnSpace` click guard. Added mapper, model, and browser coverage proving that no click is dispatched.

- [Low][Fixed] `mapActivationIntent` → `mapKeyUpIntent`: every keyup allocated and passed `clickOnEnter` and `firefox`, although the keyup policy cannot read either field.
  Why it matters: this is avoidable output and work on every command keyup.
  Fix: narrow the keyup context to `clickOnSpace`, `disabled`, and `pressed`, and omit the dead fields.

- [Low][Open] `mapActivationIntent.ts` and `props.ts`: `isActivationSpaceKey`, `isNativeActivation`, `getActivationClickInit`, `ActivationClickInit`, `describeKeyEvent`, and `applyActivationIntent` are exported but have no production consumers outside the command implementation. `getActivationClickInit` is also a single-use production helper.
  Why it matters: these exports enlarge the public API and CJS surface; the single-use click-init helper adds an avoidable wrapper.
  Fix: make the implementation helpers private and inline `getActivationClickInit` into `applyActivationIntent`. This was not applied because removing their package-level re-exports requires an edit outside the authorized `command/**` scope and is an API-surface decision.

## Verification

- `pnpm -F @reatom/ux exec vitest run src/command`: 3 files passed, 35 tests passed, no type errors.
- `pnpm -F @reatom/ux exec vitest run --config=vitest.browser.config.ts src/command`: 1 file passed, 10 Chromium tests passed.

## Residual risks

- Script-created keyboard events cannot set `isTrusted`, so native browser activation remains covered through descriptor-policy tests rather than a trusted-event end-to-end test.
- The Firefox popup exception is covered for scheduling order, but the test environment does not prove real popup-blocker behavior.
