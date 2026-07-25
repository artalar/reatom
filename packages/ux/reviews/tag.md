# `tag` review

Scope: `packages/ux/src/tag/**` (8 files).

## Counts

| Severity  | Found | Fixed |  Open |
| --------- | ----: | ----: | ----: |
| Critical  |     0 |     0 |     0 |
| High      |     1 |     1 |     0 |
| Medium    |     2 |     1 |     1 |
| Low       |     1 |     1 |     0 |
| **Total** | **4** | **3** | **1** |

Code changed: **yes**.

## Findings

- [High][Fixed] `TagInputProps.onInput`: A delimiter was split into tags while
  an IME input event was still composing.
  Why it matters: Japanese, Korean, and other composition-based input may emit
  delimiter characters before the composition is committed. The old handler
  cleared the input and stored an incomplete tag at that intermediate event.
  Fix: Preserve the controlled value during composition but defer delimiter
  processing until the final input event. Cover both a framework-wrapped
  `nativeEvent.isComposing` and a real Chromium `InputEvent.isComposing`.

- [Medium][Fixed] `withTagTouch`: The connect hook was attached to the parent
  active-id atom, although the records that need the probe subscribe to the
  `touch` atom.
  Why it matters: Connecting `props.listbox` alone never ran the probe, so its
  accessibility role could stay on the non-touch variant despite the record
  being actively consumed.
  Fix: Attach the connection hook to `target.touch`, the state all
  touch-dependent records actually read. The browser regression connects only
  `props.listbox`.

- [Medium][Open] `TagUnits.values` and `TagUnits.tagId`: The writable/adoptable
  values atom accepts duplicate strings, but element ids and memoized records
  are keyed only by string value.
  Why it matters: Two logical entries then receive the same DOM id and prop
  record; keyed renderers may collapse them, while unkeyed renderers emit
  duplicate ids. `addValue` prevents this path, but the documented bulk
  `values.set(...)`, initial `values`, and caller-owned `valuesAtom` do not.
  Fix: Define uniqueness as an explicit values-atom invariant and enforce it at
  every write boundary, or redesign item identity to distinguish occurrences.
  Neither is a low-risk local patch because adopted atoms can be written by
  their owners and deduplication would change their state semantics.

- [Low][Fixed] `defaultRemoveLabel`: A private helper had one reference and
  remained as an extra function in the unminified package bundle.
  Why it matters: `@reatom/ux` ships a single headless-primitives entry bundle;
  private one-use wrappers add avoidable bytes and indirection.
  Fix: Inline the default label expression in `removeRecord`. The other
  one-call-looking helpers in this folder are package exports from
  `src/index.ts`, so removing them would be a public API change rather than a
  bundle-only cleanup.

## Reatom/context audit

- Every atom, computed, and action created by the tag model is named.
- DOM handlers and the caret microtask re-enter Reatom through `wrap`.
- `queueBeforeEvent` owns the mouseup/frame callback context and cancellation.
- The only connection hook writes its child state without reading its hook
  target, so it has no self-dependent effect edge.
- There are no async queries, mutations, status/retry extensions, timers, or
  action-call lists in scope.

## Verification

- `pnpm -F @reatom/ux exec vitest run src/tag`: 4 files and 72 tests passed,
  with no type errors.
- `pnpm -F @reatom/ux exec vitest run --config=vitest.browser.config.ts src/tag`:
  1 file and 13 Chromium tests passed.
- `pnpm -F @reatom/ux run build`: ESM, CJS, and declaration bundles built.

## Residual risk

- Duplicate externally supplied tag values remain unsupported in practice but
  unenforced, as described in the open finding.
