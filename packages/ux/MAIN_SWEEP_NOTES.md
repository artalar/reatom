# `@reatom/ux` — changelog-driven fix sweep

The pass asked for by [`MAIN_GAP_ANALYSIS.md`](./MAIN_GAP_ANALYSIS.md) §7: every
bug class Ariakit documented between `@ariakit/react-components` 0.1.2–0.3.4 and
`@ariakit/components` 0.1.2–0.1.8 that touches a ported feature, reproduced
against our model in the matching test tier.

Each entry is **fixed** (our port was wrong; the regression test fails without
the fix), **already ok** (the contract held; a test now pins it), or **n/a** (the
bug follows from an Ariakit implementation detail this port does not have).

Each fix landed as its own commit, and each test lives next to the code it
covers — node tier unless the behavior only exists in a document.

## Fixed

- **`command` — stuck `data-active`** (0.2.0 + 0.3.1). Space released while Meta
  is held, a keyup a child sent, a keyup on a disabled or default-prevented
  press, and focus lost mid-press all left the element looking pressed.
  `mapKeyUpIntent` now clears `pressed` and `active` before every guard, and
  `CommandModel.cancel` — bound through the new `onBlur` of the element record —
  ends a press that focus walked away from. Tests: `command.test.ts` "a keyup a
  consumer already handled releases the press" and its meta / disabled / child
  siblings, `command.test.browser.ts` "focus leaving the element mid-press clears
  data-active".
- **`focusable` — a focus ring that outlives its reason** (0.3.2).
  `data-focus-visible` survived `focusable` turning off, and landed at all when
  the element was disabled between the key press and the frame the ring is
  written on. `applyFocusVisible` re-checks both after its wait, and a
  `focusVisibleCleanup` effect removes the attribute when either turns false.
  Tests: `focusable.test.browser.ts` "turning focusable off removes the ring
  marker from the element", "disabling a focused element removes the ring marker
  too", "the ring never lands when focusable is turned off mid-flight".
- **`radio` — tabbing back into a group** (0.1.2). Focus returned to the last
  visited radio instead of the checked one. `RadioUnits.activateChecked`, called
  from the group's `onBlur` when focus leaves the group, hands the tab stop back.
  Tests: `radio.test.ts` "tabbing back into the group lands on the checked
  radio", `radio.test.browser.ts` "leaving the group gives the tab stop back to
  the checked radio".
- **`tab` — a controlled selection stranding DOM focus** (0.1.2,
  [ariakit#4213](https://github.com/ariakit/ariakit/issues/4213)). The roving tab
  stop followed the selection, but focus stayed on a tab that was no longer
  tabbable, so the next arrow key started from the wrong place. New
  `withTabFocus()` (`reatomTabDom.ts`) turns such a selection into a
  `composite.move` when another tab holds focus. Tests: `tab.test.ts` "a
  controlled selection takes focus over from the tab that has it" and its
  siblings, `tab.test.browser.ts` "a controlled selection moves DOM focus off the
  tab that had it".
- **`combobox` — inline completion of decomposed Unicode** (0.3.0). A dead key
  and most IMEs insert `café` as `cafe` plus a combining mark, so the typed value
  is longer than the prefix it matched and cutting the item by the typed length
  ate a character of the completion. `comboboxCompletionValue` slices the item at
  the **normalized** prefix length instead. Test: `comboboxValue.test.ts` "a
  decomposed accent does not eat a character of the completion".
- **`combobox` — `Ctrl`/`Cmd` character shortcuts on an item** (0.3.0). The
  non-paste ones must stay on the item (a copy or a select-all must not move
  focus and overwrite the value), the paste must reach the input for the text to
  land in it. New `isComboboxPasteShortcut`, which `isComboboxTypeaheadKey` lets
  through. Test: `comboboxValue.test.ts` "the paste shortcut on an item is
  typing, unlike every other shortcut".
- **`dialog` — a stale restore undoing a newer one** (0.2.0). Two dialogs disable
  the same background element and close in whichever order the user picked; the
  restore of the one that closed first ran the whole stack, so the page became
  interactive again under the dialog still open. `orchestrate` is now Ariakit's
  disposed-entry stack: a restore below the top only marks its entry, and the
  marks unwind together. Tests: `dialog.test.ts` "a stale restore waits for the
  current owner of the key", "a restore in the middle of the stack is skipped
  over, not applied", plus "the restore stack of one key unwinds in order" and
  "every element and every key keeps its own stack" for the surrounding contract.
- **`dialog` — an interaction inside an open shadow root** (0.3.4). A listener on
  the document sees `event.target` retargeted to the shadow host, and the host is
  not part of the dialog, so a click on dialog content — or on a nested dialog, a
  disclosure, a focus-trap sentinel — inside a shadow root dismissed the dialog.
  New `getEventTargets` (port of Ariakit's, minus its iframe chain), and every
  "inside" check of the interact-outside listeners scans the composed path. Test:
  `dialog.test.browser.ts` "a click inside a shadow root of the dialog does not
  close it".

## Already ok

- **`combobox` — `autoSelect` across IME composition steps** (0.3.2). Ariakit
  re-arms its `canAutoSelectRef` from an effect on the value as well, so every
  composition step armed the auto-select again and moved the active item while a
  Korean syllable was still being composed. Here the input handler is the only
  writer of `canAutoSelect`, so a composition step can only ever clear it, and
  `onCompositionEnd` is what arms it. Test: `combobox.test.ts` "a composition
  step does not move the active item, the end of one does" — it fails when the
  composing guard of `onInput` is removed.
- **`select` — arrow keys over valueless items** (0.3.1 area). The value-aware
  walk marks valueless items disabled in the internal collection, so navigation
  skips a run of them and `focusLoop` wraps past them. Tests: `select.test.ts`
  "navigation skips a run of items that have no value", "the value-aware walk
  wraps over valueless items with focusLoop", "a list of nothing but valueless
  items goes nowhere".
- **`select` — typeahead while options are unmounted** (components 0.1.8
  collection `item()` fallback). `reatomCollection.item()` resolves an item that
  was configured but never rendered an element. Test: `select.test.ts` "an item
  that never mounted is still addressable and selectable".
- **`hovercard` — nested cards and Escape** (0.3.0). `topmost` is a derivation of
  the declared stack and the `open` atoms rather than a DOM marker, so it does
  not depend on where focus is. Test: `hovercard.test.browser.ts` "Escape closes
  the topmost nested card, wherever focus is".
- **`hovercard` — content inside an open shadow root** (0.3.0). The pointer
  listeners already read `composedPath()[0]` rather than `event.target`. Test:
  `hovercard.test.browser.ts` "the pointer on a card inside an open shadow root
  keeps it open".
- **`radio` — the group `disabled` cascade** (0.3.4). A radio's `disabled` is a
  computed of its own flag and the group's. Test: `radio.test.ts` "a disabled
  group disables every radio in it".
- **`tab` — restore-then-change in one batch** (the store `pendingRestore` fix).
  The restore writes `selectedId` and the composite `activeId` together, so there
  is no suppression flag to leak into the next selection. Test: `tab.test.ts` "a
  restore that changes nothing still lets the next selection move the tab stop".
- **`dialog` — reopen resets outside-interaction tracking** (0.2.0).
  `dismissIntent`, which `interactedOutside` derives from, resets to `null` as
  part of its own derivation whenever `open` turns true. Test: `dialog.test.ts`
  "the dismiss intent resets when the dialog opens again".

## N/A for this architecture

- **`dialog` — sibling modals opened in the same render making each other inert**
  (0.3.4). Ariakit has to _infer_ the relation between two modal dialogs from the
  order their default portal nodes were created: its fix keeps a module-level set
  of open modal portals and lets each opening dialog treat the ones that opened
  after it as peers (`dialog.tsx`, `openModalPortals` /
  `getLaterOpenModalPortals`). This port owns no portal — the view decides where
  the dialog element goes — and the relation between two dialogs is declared
  (`reatomDialog({ parent })`), so `withDialogModal` keeps
  `[content, backdrop, ...nestedDialogs]` interactive by structure. Which of two
  modals traps the page therefore cannot depend on the order they opened in, and
  two dialogs that are unrelated on purpose stay unrelated to the walk. Pinned by
  `dialog.test.browser.ts` "the declared stack, not the open order, decides which
  modal traps".
- **`dialog` — `getPersistentElements` as a prop.** The option itself is not
  ported: `disableTreeOutside` takes the elements to keep as an argument, so a
  consumer that has persistent elements passes them. The shadow-root half of that
  0.3.4 entry _is_ ported, because it is the interact-outside contract rather
  than the option — see the fix list.
- **Store perf work, `form`, view-only components, React-specific machinery.**
  Already argued in `MAIN_GAP_ANALYSIS.md` "Skip list"; nothing in the changelog
  range changes that reasoning.

## Deferred

Nothing from §7. Three neighbouring items are owned by other agents on the same
branch and deliberately untouched here: the dialog scroll lock via
`scrollbar-gutter` (§5), the dialog Escape containment contract (§6), and the
popover/combobox anchor-precedence sync (§2).

## How to re-run

```sh
cd packages/ux
pnpm test:unit    # 1077 tests, every node-tier case above included
pnpm test:browser # 162 tests, every browser-tier case above included
pnpm typecheck
```
