# `collection` review

## TL;DR

Seven findings: 0 Critical, 4 High, 2 Medium, 1 Low. All seven are fixed. The required unit/type suite and the Chromium collection suite pass.

- [High] `src/collection/reatomCollection.ts: unrenderItem`: An unmatched `unrenderItem` decremented `registrations` and could remove an item that had only been registered.
  Why it matters: render and registration reference counts represent different ownership; consuming a registration without a render loses live collection state.
  Fix: Return `false` before changing either counter when `renders()` is zero, with a regression test.

- [High] `src/collection/reatomCollection.ts: generated id seed`: The closure-local seed was shared by every Reatom context, so identical registration order in separate SSR contexts produced different ids.
  Why it matters: `context.start` isolates request state, but a non-reactive closure does not reset with the context; this can produce server/client hydration id mismatches.
  Fix: Store the seed in a named `_idSeed` atom and verify two isolated contexts both generate `ssr-1`, `ssr-2`.

- [High] `src/collection/reatomCollection.ts: generated ids`: Generated ids could collide with an explicit id such as `generated-1`, leaving two linked-list nodes with one map key.
  Why it matters: `ids()` then contains duplicates while `item(id)` resolves only one node, breaking collection identity and removal.
  Fix: Reserve initial explicit ids and probe the keyed map before accepting each generated id.

- [High] `src/collection/reatomCollectionDom.ts: sortBasedOnDomPosition`: Returning comparator equality whenever either element was missing could prevent valid elements on opposite sides of that item from ever being compared.
  Why it matters: a rendered placeholder without an element could leave keyboard/navigation order different from DOM order.
  Fix: Sort missing elements after present elements while preserving their relative order; cover the barrier case in Chromium.

- [Medium] `src/collection/reatomCollection.ts: item id validation`: Empty ids and duplicate explicit ids in `items` could create nodes that `item()` could not address uniquely.
  Why it matters: the linked-list key map requires a non-empty unique identity, while `item('')` intentionally returns `null`.
  Fix: Reject empty ids and duplicate initial explicit ids with clear errors and document the contract.

- [Medium] `src/collection/reatomCollection.ts: create option`: `Object.assign` allowed extra state to replace `id`, `name`, counters, or other base fields despite the documented prohibition.
  Why it matters: shadowing base item identity or atoms corrupts collection invariants at runtime.
  Fix: Reject colliding extra keys before assignment, with a regression test.

- [Low] `src/collection/reatomCollectionDom.ts: single-use helpers`: Three one-call helpers added declarations and call indirection without reuse.
  Why it matters: this is avoidable code in a package intended for UI hot paths and broad reuse.
  Fix: Inline the DOM-position check, common-root scan, and next-frame promise.

## Bundle-size and residual notes

- No runtime export in `src/collection` is demonstrably dead: `sortBasedOnDomPosition` and `applyDomOrder` are used internally and are also exposed by the package barrel. Removing either requires an explicit public-API decision outside this review scope.
- Residual risk is limited to browser-specific `compareDocumentPosition` and `IntersectionObserver` behavior for disconnected/portaled trees; the current browser suite exercises Chromium only.
