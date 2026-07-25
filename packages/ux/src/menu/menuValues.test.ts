import { expect, test } from 'vitest'

import {
  isMenuItemChecked,
  isMenuRadioChecked,
  isMenuValueName,
  nextMenuCheckboxValue,
  nextMenuRadioValue,
  nextMenuValues,
} from './menuValues'

// --- the values record ------------------------------------------------------

test('nextMenuValues writes a field and keeps the record shape', () => {
  expect(nextMenuValues({}, 'watching', ['issues'])).toEqual({
    watching: ['issues'],
  })
  expect(nextMenuValues({ apple: true }, 'orange', true)).toEqual({
    apple: true,
    orange: true,
  })
})

test('nextMenuValues accepts an updater over the previous value', () => {
  expect(nextMenuValues({ apple: true }, 'apple', (state) => !state)).toEqual({
    apple: false,
  })
  // An unset field reaches the updater as `undefined`, which is what lets a
  // checkbox item choose its own empty shape.
  expect(
    nextMenuValues({}, 'watching', (state) =>
      state === undefined ? [] : state,
    ),
  ).toEqual({ watching: [] })
})

test('nextMenuValues keeps the record identity when nothing changes', () => {
  const values = { apple: true }

  // Ariakit's `if (nextValue === prevValue) return values`: a write that
  // resolves to the current value must notify nothing.
  expect(nextMenuValues(values, 'apple', true)).toBe(values)
  expect(nextMenuValues(values, 'apple', (state) => state)).toBe(values)
  expect(nextMenuValues(values, 'apple', false)).not.toBe(values)
})

test('an updater that returns nothing unsets the field as false', () => {
  // `nextValue !== undefined && nextValue` — the field stays falsy instead of
  // becoming a hole in the record.
  expect(
    nextMenuValues({ fruit: 'apple' }, 'fruit', () => undefined as never),
  ).toEqual({ fruit: false })
})

test('nextMenuValues refuses the prototype-polluting names', () => {
  const values = { apple: true }

  expect(nextMenuValues(values, '__proto__', true)).toBe(values)
  expect(nextMenuValues(values, 'constructor', true)).toBe(values)
  expect(isMenuValueName('watching')).toBe(true)
  expect(isMenuValueName('__proto__')).toBe(false)
  expect(isMenuValueName('constructor')).toBe(false)
  expect(isMenuValueName(['watching'])).toBe(false)
})

// --- checkbox items ---------------------------------------------------------

test('a checkbox item is checked by an array field that contains its value', () => {
  const values = { watching: ['issues'] }

  expect(isMenuItemChecked(values, 'watching', 'issues')).toBe(true)
  expect(isMenuItemChecked(values, 'watching', 'pull-requests')).toBe(false)
})

test('a valueless checkbox item projects the boolean field itself', () => {
  expect(isMenuItemChecked({ warn: true }, 'warn')).toBe(true)
  expect(isMenuItemChecked({ warn: false }, 'warn')).toBe(false)
  // An unset field is unchecked, not undefined.
  expect(isMenuItemChecked({}, 'warn')).toBe(false)
})

test('a scalar field checks the one item that equals it', () => {
  expect(isMenuItemChecked({ fruit: 'apple' }, 'fruit', 'apple')).toBe(true)
  expect(isMenuItemChecked({ fruit: 'apple' }, 'fruit', 'orange')).toBe(false)
})

test('nextMenuCheckboxValue toggles inside an array field', () => {
  expect(nextMenuCheckboxValue(['issues'], 'pull-requests', true)).toEqual([
    'issues',
    'pull-requests',
  ])
  expect(nextMenuCheckboxValue(['issues'], 'issues', false)).toEqual([])
  // Checking twice is idempotent.
  expect(nextMenuCheckboxValue(['issues'], 'issues', true)).toEqual(['issues'])
})

test('an unset field takes the shape the item needs', () => {
  // Ariakit's `(prevValue = [])` default: an item with a value starts a group.
  expect(nextMenuCheckboxValue(undefined, 'issues', true)).toEqual(['issues'])
  // …and a valueless item owns the whole field.
  expect(nextMenuCheckboxValue(undefined, undefined, true)).toBe(true)
})

test('a scalar field is replaced by the checked item and unset by it', () => {
  expect(nextMenuCheckboxValue('apple', 'orange', true)).toBe('orange')
  expect(nextMenuCheckboxValue('apple', 'apple', true)).toBe(false)
  expect(nextMenuCheckboxValue(false, undefined, false)).toBe(false)
})

// --- radio items ------------------------------------------------------------

test('a radio item is checked when the group holds exactly its value', () => {
  expect(isMenuRadioChecked({ fruit: 'apple' }, 'fruit', 'apple')).toBe(true)
  expect(isMenuRadioChecked({ fruit: 'apple' }, 'fruit', 'orange')).toBe(false)
  expect(isMenuRadioChecked({}, 'fruit', 'apple')).toBe(false)
})

test('nextMenuRadioValue replaces the group and only clears its own value', () => {
  expect(nextMenuRadioValue(false, 'apple', true)).toBe('apple')
  expect(nextMenuRadioValue('orange', 'apple', true)).toBe('apple')
  expect(nextMenuRadioValue('apple', 'apple', false)).toBe(false)
  // An unchecked report from a sibling must not wipe the group.
  expect(nextMenuRadioValue('orange', 'apple', false)).toBe('orange')
  expect(nextMenuRadioValue(undefined, 'apple', false)).toBe(false)
})
