# `dialog` review

Scope: `packages/ux/src/dialog/**`.

## Summary

- Findings: 5 total — 3 High, 2 Low.
- Addressed: 4 — 2 High, 2 Low.
- Open: 1 High.
- Reatom async audit: every continuation that touches Reatom after an async
  boundary uses `await wrap(...)`; DOM listeners use `onEvent` or a wrapped
  callback; focus actions use `withAbort`; effect-owned cleanup uses
  `abortVar.subscribe`.

## Findings

- [High][Fixed] `disableTree`: the no-`inert` fallback only removed descendant
  elements from the tab order. A focusable branch root stayed tabbable, and
  programmatic `.focus()` could still enter any disabled element.
  Why it matters: in browsers without native `inert`, a modal did not actually
  trap focus or make the background non-interactive.
  Fix: include the branch root, temporarily replace each tabbable element's
  `focus` method, restore both changes safely, and cover the fallback in
  Chromium with native `inert` temporarily removed.

- [High][Fixed] `resolveInitialFocus`: the first
  `[data-autofocus=true]`/`[autofocus]` element won even when hidden or
  otherwise unfocusable.
  Why it matters: `.focus()` then did nothing and opening a modal left focus on
  `<body>` or an inert disclosure.
  Fix: require the autofocus candidate to pass `isFocusable`, then continue to
  the first tabbable element or dialog container.

- [High][Open] `walkTreeOutside`: traversal follows `parentElement`, which ends
  at a `ShadowRoot`; a modal rendered in an open shadow root never reaches its
  host or the document's background branches.
  Why it matters: the package handles shadow-root event retargeting, but the
  same dialog can still leave the page outside the shadow root interactive.
  Fix: implement and browser-test a composed-tree walk with shadow-host-aware
  containment. This was not patched because getting nested roots and kept
  branches right is not a low-risk local change.

- [Low][Fixed] `dialogDom.ts` and `reatomDialogDom.ts`: six private helpers had
  one call site (`flushRestores`, `supportsScrollbarGutter`, `microtask`,
  `nextFrame`, `getDocument`, and `isInside`).
  Why it matters: this package ships one bundled entry, so the extra function
  declarations and calls add avoidable output.
  Fix: inline the helpers at their only use while preserving async and restore
  semantics.

- [Low][Fixed] `dialog.test.browser.ts`: `@vitest/browser/context` is deprecated
  and scheduled for removal in the next Vitest major.
  Why it matters: the focused browser suite emitted a deprecation warning and
  would eventually stop loading.
  Fix: import `userEvent` from `vitest/browser`.

## Verification

- Before the fixes, the two new browser regressions both failed: hidden
  autofocus left `<body>` active, and the fallback branch root kept
  `tabIndex === 0`.
- `pnpm exec vitest run src/dialog/dialog.test.ts src/dialog/dialog.test-d.ts`
- `pnpm exec vitest run --config=vitest.browser.config.ts src/dialog/dialog.test.browser.ts`
