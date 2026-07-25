# `menu` review

Scope: `packages/ux/src/menu/**` (9 files).

## Counts

| Severity  | Found | Fixed |  Open |
| --------- | ----: | ----: | ----: |
| Critical  |     0 |     0 |     0 |
| High      |     1 |     1 |     0 |
| Medium    |     3 |     3 |     0 |
| Low       |     1 |     1 |     0 |
| **Total** | **5** | **5** | **0** |

Code changed: **yes**.

## Findings

- [High][Fixed] `MenuPropRecords.item`, `itemCheckbox`, `itemRadio`, and
  `itemButton`: A disabled composite item was skipped by keyboard navigation but
  its menu handlers still moved to it, changed checked state, opened a submenu,
  or closed the menu tree. The records did not expose `aria-disabled`.
  Why it matters: Disabled menu commands remained pointer-activatable and were
  not announced as disabled, producing both incorrect state and an accessibility
  failure.
  Fix: Render `aria-disabled` and guard pointer, click, checked-value, and submenu
  activation paths with the item atom. Added runtime and type regressions.

- [Medium][Fixed] `cachedCheckedItem`: The cache coerced item values with
  `String(value)`, so numeric `1` and string `'1'` returned the same checkbox or
  radio record.
  Why it matters: The second record retained the first record's value and could
  read or write the wrong group member.
  Fix: Use a JSON tuple key that preserves value types and escapes field
  contents. Added a regression that reproduced one shared record with value
  `1` before the fix.

- [Medium][Fixed] `labelledBy`: `renderedButtonId` was a mutable, non-reactive
  closure changed when `itemButton(...)` was called rather than when its element
  mounted.
  Why it matters: An already subscribed list kept the fallback
  `aria-labelledby` forever, and merely constructing an unrendered record could
  change the label.
  Fix: Derive the label from the reactive mounted `disclosureElement.id`, with
  the configured button id as the pre-mount fallback. Added a subscribed-list
  regression.

- [Medium][Fixed] `onButtonMouseLeave`: The handler aborted `showDelayed` even
  when a zero-delay show had completed synchronously and `showPending()` was
  false.
  Why it matters: An immediate hover/leave sequence emitted an unhandled
  `AbortError`; the required targeted Vitest command had 119 passing assertions
  but still exited nonzero.
  Fix: Abort only an actually pending delayed show. The formerly failing hover
  sequence now completes without an unhandled rejection.

- [Low][Fixed] `props.ts`: Six private helpers had one call site:
  `describeItemElement`, `hasPopupAttribute`, `canShowOnHover`,
  `onListKeyDown`, `leavingForItems`, and `checkedKey`.
  Why it matters: `@reatom/ux` emits one unminified entry bundle; private
  one-call functions add avoidable bytes, closures, and—in `onListKeyDown`'s
  case—an extra wrapped frame.
  Fix: Inline each policy at its sole call site. Public runtime helpers re-exported
  by `src/index.ts` remain intact.

## Reatom and async audit

- All public DOM callbacks that read or write atoms enter through `wrap`.
- The inherited hover delay is a named action using `await wrap(sleep(ms))` and
  `withAbort()`; cancellation is not surfaced as a business error.
- There are no async queries, status/retry extensions, effects, raw timers,
  subscriptions, or stale v3 APIs in the menu scope.
- Tests isolate the default context with `context.reset()`, and browser
  subscriptions are cleaned up.

## Verification

- `pnpm --filter @reatom/ux exec vitest run src/menu`: 8 files passed, 121 tests
  passed, no type errors.
- `pnpm --filter @reatom/ux exec vitest run --config=vitest.browser.config.ts src/menu`:
  1 file passed, 8 Chromium tests passed.
