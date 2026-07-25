# `composite-overflow` review

Scope: `packages/ux/src/composite-overflow/**` (5 files).

## Counts

- Findings: 3 total — 0 critical, 1 high, 1 medium, 1 low.
- Resolution: 2 fixed, 1 open.
- Bundle-size checks: 1 single-use helper fixed.
- Code changed: yes.

## Findings

- [High][Fixed] `compositeOverflowProps().disclosure`: a model without a
  `composite` exposed a native-tab-stop disclosure with `aria-hidden="true"`
  until it received focus.
  Why it matters: the API explicitly supports a lone overflow popover, but its
  only disclosure was absent from the accessibility tree while still keyboard
  focusable. It therefore behaved neither as a valid standalone disclosure nor
  as an item represented by composite children.
  Fix: hide the disclosure only when a composite exists; a unit regression now
  keeps the standalone disclosure exposed before and after focus.

- [Medium][Open] `disclosureId` / `unrenderDisclosure`: changing the writable
  id while the disclosure is focused leaves its old item registered after blur.
  Why it matters: `unrenderDisclosure` looks up the current id, while the
  collection registration still belongs to the previous id. The stale rendered
  item remains in arrow-key navigation with a render reference after the
  disclosure reports itself unfocused.
  Fix: either make `disclosureId` immutable or track the exact registered node
  and migrate it when the id changes. This remains open because choosing live-id
  mutation semantics changes the public model contract and is not a low-risk
  review fix.

- [Low][Fixed] `tabIndexOf`: a private helper used once added a function and
  call solely to populate one property of the disclosure record.
  Why it matters: `@reatom/ux` is a browser-facing package, so single-use
  wrappers add avoidable bundle bytes and indirection.
  Fix: inline the roving-tabindex derivation into the disclosure computed and
  remove its now-unused type import.

## Reatom audit

All atoms, computeds, and actions are named and grouped on the parent model.
DOM callbacks that touch Reatom state are wrapped, and tests reset the default
context. The production scope has no async boundaries, effects, external
subscriptions, timers, or mutable collection snapshots.

## Verification

- `pnpm vitest run src/composite-overflow`: 3 files passed, 34 tests passed, no
  type errors.
- `pnpm vitest run --config=vitest.browser.config.ts src/composite-overflow`: 1
  file passed, 3 Chromium tests passed.
- Prettier check passed for the modified source, test, and review files.

## Residual risks

- Live `disclosureId` mutation remains unsafe while the disclosure is focused,
  as described in the open finding.
- The browser suite proves focus and DOM attributes, but does not run a screen
  reader accessibility-tree assertion.
