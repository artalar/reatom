# `menubar` review

Scope: `packages/ux/src/menubar/**`.

## Counts

| Severity  | Found | Fixed |  Open |
| --------- | ----: | ----: | ----: |
| Critical  |     0 |     0 |     0 |
| High      |     0 |     0 |     0 |
| Medium    |     0 |     0 |     0 |
| Low       |     3 |     2 |     1 |
| **Total** | **3** | **2** | **1** |

Code changed: **yes** (source documentation only; runtime behavior is unchanged).

## Findings

- [Low][Fixed][Bundle size] `props.ts` and `reatomMenubar.ts` file banners:
  Detached file-level JSDoc was preserved in the JavaScript bundle even though
  it documents no public symbol.
  Why it matters: the menubar implementation is deliberately thin, so emitted
  prose is a material fraction of its cost.
  Fix: Change both detached banners to ordinary block comments. The emitted ESM
  menubar slice fell from 5,602 to 5,348 raw bytes and from 2,205 to 2,103 gzip
  bytes.

- [Low][Fixed] `menubarProps` and `reatomMenubar` remarks: The documentation
  described the layer as adding “two roles”, omitting `aria-orientation`, while
  another sentence described only Ariakit's two container attributes and did
  not account for this package's item record.
  Why it matters: consumers need to know which semantics come from the
  composite and which are imposed by the menubar layer.
  Fix: State the exact additions: container `role`, container
  `aria-orientation`, and item `role`.

- [Low][Open][Bundle size] public runtime API JSDoc: The package build preserves
  the exported helpers' JSDoc in JavaScript. After the local fix, public JSDoc
  is still 4,056 raw bytes (about 1,565 gzip) of the 5,348-byte menubar slice.
  Why it matters: documentation is nearly three quarters of this feature's
  compressed emitted size.
  Fix: Configure the package build to strip non-license comments from
  JavaScript while retaining declaration-file documentation. That is a
  package-wide build decision outside this directory's review scope; deleting
  useful public API docs locally is not an acceptable substitute.

## Reatom and behavior audit

- The factory follows the `reatom*` naming convention and gives every computed
  record a hierarchical trace name.
- There are no async boundaries, effects, manual subscriptions, or external
  callbacks owned by this layer. DOM handlers come from the composite records,
  where they are already wrapped.
- Writes remain on the underlying composite atoms/actions; no positional atom
  writes, mutable collection updates, or durable action-call assumptions were
  introduced.
- Item records preserve the composite record's cache policy through a
  per-model `WeakMap`; option-bearing records remain uncached.
- Tests reset the default Reatom context and exercise defaults, overrides,
  navigation, prop reactivity, event preservation, caching, names, composition,
  and public types.
- Current Ariakit sources confirm the horizontal/looping store defaults and the
  container role/orientation behavior.

## Verification

- `pnpm vitest run src/menubar` — 3 files passed, 22 tests passed, no type
  errors.
- `pnpm exec prettier --check src/menubar/props.ts src/menubar/reatomMenubar.ts`
  — passed.
- `pnpm build` — passed; ESM 432.72 kB (121.07 kB gzip), CJS 454.80 kB
  (123.58 kB gzip).
