# `@reatom/ux` — Ariakit `main` vs `solid/next` (PR 4378) gap analysis

> Comparison of `ariakit@origin/main` (`197ae62`, 2026-07-25) against the
> `pr-4378` snapshot (`8c7b473`, 2026-05-29) that every `@reatom/ux` port was
> read from. Local clone: `tmp/ariakit` (shallow on `main`; all comparisons are
> tree-vs-tree, which is exact).

## TL;DR

**The store inventories are identical.** Ariakit `main` adopted the solid/next
architecture: `@ariakit/components` with the same 19 framework-agnostic stores
exists on both branches, and `pr-4378` is a strict snapshot of it — `main` has
kept releasing on top (`@ariakit/components` 0.1.1 → 0.1.8,
`@ariakit/react-components` 0.1.1 → 0.3.4). So there is **no store on `main`
that solid/next lacks**, and nothing `@reatom/ux` ported is obsolete.

The real gaps are two kinds:

1. **Behavior deltas `main` shipped after the fork** — bug fixes and small
   features in stores and in the React layer that our ports predate. Most are
   perf-only (irrelevant: Reatom's architecture already avoids the flat-store
   costs they fix), but a handful are semantic: `typeaheadText`, the
   anchor-element precedence sync, the tag delimiter fix, the animation
   end-time fix, the `scrollbar-gutter` scroll lock, and the Esc containment
   contract.
2. **React-only behaviors that never had a store on either branch** — exactly
   one of them is both real logic and unported: **`composite-typeahead`**. It
   is the single feature `@reatom/ux` explicitly deferred
   (`src/select/props.ts` documents the deferral) and both `select` and `menu`
   want it.

**7 actionable items** (1 new feature port, 5 small targeted fixes, 1
changelog-driven review sweep), plus 3 deliberate "later" and a skip list.

> **Status (2026-07-25):** all 7 actionable items are done on this branch.
> See [`MAIN_SWEEP_NOTES.md`](MAIN_SWEEP_NOTES.md) for the changelog sweep
> outcomes; typeahead lives in `src/composite/typeahead.ts`.

## How the comparison was made

- `git diff pr-4378..origin/main -- packages/ariakit-components/src` — 9 of 19
  stores changed; read in full.
- `git diff --stat/--name-status pr-4378..origin/main -- packages/ariakit-react-components/src`
  — `main` is a strict superset (only added files, none removed).
- `packages/ariakit-components/CHANGELOG.md` (0.1.2–0.1.8) and
  `packages/ariakit-react-components/CHANGELOG.md` (0.1.2–0.3.4) on `main` —
  every user-facing change since the fork, cross-checked against
  `packages/ux/src/*`.

## Candidate table

"Store on solid/next" refers to `packages/ariakit-components/src/*/*-store.ts`
at the `pr-4378` snapshot. "In `@reatom/ux`" reflects `packages/ux/src` today.

| Feature / change                                                                                                                                                                                                              | On main                                 | Store on solid/next   | In `@reatom/ux`                                            | Recommendation         | Why                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------- | ---------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `composite-typeahead` (type chars → jump to item)                                                                                                                                                                             | yes (react-only, 284 lines, improved)   | no (react-only there) | **no** — explicitly deferred in `src/select/props.ts`      | **port**               | Pure logic (char buffer, prefix match, `flipItems` loop); `select`/`menu`/`toolbar` consume it; item `text` is ready |
| `typeaheadText` item option (components 0.1.8)                                                                                                                                                                                | yes (store-level)                       | no                    | no (`text` only)                                           | **port** (w/ ↑)        | One option + a match-priority rule (`typeaheadText ?? textContent ?? value`); empty string opts an item out          |
| Popover `anchorElement` ← `disclosureElement` precedence sync (0.3.x store change)                                                                                                                                            | yes (store-level)                       | no                    | partial — disclosure ref writes anchor, no precedence      | **port** (small)       | On main an explicit anchor wins over the disclosure fallback; enables `PopoverAnchor`/`MenuAnchor`/`SelectAnchor`    |
| Combobox `anchorElement` ← `baseElement \|\| disclosureElement` sync                                                                                                                                                          | yes (store-level)                       | no                    | no                                                         | **port** (small)       | Same precedence rule; enables `ComboboxAnchor` (anchor ≠ input)                                                      |
| Tag delimiter matching (react 0.1.2: literal strings, zero-length regex guard)                                                                                                                                                | yes (`tag/utils.ts` + tests)            | n/a (react layer)     | **old buggy behavior**, quirk documented in `tagIntent.ts` | **port** (small)       | `splitTagValue` compiles string delimiters as regexes; metachars mismatch, `/x*/`-style patterns can loop            |
| Disclosure unmount timing (react 0.2.0: per-property `delay + duration` end time)                                                                                                                                             | yes (`disclosure-content.tsx`)          | n/a                   | **old overestimate** in `reatomDisclosureDom.ts`           | **port** (small)       | ux takes longest delay + longest duration across properties, keeping `mounted` true longer than the real end         |
| Modal scroll lock via `scrollbar-gutter` (react 0.3.2)                                                                                                                                                                        | yes (`use-prevent-body-scroll.ts`)      | n/a                   | old body-padding approach in `dialogDom.ts`                | **port** (small)       | No layout shift on pages that already reserve the gutter; fallback path keeps the old technique                      |
| Dialog Esc containment (react 0.3.4: descendant `stopPropagation` respected)                                                                                                                                                  | yes (`dialog.tsx`)                      | n/a                   | Esc handling exists, containment contract not asserted     | **port** (med.)        | Nested third-party widgets must be able to consume Esc; component stops the event at its own boundary                |
| Changelog fix sweep for ported features (combobox IME/Unicode, command pressed state, select valueless-item wrap, hovercard nested-Esc/shadow DOM, focusable focus-visible, radio tab-back, dialog shadow-root/sibling-modal) | yes (0.1.2–0.3.4)                       | n/a                   | unknown per item — ports predate the fixes                 | **review sweep**       | Each is a documented bug class with a repro description; verify against our node/browser tests, fix where failing    |
| `composite-container` (interactive widgets inside composite cells)                                                                                                                                                            | yes (react-only, 298 lines)             | no                    | no                                                         | **later**              | Real behavior (trap/restore focus per cell) but niche — grids with embedded inputs; depends only on `composite`      |
| `UndoManager` (`ariakit-utils/src/undo.ts`, new, 90 lines)                                                                                                                                                                    | yes (util, unused by components)        | no                    | no                                                         | **later**              | Framework-agnostic undo/redo stacks with grouping; if adopted it belongs in `@reatom/core` primitives, not ux        |
| `CollectionRenderer` / `CompositeRenderer` / `SelectRenderer` (virtualization)                                                                                                                                                | yes (react-only, 1214+ lines, evolving) | no                    | no                                                         | **later/skip**         | Deeply layout/React coupled; Reatom consumers virtualize with their own tools; revisit only on demand                |
| `composite-hover` (hover moves active item)                                                                                                                                                                                   | yes (react-only)                        | no                    | **yes** — ported per widget (menu `props`, combobox items) | skip (covered)         | Don't re-port; optionally factor a shared interaction if a third consumer appears                                    |
| `composite-input` (caret-edge arrow-key guard)                                                                                                                                                                                | yes, **deprecated** on main             | no                    | **yes** — caret guard in `composite/navigationIntent.ts`   | skip (covered)         | Main deprecates it in favor of `CompositeItem render`; our guard already implements the behavior                     |
| `focus-trap` / `focus-trap-region`                                                                                                                                                                                            | yes (react-only)                        | no                    | **yes** — sentinel policy in `dialog` (`dialogIntent.ts`)  | skip (covered)         | Standalone `reatomFocusTrapRegion` would be a thin re-export of existing dialog policy; add only on request          |
| `tab.panel(tabId)` store lookup (components 0.1.3)                                                                                                                                                                            | yes (store-level)                       | no                    | equivalent — `reatomLinkedList` keyed map + `props.panel`  | skip (covered)         | The main change is a perf memo for the flat store; atomization already gives O(1) lookup                             |
| Tab `pendingRestore` race fix (store change)                                                                                                                                                                                  | yes                                     | old `syncActiveId`    | n/a — ux replaced the flag with an explicit restore action | skip (verify in sweep) | The mutable-flag race main fixed is the hack our port deliberately removed; sweep confirms with a test               |
| Collection/composite/disclosure store perf work (id caches, fast paths, 49× store)                                                                                                                                            | yes                                     | old versions          | n/a                                                        | skip                   | Workarounds for flat-store O(n) scans; `reatomLinkedList` + per-key atoms don't have the problem                     |
| Side-specific `overflowPadding`, skip-position-updates-while-hidden (popover 0.3.x)                                                                                                                                           | yes (react floating layer)              | n/a                   | n/a — positioning is consumer-owned via `withFloating()`   | skip                   | ux hands middleware/config to the consumer; our auto-update already gates on `mounted`                               |
| `form` store changes (prototype-pollution paths, rAF-hidden-tab fix, form hooks)                                                                                                                                              | yes                                     | yes (old)             | skipped by design — `reatomForm` owns forms                | skip                   | Note: the "rAF stalls in hidden tabs" lesson may interest `@reatom/core`'s form, out of ux scope                     |
| `SelectItemSelected`, `CheckboxCheck`, anchors as components, `getVisuallyHiddenStyle`, native `type="button"` markup, `PopoverArrow` drawing, `Portal` ref fixes                                                             | yes                                     | n/a                   | n/a                                                        | skip                   | View-layer (Bucket C): render wrappers, SSR markup details, SVG drawing, React ref semantics                         |
| `menubar` store simplification, `radio` store cosmetic change                                                                                                                                                                 | yes                                     | old shape             | ported behavior identical                                  | skip                   | Refactors with no observable change                                                                                  |

## Actionable shortlist (in priority order)

### 1. `composite-typeahead` — the one genuinely missing feature

- **Read on main:**
  `packages/ariakit-react-components/src/composite/composite-typeahead.tsx`
  (284 lines — read on `main`, not `pr-4378`: main adds `typeaheadText`
  support, per-store typeahead state via `WeakMap` so two composites on a page
  don't share the char buffer, and unicode-aware `\p{Letter}\p{Number}` key
  filtering) and the `typeaheadText` field in
  `packages/ariakit-components/src/composite/composite-store.ts`.
- **Write:** `packages/ux/src/composite/typeahead.ts` (Layer 1 pure helpers:
  `isValidTypeaheadEvent`-style intent predicate, `itemTextStartsWith` with the
  `typeaheadText ?? text ?? value` priority, `getSameInitialItems` restart
  logic over `flipItems`) plus a small stateful `withTypeahead()` /
  `reatomTypeahead` carrying the char buffer as an atom and the reset delay as
  `await wrap(sleep(500))` + `withAbort()` — not a stored timeout handle.
  Add the `typeaheadText` option to `CompositeItemOptions` /
  `CompositeItemModel` in `packages/ux/src/composite/reatomComposite.ts`
  (empty string = excluded from matching).
- **Wire:** consume from `packages/ux/src/select/props.ts` (button + list —
  removes the documented deferral at ~line 580), `packages/ux/src/menu/props.ts`,
  and optionally `toolbar`. `radio`/`tab` items get `typeaheadText` for free
  through the composite item option.
- **Deps:** `composite` (ported). No new runtime deps.
- **Tests:** node tier for the matcher/restart matrix (Ariakit added
  `composite-store.test.ts` cases on main worth mirroring); one browser test
  for "typing while focus is on a roving item".

### 2. Anchor-element precedence sync (popover + combobox)

- **Read on main:**
  `packages/ariakit-components/src/popover/popover-store.ts` (the
  `syncedAnchorElement` block) and
  `packages/ariakit-components/src/combobox/combobox-store.ts` (same pattern
  with `baseElement || disclosureElement` fallback).
- **Write:** in `packages/ux/src/popover/reatomPopover.ts` +
  `packages/ux/src/popover/props.ts`: an explicitly-set anchor must win over
  the disclosure-ref fallback (today `props.disclosure().ref` unconditionally
  writes `anchorElement`, clobbering a dedicated anchor). Mirror in
  `packages/ux/src/combobox/reatomCombobox.ts` with the input/base fallback.
  In Reatom this is precedence logic in the prop-record refs or a
  `withComputed` — no `sync` listener needed.
- **Why:** this is what makes "anchor is not the button/input" layouts
  (`MenuAnchor`, `ComboboxAnchor` on main) work; downstream `menu`, `select`,
  `hovercard`, `tooltip` inherit it through `popover`.

### 3. Tag delimiter matching fix

- **Read on main:** `packages/ariakit-react-components/src/tag/utils.ts`
  (`matchDelimiter`: string delimiters matched with `indexOf`, zero-length
  regex matches skipped) and `tag/utils.test.ts` (85 lines of cases to mirror).
- **Write:** `packages/ux/src/tag/tagIntent.ts` `splitTagValue` — replace the
  "match as regex, split literally" quirk (currently documented as
  intentionally Ariakit-compatible; Ariakit has since fixed it). Also mirror
  the react 0.1.2 IME fix: composition text must not be split into tags before
  the user commits (`packages/ux/src/tag/reatomTag.ts` composition handling
  exists — verify against main's `tag-input.tsx`).

### 4. Disclosure animation end-time fix

- **Read on main:**
  `packages/ariakit-react-components/src/disclosure/disclosure-content.tsx`
  (react 0.2.0 entry "over-waiting to unmount with mixed transitions and
  animations": longest per-property `delay + duration`, ignore leftover
  durations with no matching animation-name/transition-property).
- **Write:** `packages/ux/src/disclosure/reatomDisclosureDom.ts`
  `getAnimationTimeout` — currently longest delay + longest duration summed
  across properties, the exact overestimate main fixed.

### 5. Dialog scroll lock via `scrollbar-gutter`

- **Read on main:**
  `packages/ariakit-react-components/src/dialog/utils/use-prevent-body-scroll.ts`
  (188 lines: `scrollbar-gutter: stable` + `overflow: hidden` on `html` in
  supporting browsers, old body-padding technique as fallback, inline-style
  restore on close).
- **Write:** `packages/ux/src/dialog/dialogDom.ts` `lockBodyScroll` (currently
  the pre-0.3.2 body-padding approach). Browser test tier.

### 6. Dialog Esc containment contract

- **Read on main:** the Esc handling in
  `packages/ariakit-react-components/src/dialog/dialog.tsx` (react 0.3.4
  "Handling Esc in nested widgets": a descendant calling
  `event.stopPropagation()` keeps the dialog open; the dialog stops a handled
  Esc at its own boundary / at `document` before `window`).
- **Write:** `packages/ux/src/dialog/reatomDialogDom.ts` +
  `dialogIntent.ts` — the intent mapper should refuse an Esc whose propagation
  was stopped below the dialog, and the Layer 2 handler should stop the event
  once handled. Extends to `popover`, `menu`, `select`, `combobox` for free.
  Browser test: nested non-Ariakit widget consumes Esc, dialog stays open.

### 7. Changelog-driven fix sweep over ported features

**Done** — the outcome per entry, with the fix and the test that proves it, is
[`MAIN_SWEEP_NOTES.md`](./MAIN_SWEEP_NOTES.md).

One reviewing agent, one pass, changelog as the spec. For each entry below,
reproduce against our model in the matching test tier; fix only where we fail:

- **combobox** — Korean IME + `autoSelect` focus between composition steps
  (0.3.2); decomposed-Unicode inline completion producing misspelled values
  (0.3.0 — our `comboboxValue.ts` normalizes NFD for _matching_, check the
  _completion_ path); Ctrl/Cmd non-paste shortcuts on items without virtual
  focus (0.3.0). Sources: `combobox.tsx`, `combobox-item.tsx` on main.
- **command** — stuck `data-active` when focus is lost mid-press, Space keyup
  bubbling from a child, Space released while Meta held, disabled between
  keydown and keyup (0.2.0 + 0.3.1). Source: `command.tsx` (270 lines) vs
  `packages/ux/src/command/props.ts` / `mapActivationIntent.ts`.
- **select** — arrow keys freezing on consecutive valueless items and
  `focusLoop` wrap over them (0.3.1 area); typeahead updating value while
  options are unmounted (components 0.1.8 collection `item()` controlled-item
  fallback — check `packages/ux/src/collection` lookup covers config-provided
  items that never registered an element).
- **hovercard / tooltip** — nested hovercards: Esc closes the topmost card
  even when focus is elsewhere (0.3.0); stays open when hovering content in an
  open shadow root (0.3.0). Sources: `hovercard.tsx`, `__hovercard-trigger.tsx`
  (main refactored anchor/tooltip-anchor into a shared trigger; behavior parity
  only, our models already share via `hovercard`).
- **focusable** — clear focus-visible styling when `focusable` becomes false
  (0.3.2); password-manager synthetic keydown cases already covered.
- **radio** — tabbing back into a group focuses the _checked_ radio after an
  unchecked one had focus (0.1.2); group `disabled` cascade (0.3.4 — ux has a
  group-level `disabled`, verify the per-item computed matches).
- **dialog** — `getPersistentElements` across open shadow roots (0.3.4);
  sibling modals opened in the same render making each other inert (0.3.4);
  stale nested-dialog cleanup restoring page state while a newer effect is
  active (0.2.0); reopen resetting outside-interaction focus tracking (0.2.0).
- **tab** — restore-then-change in one batch must still sync `activeId`
  (store `pendingRestore` fix; our explicit restore action should be immune —
  add the regression test); controlled `selectedId` update while a tab has DOM
  focus moves focus (0.1.2).

## Skip list (explicit, with reasons)

- **All store perf work on main** — collection id caches, composite fast-path
  scans, disclosure zero-parent path, the 49× `@ariakit/store` release:
  workarounds for flat-store O(n) scans and listener fan-out. Atomization +
  `reatomLinkedList` are the fix; nothing to port.
- **`form`** (all store and hook changes) — `@reatom/core` owns forms; already
  a deliberate skip in `PORTING_STATUS.md`.
- **View-only components** — `button`, `role`, `group`, `heading` /
  `heading-level`, `separator`, `visually-hidden` (+ `getVisuallyHiddenStyle`),
  `portal`, `checkbox-check`, `select-item-selected`, `select-value`,
  `combobox-item-value` highlight rendering, arrow SVG components
  (`popover-arrow`, `menu-arrow`, …), provider/context files: Bucket C, no
  model logic.
- **Anchor _components_** (`PopoverAnchor`, `MenuAnchor`, `SelectAnchor`,
  `ComboboxAnchor`) — trivial ref wrappers; the store-level precedence sync is
  shortlist item 2, the components themselves are prop records we already
  have.
- **`composite-input`** — deprecated on main; caret-edge guard already lives in
  `packages/ux/src/composite/navigationIntent.ts`.
- **`composite-hover`** — already ported into `menu` and `combobox` prop
  records; no third consumer yet, so no shared interaction module.
- **`focus-trap` / `focus-trap-region` as standalone exports** — the sentinel
  policy is ported inside `dialog` (`dialogIntent.ts`, `props.ts`); a
  standalone module would duplicate it without a consumer.
- **`menu-bar`** — still just the deprecated alias on main.
- **React-specific machinery** — `useStoreState` keyed subscriptions,
  React-Compiler form hooks, `"use client"` sourcemaps, StrictMode portal
  fixes, React 19 ref-cleanup semantics: framework-binding concerns Reatom
  does not have.

## Later (tracked, not scheduled)

1. **`composite-container`** (`composite/composite-container.tsx`, 298 lines) —
   focus into/out of interactive widgets embedded in composite cells; real
   policy logic, niche use case. Suggested home when needed:
   `packages/ux/src/composite/containerIntent.ts` + Layer 2 behavior.
2. **`UndoManager`** (`ariakit-utils/src/undo.ts`, 90 lines + 91 test lines) —
   new framework-agnostic undo/redo stacks with action grouping; not yet
   consumed by any Ariakit component. If Reatom adopts the idea it should be a
   `@reatom/core` primitive (nothing equivalent exists there today), not a ux
   port.
3. **Virtualized renderers** (`collection-renderer.tsx` 1214 lines +
   composite/select layers) — the changelogs show this area is still churning
   (scroll-element prop, ResizeObserver leaks, aria-setsize fixes). Reatom
   consumers can virtualize with their own tooling against `reatomCollection`;
   revisit only if a concrete consumer asks.
