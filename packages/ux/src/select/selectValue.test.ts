import { expect, test } from 'vitest'

import {
  isSelectItemAutoFocus,
  isSelectItemSelected,
  isSelectMultiSelectable,
  lastSelectValue,
  nextSelectValue,
  toSelectValues,
} from './selectValue'

test('the value shape is the mode', () => {
  expect(isSelectMultiSelectable('Apple')).toBe(false)
  expect(isSelectMultiSelectable('')).toBe(false)
  expect(isSelectMultiSelectable([])).toBe(true)
  expect(isSelectMultiSelectable(['Apple'])).toBe(true)
  // "not chosen yet" is not a selection of many
  expect(isSelectMultiSelectable(undefined)).toBe(false)
})

test('toSelectValues is Ariakit toArray, with the unset value as an empty list', () => {
  expect(toSelectValues('Apple')).toEqual(['Apple'])
  expect(toSelectValues('')).toEqual([''])
  expect(toSelectValues(['Apple', 'Orange'])).toEqual(['Apple', 'Orange'])
  expect(toSelectValues([])).toEqual([])
  expect(toSelectValues(undefined)).toEqual([])
})

test('lastSelectValue is the value picked last', () => {
  expect(lastSelectValue('Apple')).toBe('Apple')
  expect(lastSelectValue(['Apple', 'Orange'])).toBe('Orange')
  expect(lastSelectValue([])).toBe(undefined)
  expect(lastSelectValue(undefined)).toBe(undefined)
})

test('isSelectItemSelected separates "no value" from "not selected"', () => {
  expect(isSelectItemSelected('Apple', 'Apple')).toBe(true)
  expect(isSelectItemSelected('Apple', 'Orange')).toBe(false)
  expect(isSelectItemSelected(['Apple', 'Orange'], 'Orange')).toBe(true)
  expect(isSelectItemSelected([], 'Apple')).toBe(false)
  expect(isSelectItemSelected(undefined, 'Apple')).toBe(false)

  // an item without a value is not selectable, so it announces nothing
  expect(isSelectItemSelected('Apple')).toBe(undefined)
  expect(isSelectItemSelected(['Apple'])).toBe(undefined)
})

test('nextSelectValue replaces a single value and toggles an array', () => {
  expect(nextSelectValue('Apple', 'Orange')).toBe('Orange')
  expect(nextSelectValue('', 'Apple')).toBe('Apple')
  // the first pick of an unset select decides the value, not the shape
  expect(nextSelectValue(undefined, 'Apple')).toBe('Apple')

  expect(nextSelectValue([], 'Apple')).toEqual(['Apple'])
  expect(nextSelectValue(['Apple'], 'Orange')).toEqual(['Apple', 'Orange'])
  expect(nextSelectValue(['Apple', 'Orange'], 'Apple')).toEqual(['Orange'])
})

test('nextSelectValue always returns a fresh array', () => {
  const value = ['Apple']
  const next = nextSelectValue(value, 'Orange')

  expect(next).not.toBe(value)
  expect(value).toEqual(['Apple'])
})

test('the item picked last is the one the popover opens at', () => {
  expect(isSelectItemAutoFocus({ value: 'Apple', itemValue: 'Apple' })).toBe(
    true,
  )
  expect(isSelectItemAutoFocus({ value: 'Apple', itemValue: 'Orange' })).toBe(
    false,
  )
  expect(
    isSelectItemAutoFocus({ value: ['Apple', 'Orange'], itemValue: 'Orange' }),
  ).toBe(true)
  expect(
    isSelectItemAutoFocus({ value: ['Apple', 'Orange'], itemValue: 'Apple' }),
  ).toBe(false)

  // nothing is picked, so nothing is focused
  expect(isSelectItemAutoFocus({ value: undefined, itemValue: 'Apple' })).toBe(
    false,
  )
  // an item without a value can not be the selection
  expect(isSelectItemAutoFocus({ value: 'Apple' })).toBe(false)
})

test('a registered active item keeps the focus the selection would take', () => {
  const selected = { value: 'Apple', itemValue: 'Apple' }

  // another item is the active one, and it exists — it was moved to on purpose
  expect(isSelectItemAutoFocus({ ...selected, activeKnown: true })).toBe(false)
  // …unless the active item is this one
  expect(
    isSelectItemAutoFocus({ ...selected, active: true, activeKnown: true }),
  ).toBe(true)
  // a stale or null active id does not address an item, so the selection wins
  expect(isSelectItemAutoFocus({ ...selected, activeKnown: false })).toBe(true)
})
