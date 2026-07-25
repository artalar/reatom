import { expect, test } from 'vitest'

import {
  canShowComboboxList,
  hasComboboxModifier,
  isComboboxEnterBlocked,
  isComboboxPasteShortcut,
  isComboboxPrimaryPress,
  isComboboxShowKey,
  isComboboxTypeaheadKey,
} from './comboboxIntent'
import {
  canComboboxInline,
  comboboxCompletionValue,
  comboboxInputValue,
  hasComboboxCompletion,
  isComboboxAutoCompleteInline,
  isComboboxItemSelected,
  isComboboxMultiSelectable,
  nextComboboxSelectedValue,
} from './comboboxValue'

/**
 * The value matrix and the key/pointer policy, over plain data. Ariakit keeps
 * every one of these inside a component body, where the only way to exercise
 * them is to render a widget and type into it; the model-level consequences are
 * in `combobox.test.ts` and the real-DOM ones in `combobox.test.browser.ts`.
 */

// --- the selection ----------------------------------------------------------

test('the shape of the selected value is the selection mode', () => {
  expect(isComboboxMultiSelectable('')).toBe(false)
  expect(isComboboxMultiSelectable('Apple')).toBe(false)
  expect(isComboboxMultiSelectable([])).toBe(true)
  expect(isComboboxMultiSelectable(['Apple'])).toBe(true)
})

test('isComboboxItemSelected answers "not selectable" with undefined', () => {
  expect(isComboboxItemSelected('Apple', 'Apple')).toBe(true)
  expect(isComboboxItemSelected('Apple', 'Orange')).toBe(false)
  expect(isComboboxItemSelected(['Apple', 'Orange'], 'Orange')).toBe(true)
  expect(isComboboxItemSelected(['Apple'], 'Orange')).toBe(false)

  // an item with no value is not selectable at all, which is why it emits no
  // `aria-selected` attribute — Ariakit returns `undefined` for the same reason
  expect(isComboboxItemSelected('Apple')).toBe(undefined)
  expect(isComboboxItemSelected([])).toBe(undefined)

  // …and the empty string is a value like any other: an unset single selection
  expect(isComboboxItemSelected('', '')).toBe(true)
})

test('nextComboboxSelectedValue replaces a string and toggles an array', () => {
  expect(nextComboboxSelectedValue('Apple', 'Orange')).toBe('Orange')
  expect(nextComboboxSelectedValue('Apple', 'Apple')).toBe('Apple')

  expect(nextComboboxSelectedValue([], 'Apple')).toEqual(['Apple'])
  // appended at the end, so the selection order is the click order — which is
  // what a tag list renders
  expect(nextComboboxSelectedValue(['Apple'], 'Orange')).toEqual([
    'Apple',
    'Orange',
  ])
  expect(nextComboboxSelectedValue(['Apple', 'Orange'], 'Apple')).toEqual([
    'Orange',
  ])
})

test('an array selection is always a new array, so the write is a change', () => {
  const selected = ['Apple']
  const next = nextComboboxSelectedValue(selected, 'Orange')

  expect(next).not.toBe(selected)
  expect(selected).toEqual(['Apple'])
})

// --- the completion string --------------------------------------------------

test('only `inline` and `both` complete the value inline', () => {
  expect(isComboboxAutoCompleteInline('inline')).toBe(true)
  expect(isComboboxAutoCompleteInline('both')).toBe(true)
  expect(isComboboxAutoCompleteInline('list')).toBe(false)
  expect(isComboboxAutoCompleteInline('none')).toBe(false)
})

test('a completion string is a case- and diacritics-insensitive suffix', () => {
  expect(hasComboboxCompletion('ap', 'Apple')).toBe(true)
  expect(hasComboboxCompletion('AP', 'Apple')).toBe(true)
  // nothing left to complete
  expect(hasComboboxCompletion('apple', 'Apple')).toBe(false)
  // not a prefix
  expect(hasComboboxCompletion('ple', 'Apple')).toBe(false)

  // the diacritics are stripped on the typed side only, which is Ariakit's own
  // asymmetry: an accent the user typed is not required of the item…
  expect(hasComboboxCompletion('café', 'Cafe Latte')).toBe(true)
  expect(comboboxCompletionValue('café', 'Cafe Latte')).toBe('café Latte')
  // …while an accent in the item is required of the user
  expect(hasComboboxCompletion('cafe', 'Café')).toBe(false)
  expect(hasComboboxCompletion('caf', 'Café')).toBe(true)

  // no active value, or nothing typed
  expect(hasComboboxCompletion('ap')).toBe(false)
  expect(hasComboboxCompletion('ap', '')).toBe(false)
  expect(hasComboboxCompletion('', 'Apple')).toBe(true)
})

test('the completion keeps the characters the user pressed', () => {
  // 'ap' + 'ple', not 'Apple': the prefix must not change under their caret
  expect(comboboxCompletionValue('ap', 'Apple')).toBe('apple')
  expect(comboboxCompletionValue('AP', 'Apple')).toBe('APple')
  expect(comboboxCompletionValue('ap', 'Banana')).toBe(undefined)
  expect(comboboxCompletionValue('apple', 'Apple')).toBe(undefined)
})

// react-components 0.3.0: "Fixed `Combobox` inline autocomplete so decomposed
// Unicode input no longer produces misspelled completion values." A dead key and
// most IMEs insert an accented letter as two code units — the base letter plus a
// combining mark — so the typed value is longer than the prefix it matches in the
// item, and cutting the item by the typed length eats a character of it.
test('a decomposed accent does not eat a character of the completion', () => {
  const decomposed = 'cafe\u0301'

  expect(decomposed.normalize('NFC')).toBe('café')
  expect(decomposed).toHaveLength(5)
  expect(hasComboboxCompletion(decomposed, 'Cafe Latte')).toBe(true)

  // 'cafe' + ' Latte', never 'cafe' + 'Latte'
  expect(comboboxCompletionValue(decomposed, 'Cafe Latte')).toBe(
    `${decomposed} Latte`,
  )
  expect(comboboxCompletionValue(decomposed, 'Cafeteria')).toBe(
    `${decomposed}teria`,
  )
  // the composed form of the same word is one code unit per character, so it
  // matched the item length all along
  expect(comboboxCompletionValue('café', 'Cafe Latte')).toBe('café Latte')

  expect(
    comboboxInputValue({
      value: decomposed,
      activeValue: 'Cafe Latte',
      inline: true,
      autoSelected: true,
    }),
  ).toBe(`${decomposed} Latte`)
})

// --- the displayed value ----------------------------------------------------

test('the displayed value is the typed one unless a completion applies', () => {
  const active = { value: 'ap', activeValue: 'Apple' }

  // `list` mode, i.e. the inline completion is off
  expect(comboboxInputValue(active)).toBe('ap')
  // …and on, which replaces the value outright
  expect(comboboxInputValue({ ...active, inline: true })).toBe('Apple')
  // the auto-selected first item only appends its tail
  expect(
    comboboxInputValue({ ...active, inline: true, autoSelected: true }),
  ).toBe('apple')
  // an auto-selected item that does not continue the typing changes nothing
  expect(
    comboboxInputValue({
      value: 'ba',
      activeValue: 'Apple',
      inline: true,
      autoSelected: true,
    }),
  ).toBe('ba')

  // nothing is active, so there is nothing to complete
  expect(comboboxInputValue({ value: 'ap', inline: true })).toBe('ap')
})

test('an already selected value is never inlined', () => {
  // picking it again would *de*select it, so promising it as a completion would
  // be the opposite of what Enter does
  expect(
    comboboxInputValue({
      value: 'ap',
      activeValue: 'Apple',
      inline: true,
      selectedValue: ['Apple'],
    }),
  ).toBe('ap')

  // …only for a multi-selectable combobox: on a single-selectable one picking
  // the selected value is a no-op, not a deselection
  expect(
    comboboxInputValue({
      value: 'ap',
      activeValue: 'Apple',
      inline: true,
      selectedValue: 'Apple',
    }),
  ).toBe('Apple')
})

test('only an insertion at the end of the value may be completed', () => {
  const typing = { inputType: 'insertText', value: 'ap' }

  expect(canComboboxInline({ ...typing, selectionStart: 2 })).toBe(true)
  // completing text before the caret would fight the editing
  expect(canComboboxInline({ ...typing, selectionStart: 1 })).toBe(false)
  // …and a field with no selection API reports `null`, which is not the end
  expect(canComboboxInline({ ...typing, selectionStart: null })).toBe(false)
  expect(canComboboxInline(typing)).toBe(false)

  // a deletion is never completed: the user is removing characters
  expect(
    canComboboxInline({
      inputType: 'deleteContentBackward',
      value: 'a',
      selectionStart: 1,
    }),
  ).toBe(false)
  // an IME insertion is, which is what makes the completion work for one
  expect(
    canComboboxInline({
      inputType: 'insertCompositionText',
      value: 'ap',
      selectionStart: 2,
    }),
  ).toBe(true)
  // a synthetic or programmatic write carries no `inputType`
  expect(canComboboxInline({ value: 'ap', selectionStart: 2 })).toBe(false)
})

// --- the key policy ---------------------------------------------------------

test('every modifier but none blocks opening the list', () => {
  expect(hasComboboxModifier({ key: 'ArrowDown' })).toBe(false)

  for (const modifier of ['ctrlKey', 'altKey', 'shiftKey', 'metaKey']) {
    // `Shift` is in the list because `Shift+ArrowDown` extends a text selection
    expect(hasComboboxModifier({ key: 'ArrowDown', [modifier]: true })).toBe(
      true,
    )
    expect(isComboboxShowKey({ key: 'ArrowDown', [modifier]: true })).toBe(
      false,
    )
  }

  expect(isComboboxShowKey({ key: 'ArrowDown' })).toBe(true)
  expect(isComboboxShowKey({ key: 'ArrowUp' })).toBe(true)
  expect(isComboboxShowKey({ key: 'ArrowLeft' })).toBe(false)
  expect(isComboboxShowKey({ key: 'Home' })).toBe(false)
  expect(isComboboxShowKey({ key: 'a' })).toBe(false)
})

test('Enter is swallowed while the list is open, whatever is held', () => {
  expect(isComboboxEnterBlocked({ key: 'Enter' }, true)).toBe(true)
  expect(isComboboxEnterBlocked({ key: 'Enter', metaKey: true }, true)).toBe(
    true,
  )
  // closed, Enter belongs to the enclosing form — which is what a search
  // combobox needs
  expect(isComboboxEnterBlocked({ key: 'Enter' }, false)).toBe(false)
  expect(isComboboxEnterBlocked({ key: 'Escape' }, true)).toBe(false)
})

test('a printable key on an item is typing, a shortcut is not', () => {
  expect(isComboboxTypeaheadKey({ key: 'a' })).toBe(true)
  // a capital letter has to reach the input
  expect(isComboboxTypeaheadKey({ key: 'A', shiftKey: true })).toBe(true)
  expect(isComboboxTypeaheadKey({ key: ' ' })).toBe(true)
  expect(isComboboxTypeaheadKey({ key: 'Backspace' })).toBe(true)
  expect(isComboboxTypeaheadKey({ key: 'Delete' })).toBe(true)

  // Ariakit's own condition matches these too, which would break copying from
  // an item and select-all
  expect(isComboboxTypeaheadKey({ key: 'c', ctrlKey: true })).toBe(false)
  expect(isComboboxTypeaheadKey({ key: 'a', metaKey: true })).toBe(false)
  expect(isComboboxTypeaheadKey({ key: 'a', altKey: true })).toBe(false)

  expect(isComboboxTypeaheadKey({ key: 'ArrowDown' })).toBe(false)
  expect(isComboboxTypeaheadKey({ key: 'Enter' })).toBe(false)
  expect(isComboboxTypeaheadKey({ key: 'Escape' })).toBe(false)
})

// react-components 0.3.0: "non-paste Ctrl/Cmd character shortcuts preserve focus
// and the combobox value when virtual focus is disabled, while paste shortcuts
// still route to the input" — the text of a paste has to land in the field, so
// this one shortcut still moves focus there.
test('the paste shortcut on an item is typing, unlike every other shortcut', () => {
  expect(isComboboxPasteShortcut({ key: 'v', ctrlKey: true })).toBe(true)
  expect(isComboboxPasteShortcut({ key: 'v', metaKey: true })).toBe(true)
  expect(isComboboxPasteShortcut({ key: 'V', metaKey: true })).toBe(true)
  // `Cmd+Shift+V` pastes without formatting, still a paste
  expect(
    isComboboxPasteShortcut({ key: 'v', metaKey: true, shiftKey: true }),
  ).toBe(true)
  // plain typing, and the platform shortcuts built on the same letter
  expect(isComboboxPasteShortcut({ key: 'v' })).toBe(false)
  expect(isComboboxPasteShortcut({ key: 'v', altKey: true })).toBe(false)
  expect(
    isComboboxPasteShortcut({ key: 'v', ctrlKey: true, altKey: true }),
  ).toBe(false)
  expect(isComboboxPasteShortcut({ key: 'c', ctrlKey: true })).toBe(false)

  expect(isComboboxTypeaheadKey({ key: 'v', metaKey: true })).toBe(true)
  expect(isComboboxTypeaheadKey({ key: 'v', ctrlKey: true })).toBe(true)
  expect(isComboboxTypeaheadKey({ key: 'v', ctrlKey: true, altKey: true })).toBe(
    false,
  )
})

// --- the pointer policy -----------------------------------------------------

test('only a primary press without Ctrl counts as clicking the field', () => {
  expect(isComboboxPrimaryPress({ button: 0 })).toBe(true)
  expect(isComboboxPrimaryPress({})).toBe(true)
  // a secondary button opens a context menu…
  expect(isComboboxPrimaryPress({ button: 2 })).toBe(false)
  expect(isComboboxPrimaryPress({ button: 1 })).toBe(false)
  // …and `Ctrl+click` is a right click on macOS
  expect(isComboboxPrimaryPress({ button: 0, ctrlKey: true })).toBe(false)
})

test('showMinLength is measured against the element value', () => {
  expect(canShowComboboxList('')).toBe(true)
  expect(canShowComboboxList('', 0)).toBe(true)
  expect(canShowComboboxList('', 1)).toBe(false)
  expect(canShowComboboxList('a', 1)).toBe(true)
  expect(canShowComboboxList('ap', 1)).toBe(true)
})
