import { expect, test } from 'vitest'

import {
  isSelectHideKey,
  isSelectResetKey,
  isSelectShowKey,
  mapSelectMoveIntent,
} from './selectIntent'

test('the button navigates with the four arrows, and a select is vertical', () => {
  expect(mapSelectMoveIntent({ key: 'ArrowDown' })).toEqual({ move: 'down' })
  expect(mapSelectMoveIntent({ key: 'ArrowUp' })).toEqual({ move: 'up' })
  // Ariakit's `isHorizontal` is `orientation !== 'vertical'`, and a select is
  // vertical by default — so the horizontal arrows do not move it
  expect(mapSelectMoveIntent({ key: 'ArrowRight' })).toBe(null)
  expect(mapSelectMoveIntent({ key: 'ArrowLeft' })).toBe(null)
})

test('a horizontal or grid select moves on the horizontal arrows too', () => {
  expect(
    mapSelectMoveIntent({ key: 'ArrowRight' }, { orientation: 'horizontal' }),
  ).toEqual({ move: 'next' })
  expect(
    mapSelectMoveIntent({ key: 'ArrowUp' }, { orientation: 'horizontal' }),
  ).toBe(null)

  // a grid always navigates on all four, whatever the orientation says
  expect(
    mapSelectMoveIntent(
      { key: 'ArrowRight' },
      { orientation: 'vertical', grid: true },
    ),
  ).toEqual({ move: 'next' })
  expect(mapSelectMoveIntent({ key: 'ArrowLeft' }, { grid: true })).toEqual({
    move: 'previous',
  })
})

test('the button leaves every non-arrow key to the page', () => {
  // Ariakit's `moveKeyMap` holds the four arrows and nothing else: while the
  // list is closed, Home / End / paging scroll the document
  for (const key of ['Home', 'End', 'PageUp', 'PageDown', 'a', 'Tab']) {
    expect(mapSelectMoveIntent({ key })).toBe(null)
  }
})

test('the key that opens the list is the one pointing at it', () => {
  expect(isSelectShowKey({ key: 'ArrowDown' }, 'bottom')).toBe(true)
  expect(isSelectShowKey({ key: 'ArrowUp' }, 'bottom')).toBe(true)
  expect(isSelectShowKey({ key: 'ArrowDown' }, 'top')).toBe(true)
  expect(isSelectShowKey({ key: 'ArrowUp' }, 'top')).toBe(true)

  expect(isSelectShowKey({ key: 'ArrowLeft' }, 'left')).toBe(true)
  expect(isSelectShowKey({ key: 'ArrowRight' }, 'right')).toBe(true)

  // …and only that one
  expect(isSelectShowKey({ key: 'ArrowLeft' }, 'bottom')).toBe(false)
  expect(isSelectShowKey({ key: 'ArrowRight' }, 'left')).toBe(false)
  expect(isSelectShowKey({ key: 'ArrowLeft' }, 'right')).toBe(false)
  expect(isSelectShowKey({ key: 'Enter' }, 'bottom')).toBe(false)
  expect(isSelectShowKey({ key: 'a' }, 'bottom')).toBe(false)
})

test('Enter and Space confirm on the list, Escape resets', () => {
  expect(isSelectHideKey({ key: 'Enter' })).toBe(true)
  expect(isSelectHideKey({ key: ' ' })).toBe(true)
  expect(isSelectHideKey({ key: 'Escape' })).toBe(false)
  expect(isSelectHideKey({ key: 'a' })).toBe(false)

  expect(isSelectResetKey({ key: 'Escape' })).toBe(true)
  expect(isSelectResetKey({ key: 'Enter' })).toBe(false)
})
