# `composite` review

Scope: `packages/ux/src/composite/**` (12 files, including typeahead).

## Counts

- Findings: 3 total — 0 critical, 0 high, 2 medium, 1 low.
- Resolution: all 3 fixed.
- Bundle-size checks: 5 private single-use helpers inlined; public pure helpers
  retained as API.
- Code changed: yes.

## Findings

- [Medium][Fixed] `reatomComposite.navigate`: a navigation query that returned
  `undefined` still called `move(undefined)`.
  Why it matters: actions are observable even when their body leaves state
  unchanged. Focus and selection consumers therefore saw a move event for
  “nowhere to go”; `withCompositeFocus` could call `focus()` and
  `scrollIntoView()` at a navigation boundary even though the key was not
  consumed.
  Fix: call `move` only for a real `string | null` destination, and make the DOM
  focus hook ignore direct `move(undefined)` calls. Unit and browser regressions
  prove that neither a move event nor a redundant focus call occurs.

- [Medium][Fixed] `withCompositeFocus`: its `withConnectHook(target)` created an
  `effect` that read `target()` directly.
  Why it matters: an effect subscribed from a connect hook must not depend on
  that hook’s own target; this creates a connect/subscribe feedback edge and
  makes lifecycle behavior depend on core connection internals. The effect also
  re-read focus handles on unrelated model changes although only `move` calls
  can request focus.
  Fix: install an `addCallHook(target.move, ...)` while the composite is
  connected and remove it on disconnect. The deferred callback checks the
  captured connection abort signal before touching the DOM.

- [Low][Fixed] `reatomComposite.ts`, `props.ts`, and `getNextId.ts`: five private
  helpers had one call site: `seedActiveId`, `navigationState`,
  `isTextFieldTarget`, `isSelfTargetOrItem`, and `createEmptyItem`.
  Why it matters: `@reatom/ux` ships through one public barrel without
  minification; one-use wrappers add emitted functions and indirection.
  Fix: inline each helper at its only call site. `isTabbable` remains separate
  because its lazy closure safely resolves the collection being constructed.

## Reatom async/context audit

The typeahead delay follows the canonical flow:
`await wrap(sleep(timeout))` inside the named `expire` action with
last-in-win `withAbort()`. `clear` explicitly aborts the pending expiration,
and the fire-and-forget scheduler suppresses only expected abort rejections.
DOM handlers and deferred focus callbacks use `wrap`; no unwrapped awaited
continuation, manual timer, async status misuse, or abort-as-business-error
path remains.

## Verification

- `pnpm vitest run src/composite`: 8 files passed, 111 tests passed, no type
  errors.
- `pnpm vitest run --config=vitest.browser.config.ts src/composite`: 3 files
  passed, 11 Chromium tests passed.
- Prettier check passed for all modified composite source and test files.

## Residual risks

- The package barrel intentionally exposes the navigation and typeahead pure
  helpers. Removing low-level exports could reduce the CJS API surface, but it
  is a breaking API decision outside this scoped review.
- Browser tests use synthetic keyboard events; trusted browser default actions
  remain represented by policy and focus assertions rather than generated
  `isTrusted` events.
