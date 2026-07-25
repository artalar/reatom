# `hovercard` review

Scope: `packages/ux/src/hovercard/**`

## Counts

| Severity  | Found | Fixed |  Open |
| --------- | ----: | ----: | ----: |
| Critical  |     1 |     1 |     0 |
| High      |     2 |     2 |     0 |
| Medium    |     1 |     0 |     1 |
| Low       |     2 |     2 |     0 |
| **Total** | **6** | **5** | **1** |

Code changed: **yes**.

## Findings

- [Critical][Fixed] `withHovercardHover`: Reducing `MouseEvent.composedPath()` to its first node and then calling `contains` misclassified a shadow-root widget inside the card as outside. The card started its hide delay while the pointer was still over its content.
  Why it matters: This reproduces Ariakit's shadow-widget regression and closes the hovercard incorrectly. The full composed path preserves ownership across shadow boundaries.
  Fix: Check card, anchor, disclosure, and nested-card membership against the full composed path. Added a browser regression with a button inside an open shadow root.

- [High][Fixed] `withHovercardHover`: The valid hover region omitted the disclosure element, and only focus in the parent card pinned it open; focus inside a nested card did not.
  Why it matters: Moving over the disclosure scheduled a hide, and an interactive nested hovercard could close its parent while the user was still focused inside the nested card.
  Fix: Treat the disclosure as an anchor-side hover element and include `hasFocusWithin` for every mounted nested card. Added browser regressions for both paths.

- [High][Fixed] `showDelayed`: A renderer can reattach the recomputed disclosure callback ref after a hover show and overwrite `disclosureElement` with the hidden button.
  Why it matters: Dialog outside-interaction exemptions and fallback focus restoration use `disclosureElement`; after a hover show it must continue to identify the hovered anchor, not the hidden keyboard control.
  Fix: Reassert the captured anchor in a wrapped microtask after `show()`, matching Ariakit's post-render assignment. Added a regression that simulates the ref reattachment.

- [Medium][Open] `connectPointerMoving`: Every connected hovercard installs five document listeners even when the models share the default `pointerMoving`; nested menus therefore multiply identical action calls and trace noise.
  Why it matters: The default model is explicitly process-wide, so listener ownership should also be shared. The current behavior is correct but scales linearly with connected hovercards.
  Fix: Move document-listener ownership to a model-level connection service, or use a ref-counted per-model connection whose abort scope remains alive until the last user disconnects. This is not a low-risk local edit because tying the shared listeners to the first caller removes them too early.

- [Low][Fixed] `getEnterPointPlacement`: A private helper was called once and retained an extra function in the bundled implementation.
  Why it matters: `@reatom/ux` is a headless primitive bundle; once-used private wrappers add avoidable bytes and indirection.
  Fix: Inline the two placement expressions into `getSafePolygon`.

- [Low][Fixed] `reatomHovercard` JSX example: The visually hidden disclosure button was empty.
  Why it matters: An empty button has no accessible name and the example encouraged a broken keyboard control.
  Fix: Give the example the visible/accessibility text `Details`.

## Async and lifecycle checks

- `showDelayed` and `hideDelayed` await `wrap(sleep(ms))` inside named actions extended with `withAbort()`.
- Abort is treated as normal cancellation by `scheduleHovercardDelay`; non-abort failures still surface.
- DOM listeners use `onEvent` inside `withConnectHook`, so per-hovercard listeners clean up on disconnect.
- Mutation observer callbacks use `wrap`, and observer cleanup is bound to `abortVar`.

## Verification

- `pnpm vitest run src/hovercard`
- `pnpm vitest run --config=vitest.browser.config.ts src/hovercard`
- `pnpm run build`

All three pass. The package-wide `pnpm run typecheck` remains blocked by
pre-existing errors in `src/checkbox/reatomCheckbox.ts` and
`src/combobox/props.ts`, outside this review's scope; the hovercard Vitest run
reports no type errors.
