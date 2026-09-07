# `tab` review

Scope: `packages/ux/src/tab/**` (6 files, including tests).

## Counts

| Severity  | Found | Fixed |  Open |
| --------- | ----: | ----: | ----: |
| Critical  |     0 |     0 |     0 |
| High      |     1 |     1 |     0 |
| Medium    |     2 |     1 |     1 |
| Low       |     2 |     2 |     0 |
| **Total** | **5** | **4** | **1** |

Code changed: **yes**.

## Findings

- [High][Fixed] `withTabFocus`: A `withConnectHook` created an `effect` that
  read the hook target itself, and its deferred move did not check whether the
  owning connection had already been aborted.
  Why it matters: An effect owned by an atom's connection must not subscribe to
  that same atom; this creates a connect/subscribe feedback edge. A queued move
  also survived disconnect in a regression test, so stale work could mutate a
  tab after its view unmounted.
  Fix: Install an `addChangeHook` only while connected, return its cleanup, and
  check the captured connection abort signal before the queued move. A
  regression disconnects between notification and the microtask and proves no
  move occurs.

- [Medium][Fixed] `panelFor`: It searched every registered panel, including an
  explicitly paired panel that had never rendered or had already unrendered.
  Why it matters: `tabItemProps` used the result for `aria-controls`, producing
  an ID reference to a panel element that did not exist in the document.
  Fix: Search `renderedItems()` and cover the register, render, and unrender
  transitions.

- [Medium][Open][Bundle size] `reatomTab` unconditionally applies
  `withTabProps`, so importing the model retains the tab prop-record layer even
  when a consumer only needs state and navigation.
  Why it matters: The scoped change adds 1,145 production source lines, 446 of
  them in `props.ts`; tree shaking cannot remove that runtime from
  `reatomTab` because the factory calls it directly. The package's single
  barrel and unminified distribution make this coupling visible in shipped
  output.
  Fix: A future API-level change could expose a model-only factory or a
  separately importable model entry and compose prop records in `reatomTab`.
  This was not changed because splitting the existing return contract is not a
  low-risk scoped refactor.

- [Low][Fixed] `tab.test.ts`: Tests subscribed again to `effect` instances that
  were already self-subscribed, then disposed only the redundant subscription.
  Why it matters: The original effects stayed connected until the next
  `context.reset()`, weakening lifecycle assertions and adding trace work.
  Fix: Dispose each effect through its own `unsubscribe`.

- [Low][Fixed] `tab.test.browser.ts`: A raw DOM listener called `tab.set`
  without entering Reatom context.
  Why it matters: The browser test modeled an unsafe integration and would fail
  strict context propagation even though production handlers are wrapped.
  Fix: Pass a `wrap`ped listener to `addEventListener`.

## Reatom and lifecycle audit

- Atoms, computeds, effects, and actions are named; the factory uses the
  `reatom*` prefix and writes use `.set`.
- No async query, mutation, status, retry, cache-ordering, timer, or stale v3
  API path exists in this scope.
- DOM handlers and microtask callbacks enter Reatom context through `wrap`.
- Hosted preservation remains connection-scoped, and the focus extension now
  uses a dynamically removed change hook instead of a self-dependent effect.
- One private single-use `seedSelectedId` binding was inlined. Public pure
  helpers remain because removing exports would require an out-of-scope barrel
  and API change.

## Verification

- `pnpm exec vitest run src/tab`: 3 files passed, 51 tests passed, no type
  errors.
- `pnpm exec vitest run --config=vitest.browser.config.ts src/tab`: 1 file
  passed, 6 Chromium tests passed.
- `pnpm exec prettier --check "src/tab/**/*.ts"`: passed.

## Residual risks

- The bundle-size coupling above remains open.
- Browser coverage runs in Chromium only; Safari's click-focus behavior is
  represented by the no-focus click regression rather than a WebKit run.
