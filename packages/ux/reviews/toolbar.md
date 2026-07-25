# `toolbar` review

Scope: `packages/ux/src/toolbar/**` (4 files).

## Counts

| Severity  | Found | Fixed |  Open |
| --------- | ----: | ----: | ----: |
| Critical  |     0 |     0 |     0 |
| High      |     0 |     0 |     0 |
| Medium    |     2 |     1 |     1 |
| Low       |     2 |     1 |     1 |
| **Total** | **4** | **2** | **2** |

Code changed: **yes**.

## Findings

- [Medium][Fixed] `withToolbarProps`: the extension returned the non-generic
  `Toolbar` atom type, so applying it after another extension erased all earlier
  extension members from TypeScript even though they remained present at
  runtime.
  Why it matters: Reatom extensions preserve the atom reference and must compose;
  a toolbar upgrade could make valid custom model capabilities inaccessible to
  consumers solely because extension order changed.
  Fix: make the extension generic and return `Target & Toolbar`. A type regression
  proves that a prior `marker` extension survives the toolbar upgrade.

- [Medium][Open] `ToolbarPropRecords.separator`: the record has one derived
  orientation and offers no explicit override. Current Ariakit
  `CompositeSeparatorOptions` accepts `orientation`, and its July 2026 fix
  explicitly made toolbar separators honor that option.
  Why it matters: the perpendicular default is correct for the usual layout, but
  a separator deliberately laid out on the other axis is announced incorrectly
  with no record-level way to correct it.
  Fix: design a backward-compatible per-separator options API. Changing
  `separator` from a `Computed` to a record factory would break existing
  `$spread={toolbar.props.separator}` consumers, so this is not a low-risk scoped
  edit.

- [Low][Fixed] `reatomToolbar` JSX example: it rendered `bold` and `italic`
  records without declaring either item.
  Why it matters: the example was not copyable and hid the required relationship
  between a rendered item model and `props.item`.
  Fix: capture both `renderItem` return values before using them.

- [Low][Open][Bundle] `toolbarAriaOrientation`: importing this pure helper from
  either the toolbar module or the package barrel emits an otherwise unused
  `computed` import from `@reatom/core`, because the helper shares `props.ts`
  with reactive record construction and core is marked side-effectful.
  Why it matters: a pure 2-branch helper should not initialize or retain the
  reactive runtime. The measured minified bundle is 93 B / 104 B gzip rather
  than a dependency-free helper.
  Fix: move orientation helpers to a dependency-free module and export them
  directly from the package barrel. The barrel edit is outside this review's
  toolbar-only scope.

## Reatom audit

- All toolbar-created computed records are named after the model.
- Writes use `.set`; no identity actions, stale v3 APIs, mutable collection
  snapshots, effects, subscriptions, or async boundaries exist in this scope.
- DOM callbacks are inherited from composite prop records, where they are
  wrapped; toolbar adds no unframed callback.
- Tests reset the default context in `beforeEach`, as required for shared Reatom
  test state.

## Bundle-size check

With `@reatom/core` external, esbuild produced:

- pure orientation helper, deep import: 93 B minified / 104 B gzip;
- pure orientation helper, package barrel: 93 B / 104 B gzip;
- `reatomToolbar`, deep import: 11,514 B / 4,631 B gzip;
- `reatomToolbar`, package barrel: 11,514 B / 4,639 B gzip.

The barrel does not retain unrelated UX features. The toolbar factory cost is
the composite, collection, navigation, typeahead, and prop machinery it
necessarily constructs. `@reatom/ux` has no size budget, so regressions in that
4.6 KB gzip path are currently unguarded.

## Verification

- `pnpm vitest run src/toolbar`: 3 files passed, 27 tests passed, no type errors.
- The new type regression failed before the fix with `Property 'marker' does not
exist on type 'Toolbar'` and passes after the generic extension change.

## Residual risks

- Explicit separator orientation remains unavailable until a compatible record
  API is chosen.
- Toolbar has no dedicated browser suite by design; real focus movement is
  covered by composite browser tests rather than re-executed in this scoped
  review.
