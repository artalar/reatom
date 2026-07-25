import { expect, test } from 'vitest'

import {
  addTagValue,
  canTagInputNavigate,
  cleanTagValues,
  getTagDelimiters,
  isTagPasteShortcut,
  isTagPrintableKey,
  isTagRemoveLastKey,
  mapTagChangeIntent,
  mapTagKeyIntent,
  parseTagValues,
  removeTagValue,
  splitTagValue,
  TAG_DELIMITERS,
} from './tagIntent'

/**
 * The delimiter matrix and the caret guards, over plain data. Ariakit can only
 * exercise these by typing into a rendered input; the model-level consequences
 * are in `tag.test.ts` and the real-caret ones in `tag.test.browser.ts`.
 */

// --- delimiters -------------------------------------------------------------

test('getTagDelimiters tells "not configured" from "never split"', () => {
  expect(getTagDelimiters(undefined)).toEqual(TAG_DELIMITERS)
  // a copy, so a caller can not mutate the library default
  expect(getTagDelimiters(undefined)).not.toBe(TAG_DELIMITERS)

  expect(getTagDelimiters(',')).toEqual([','])
  expect(getTagDelimiters(/[,;]/)).toEqual([/[,;]/])
  expect(getTagDelimiters([',', /\s/])).toEqual([',', /\s/])

  // both spellings of "never split"
  expect(getTagDelimiters(null)).toEqual([])
  expect(getTagDelimiters([])).toEqual([])

  // `undefined` falls back, `null` does not — which is how a component default
  // can differ from the library default
  expect(getTagDelimiters(undefined, ';')).toEqual([';'])
  expect(getTagDelimiters(null, ';')).toEqual([])
})

test('splitTagValue splits by the first matching delimiter only', () => {
  expect(splitTagValue('a,b', [','])).toEqual(['a', 'b'])

  // Ariakit's documented rule: `['\n', ',']` over text with both keeps the
  // commas inside the values
  expect(splitTagValue('a,b\nc,d', ['\n', ','])).toEqual(['a,b', 'c,d'])
  expect(splitTagValue('a;b,c', TAG_DELIMITERS)).toEqual(['a', 'b,c'])
  expect(splitTagValue('a b', TAG_DELIMITERS)).toEqual(['a', 'b'])
})

test('splitTagValue reports "nothing to split" as an empty array', () => {
  // and not as `[value]`, which is what lets a partially typed tag be left alone
  expect(splitTagValue('react', [','])).toEqual([])
  expect(splitTagValue('a b', [','])).toEqual([])
  expect(splitTagValue('', TAG_DELIMITERS)).toEqual([])
  // no delimiter configured at all
  expect(splitTagValue('a,b', [])).toEqual([])
})

test('splitTagValue strips leading delimiters instead of emitting empty values', () => {
  // which is what keeps ', tag' from adding a tag before the user typed one
  expect(splitTagValue(',a,b', [','])).toEqual(['a', 'b'])
  expect(splitTagValue(',,a,b', [','])).toEqual(['a', 'b'])

  // the stripping happens before the "does it match at all" check, so a value
  // whose only delimiters are leading ones has nothing to split
  expect(splitTagValue(',,a', [','])).toEqual([])
  expect(splitTagValue(',,', [','])).toEqual([])
})

test('a string delimiter is matched literally, metacharacters and all', () => {
  // `'.'` is split literally, so it has to be matched literally too — Ariakit's
  // own `matchDelimiter` fix (`tag/utils.ts`)
  expect(splitTagValue('a.b', ['.'])).toEqual(['a', 'b'])
  expect(splitTagValue('a.b', [/\./])).toEqual(['a', 'b'])

  // the cases Ariakit's `utils.test.ts` mirrors, including the leading strip
  expect(splitTagValue('.one.two.', ['.'])).toEqual(['one', 'two', ''])
  expect(splitTagValue('+one+two+', ['+'])).toEqual(['one', 'two', ''])
  expect(splitTagValue('|one|two|', ['|'])).toEqual(['one', 'two', ''])

  // a value a literal delimiter does not occur in has nothing to split, even
  // when it would have matched as a pattern
  expect(splitTagValue('abc', ['.'])).toEqual([])
  expect(splitTagValue('abc', ['a|b'])).toEqual([])
  // …and one that does occur splits on the whole string
  expect(splitTagValue('one::two', ['::'])).toEqual(['one', 'two'])
})

test('splitTagValue never loops on a zero-length regex match', () => {
  // `/x*/` matches the empty string at offset 0 of every value, which the
  // leading-delimiter strip has to ignore — Ariakit's "so patterns like /x*/
  // don't loop forever"
  expect(splitTagValue('abc', [/x*/])).toEqual(['a', 'b', 'c'])
  expect(splitTagValue('axbc', [/x*/])).toEqual(['a', 'b', 'c'])
})

test('a regex delimiter keeps its own split semantics', () => {
  // a capturing group emits the separators, as `String.split` does
  expect(splitTagValue('one,two;three', [/([,;])/])).toEqual([
    'one',
    ',',
    'two',
    ';',
    'three',
  ])

  // a global regex reports no `index`, so nothing is stripped and the leading
  // empty value survives — the behavior of Ariakit's `matchDelimiter`
  expect(splitTagValue(',one,two', [/,/g])).toEqual(['', 'one', 'two'])
  expect(splitTagValue(',one,two', [/,/])).toEqual(['one', 'two'])
})

test('the first delimiter that matches wins, whatever its kind', () => {
  expect(splitTagValue('one,two three', [/\s/, ','])).toEqual([
    'one,two',
    'three',
  ])
  expect(splitTagValue('one,two', [/\s/, ','])).toEqual(['one', 'two'])
})

test('cleanTagValues trims and drops the empty values', () => {
  expect(cleanTagValues([' react ', '', '  ', 'jsx'])).toEqual(['react', 'jsx'])
  expect(cleanTagValues([])).toEqual([])
})

test('parseTagValues turns pasted text into tags', () => {
  expect(parseTagValues('  react, jsx  ')).toEqual(['react', 'jsx'])
  expect(parseTagValues('react\njsx\n')).toEqual(['react', 'jsx'])
  // the first matching delimiter wins, so the comma survives inside a value
  expect(parseTagValues('a;b,c')).toEqual(['a', 'b,c'])

  // an empty result means "this is a plain text paste", so the default is kept
  expect(parseTagValues('react jsx', ',')).toEqual([])
  expect(parseTagValues('react')).toEqual([])
  expect(parseTagValues('react,jsx', null)).toEqual([])
  expect(parseTagValues('   ')).toEqual([])
})

// --- typing -----------------------------------------------------------------

test('mapTagChangeIntent splits the value and keeps the trailing part typing', () => {
  expect(mapTagChangeIntent({ value: 'react,' })).toEqual({
    values: ['react'],
    value: '',
  })
  // only the added values are trimmed: the trailing one is still being typed
  expect(mapTagChangeIntent({ value: 'react, js' })).toEqual({
    values: ['react'],
    value: ' js',
  })
  expect(mapTagChangeIntent({ value: 'a,b,c' })).toEqual({
    values: ['a', 'b'],
    value: 'c',
  })
  expect(mapTagChangeIntent({ value: 'a;b', delimiter: ';' })).toEqual({
    values: ['a'],
    value: 'b',
  })
})

test('mapTagChangeIntent asks for nothing while a tag is still being typed', () => {
  expect(mapTagChangeIntent({ value: 'react' })).toBe(null)
  expect(mapTagChangeIntent({ value: '' })).toBe(null)
  expect(mapTagChangeIntent({ value: 'react,', delimiter: null })).toBe(null)
  // a value made of delimiters only adds nothing
  expect(mapTagChangeIntent({ value: ',,' })).toBe(null)
})

test('mapTagChangeIntent only splits while the caret is after the whole value', () => {
  // typing a comma in the middle of an existing tag edits the text
  expect(mapTagChangeIntent({ value: 'a,b', selectionStart: 1 })).toBe(null)
  // ... and so does replacing a selection
  expect(
    mapTagChangeIntent({ value: 'a,b', selectionStart: 0, selectionEnd: 3 }),
  ).toBe(null)

  expect(mapTagChangeIntent({ value: 'a,b', selectionStart: 3 })).toEqual({
    values: ['a'],
    value: 'b',
  })
})

test('a missing caret reads as the end of the value (Ariakit divergence)', () => {
  // Ariakit's `getTextboxSelection` answers 0 for an element with no selection
  // API, which silently disables splitting on an `<input type="email">`
  expect(
    mapTagChangeIntent({ value: 'a@b.com,', selectionStart: null }),
  ).toEqual({ values: ['a@b.com'], value: '' })
  // the Ariakit reading is one explicit offset away
  expect(mapTagChangeIntent({ value: 'a@b.com,', selectionStart: 0 })).toBe(
    null,
  )
})

// --- keys on a tag ----------------------------------------------------------

test('isTagPrintableKey is a single character with no modifier', () => {
  expect(isTagPrintableKey({ key: 'a' })).toBe(true)
  expect(isTagPrintableKey({ key: ' ' })).toBe(true)
  expect(isTagPrintableKey({ key: 'Backspace' })).toBe(false)
  expect(isTagPrintableKey({ key: 'a', ctrlKey: true })).toBe(false)
  expect(isTagPrintableKey({ key: 'a', metaKey: true })).toBe(false)
})

test('isTagPasteShortcut follows the platform modifier', () => {
  expect(isTagPasteShortcut({ key: 'v', ctrlKey: true })).toBe(true)
  expect(isTagPasteShortcut({ key: 'V', ctrlKey: true })).toBe(true)
  expect(isTagPasteShortcut({ key: 'v', metaKey: true }, true)).toBe(true)

  // the other platform's modifier is not the paste shortcut
  expect(isTagPasteShortcut({ key: 'v', metaKey: true })).toBe(false)
  expect(isTagPasteShortcut({ key: 'v', ctrlKey: true }, true)).toBe(false)
  expect(isTagPasteShortcut({ key: 'c', ctrlKey: true })).toBe(false)
})

test('mapTagKeyIntent removes backwards on Backspace and forwards on Delete', () => {
  expect(mapTagKeyIntent({ key: 'Backspace' })).toEqual({
    type: 'remove',
    move: 'previous',
  })
  expect(mapTagKeyIntent({ key: 'Delete' })).toEqual({
    type: 'remove',
    move: 'next',
  })

  expect(
    mapTagKeyIntent({ key: 'Backspace' }, { removeOnKeyPress: false }),
  ).toBe(null)
  expect(mapTagKeyIntent({ key: 'Delete' }, { removeOnKeyPress: false })).toBe(
    null,
  )
})

test('mapTagKeyIntent hands typing and pasting to the input', () => {
  expect(mapTagKeyIntent({ key: 'a' })).toEqual({ type: 'focusInput' })
  expect(mapTagKeyIntent({ key: 'v', ctrlKey: true })).toEqual({
    type: 'focusInput',
  })
  expect(mapTagKeyIntent({ key: 'v', metaKey: true }, { apple: true })).toEqual(
    {
      type: 'focusInput',
    },
  )

  // the widget's own keys, and keys that mean nothing here
  expect(mapTagKeyIntent({ key: 'ArrowLeft' })).toBe(null)
  expect(mapTagKeyIntent({ key: 'Home' })).toBe(null)
  expect(mapTagKeyIntent({ key: 'Escape' })).toBe(null)
  expect(mapTagKeyIntent({ key: 'c', ctrlKey: true })).toBe(null)
})

// --- keys in the input ------------------------------------------------------

test('isTagRemoveLastKey is Backspace with a collapsed caret at offset 0', () => {
  expect(isTagRemoveLastKey({ key: 'Backspace' })).toBe(true)
  // the common case: the input is empty and the user keeps deleting tags
  expect(isTagRemoveLastKey({ key: 'Backspace' }, { selectionStart: 0 })).toBe(
    true,
  )
  // no selection API reads as offset 0, like Ariakit's `selectionStart || 0`
  expect(
    isTagRemoveLastKey(
      { key: 'Backspace' },
      { selectionStart: null, length: 5 },
    ),
  ).toBe(true)

  // there is text to the left, so Backspace edits it
  expect(isTagRemoveLastKey({ key: 'Backspace' }, { selectionStart: 3 })).toBe(
    false,
  )
  // a selection is deleted instead
  expect(
    isTagRemoveLastKey(
      { key: 'Backspace' },
      { selectionStart: 0, selectionEnd: 3 },
    ),
  ).toBe(false)

  expect(isTagRemoveLastKey({ key: 'Delete' })).toBe(false)
})

test('canTagInputNavigate lets an arrow key leave only from the edge it faces', () => {
  // backward keys need the caret at the start
  expect(canTagInputNavigate({ key: 'ArrowLeft' })).toBe(true)
  expect(canTagInputNavigate({ key: 'ArrowUp' })).toBe(true)
  expect(canTagInputNavigate({ key: 'ArrowLeft' }, { selectionStart: 2 })).toBe(
    false,
  )

  // forward keys need it at the end
  expect(canTagInputNavigate({ key: 'ArrowRight' }, { length: 3 })).toBe(false)
  expect(
    canTagInputNavigate(
      { key: 'ArrowRight' },
      { selectionStart: 3, length: 3 },
    ),
  ).toBe(true)
  expect(
    canTagInputNavigate({ key: 'ArrowDown' }, { selectionStart: 3, length: 3 }),
  ).toBe(true)

  // each key looks at the end of the selection it faces, so a selection that
  // reaches the far edge navigates — Ariakit compares `selection.end` for a
  // forward key and `selection.start` for a backward one
  expect(
    canTagInputNavigate(
      { key: 'ArrowRight' },
      { selectionStart: 0, selectionEnd: 3, length: 3 },
    ),
  ).toBe(true)
  expect(
    canTagInputNavigate(
      { key: 'ArrowLeft' },
      { selectionStart: 0, selectionEnd: 3, length: 3 },
    ),
  ).toBe(true)
  expect(
    canTagInputNavigate(
      { key: 'ArrowRight' },
      { selectionStart: 0, selectionEnd: 2, length: 3 },
    ),
  ).toBe(false)
})

test('canTagInputNavigate never blocks a key that is not an arrow of the axis', () => {
  const middle = { selectionStart: 2, length: 5 }

  // Home / End belong to the widget, which is how End reaches the input
  expect(canTagInputNavigate({ key: 'End' }, middle)).toBe(true)
  expect(canTagInputNavigate({ key: 'Home' }, middle)).toBe(true)
  expect(canTagInputNavigate({ key: 'Enter' }, middle)).toBe(true)

  // an arrow the orientation does not navigate is left to the caret handler,
  // and `mapNavigationIntent` discards it anyway
  expect(
    canTagInputNavigate(
      { key: 'ArrowUp' },
      { ...middle, orientation: 'horizontal' },
    ),
  ).toBe(true)
  expect(
    canTagInputNavigate(
      { key: 'ArrowLeft' },
      { ...middle, orientation: 'vertical' },
    ),
  ).toBe(true)
  // ... while the arrow it does navigate is still guarded
  expect(
    canTagInputNavigate(
      { key: 'ArrowUp' },
      { ...middle, orientation: 'vertical' },
    ),
  ).toBe(false)
})

// --- values -----------------------------------------------------------------

test('addTagValue and removeTagValue keep the reference when nothing changes', () => {
  const values = ['react']

  expect(addTagValue(values, 'jsx')).toEqual(['react', 'jsx'])
  // the kept reference is how the model reports "nothing happened"
  expect(addTagValue(values, 'react')).toBe(values)

  expect(removeTagValue(values, 'react')).toEqual([])
  expect(removeTagValue(values, 'vue')).toBe(values)

  // neither ever mutates its input
  expect(values).toEqual(['react'])
})
