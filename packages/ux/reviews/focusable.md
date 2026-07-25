# `focusable` review

Scope: `packages/ux/src/focusable/**`

## Summary

- Findings: 4 total — 0 Critical, 1 High, 1 Medium, 2 Low.
- Resolution: all 4 fixed.
- Code changed: yes.

## Findings

- [High] `connectFocusable`: the focus-visible cleanup effect was subscribed
  twice with `effect(...).subscribe()`.
  Why it matters: `effect` self-subscribes. The returned cleanup removed only
  the extra subscription, leaving the original subscription alive after DOM
  detachment and retaining both the model and element.
  Fix: retain the effect and call its `unsubscribe()` method during detach. A
  browser regression test proves detached elements no longer react to model
  changes.

- [Medium] `connectKeyboardModality`: listeners were always attached to the
  global `document`, even for a focusable owned by another document.
  Why it matters: the documented dedicated-model path for iframes could not
  observe that frame's events, so pointer and keyboard modality became stale.
  Fix: accept an optional owner document and pass `element.ownerDocument` from
  `connectFocusable`. A browser test covers document isolation.

- [Low] `reatomFocusVisible` JSDoc: it referred to a nonexistent
  `withGlobalModality()` helper and claimed `keyboardModality` was exported from
  `focusableDom.ts`.
  Why it matters: the documented setup was not copyable.
  Fix: document `connectKeyboardModality()` / `connectFocusable()` and the
  actual export location.

- [Low] `isVisible`: a private helper used once added an avoidable function to
  this public barrel's bundle.
  Why it matters: `@reatom/ux` is a browser-facing package and one-use private
  wrappers add bytes and indirection without reuse.
  Fix: inline the visibility check into `isFocusable`.

## Reatom async/context audit

No remaining `wrap` / `onEvent` issue was found. DOM modality listeners use
`onEvent`, while microtask, animation-frame, timer, and
`IntersectionObserver` callbacks that touch Reatom state enter through
`wrap`. The production focusable code contains no awaited continuation.

## Verification

- `pnpm exec vitest run src/focusable`: 3 files, 38 tests passed; no type
  errors.
- `pnpm exec vitest run src/focusable --config=vitest.browser.config.ts`: 1
  file, 15 browser tests passed.
- Prettier check passed for all modified focusable source and test files.

Residual risk: the child-document coverage uses a same-realm synthetic
document; cross-origin frame document access remains the caller's
responsibility.
