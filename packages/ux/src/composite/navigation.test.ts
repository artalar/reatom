import { expect, test } from 'vitest'

import type { CompositeNavigationItem } from './getNextId'
import {
  findFirstEnabledItem,
  flipItems,
  getEnabledItems,
  getFirstEnabledId,
  getFirstEnabledIdInLastRow,
  getItemsInRow,
  getLastEnabledId,
  getNextId,
  groupItemsByRows,
  isCompositeGrid,
  normalizeRows,
  verticalizeItems,
} from './getNextId'
import { mapEntryIntent, mapNavigationIntent } from './navigationIntent'

/**
 * The navigation matrix, over plain arrays. Ariakit can only reach these paths
 * through a rendered widget; every expectation below was verified against a
 * verbatim copy of Ariakit's `getNextId`
 * (`ariakit-components/src/composite/composite-store.ts`).
 */

/** One-dimensional composite with a disabled item in the middle. */
const flat: Array<CompositeNavigationItem> = [
  { id: 'a' },
  { id: 'b', disabled: true },
  { id: 'c' },
  { id: 'd' },
]

/** 2×3 grid whose middle item of the last row is disabled. */
const grid: Array<CompositeNavigationItem> = [
  { id: 'r0c0', rowId: 'r0' },
  { id: 'r0c1', rowId: 'r0' },
  { id: 'r0c2', rowId: 'r0' },
  { id: 'r1c0', rowId: 'r1' },
  { id: 'r1c1', rowId: 'r1', disabled: true },
  { id: 'r1c2', rowId: 'r1' },
]

/** Grid whose last row is one item short — what `normalizeRows` pads. */
const ragged: Array<CompositeNavigationItem> = [
  { id: 'r0c0', rowId: 'r0' },
  { id: 'r0c1', rowId: 'r0' },
  { id: 'r0c2', rowId: 'r0' },
  { id: 'r1c0', rowId: 'r1' },
  { id: 'r1c1', rowId: 'r1' },
]

const ids = (items: ReadonlyArray<CompositeNavigationItem>) =>
  items.map((item) => item.id)

// --- item queries -----------------------------------------------------------

test('enabled item queries skip disabled items and the excluded id', () => {
  expect(findFirstEnabledItem(flat)?.id).toBe('a')
  expect(findFirstEnabledItem(flat, 'a')?.id).toBe('c')
  expect(findFirstEnabledItem([{ id: 'a', disabled: true }])).toBe(undefined)

  expect(ids(getEnabledItems(flat))).toEqual(['a', 'c', 'd'])
  expect(ids(getEnabledItems(flat, 'c'))).toEqual(['a', 'd'])

  expect(getFirstEnabledId(flat)).toBe('a')
  expect(getLastEnabledId(flat)).toBe('d')
  expect(getFirstEnabledId([])).toBe(undefined)
  expect(getLastEnabledId([{ id: 'a', disabled: true }])).toBe(undefined)
})

test('rows are grouped by rowId, keeping the item order', () => {
  expect(groupItemsByRows(grid).map(ids)).toEqual([
    ['r0c0', 'r0c1', 'r0c2'],
    ['r1c0', 'r1c1', 'r1c2'],
  ])
  // a one-dimensional composite is a single row keyed by `undefined`
  expect(groupItemsByRows(flat).map(ids)).toEqual([['a', 'b', 'c', 'd']])

  expect(ids(getItemsInRow(grid, 'r1'))).toEqual(['r1c0', 'r1c1', 'r1c2'])
  expect(ids(getItemsInRow(flat, undefined))).toEqual(['a', 'b', 'c', 'd'])

  expect(isCompositeGrid(grid)).toBe(true)
  expect(isCompositeGrid(flat)).toBe(false)

  expect(getFirstEnabledIdInLastRow(grid)).toBe('r1c0')
  expect(getFirstEnabledIdInLastRow(flat)).toBe('a')
})

test('flipItems rotates a row so a plain scan wraps around', () => {
  expect(ids(flipItems(flat, 'b'))).toEqual(['c', 'd', 'a'])
  expect(ids(flipItems(flat, 'a'))).toEqual(['b', 'c', 'd'])
  // the base element placeholder lands between the last and the first item
  expect(ids(flipItems(flat, 'd', true))).toEqual([null, 'a', 'b', 'c'])
  // an unknown id rotates around index -1, which repeats items — Ariakit's
  // behavior, and unreachable through `getNextId`, which resolves the active
  // item first
  expect(ids(flipItems(flat, 'nope'))).toEqual([
    'a',
    'b',
    'c',
    'd',
    'a',
    'b',
    'c',
  ])
})

test('normalizeRows pads short rows with a disabled placeholder', () => {
  const rows = normalizeRows(groupItemsByRows(ragged))

  expect(rows.map(ids)).toEqual([
    ['r0c0', 'r0c1', 'r0c2'],
    ['r1c0', 'r1c1', '__EMPTY_ITEM__'],
  ])
  expect(rows[1]![2]).toEqual({
    id: '__EMPTY_ITEM__',
    disabled: true,
    rowId: 'r1',
  })
  // the input is not mutated, unlike in Ariakit
  expect(ragged).toHaveLength(5)
})

test('normalizeRows with focusShift fills holes with the previous item', () => {
  expect(
    normalizeRows(groupItemsByRows(ragged), undefined, true).map(ids),
  ).toEqual([
    ['r0c0', 'r0c1', 'r0c2'],
    ['r1c0', 'r1c1', 'r1c1'],
  ])

  // the active item is never a shift target, otherwise a move would land on it
  expect(
    normalizeRows(groupItemsByRows(ragged), 'r1c1', true).map(ids),
  ).toEqual([
    ['r0c0', 'r0c1', 'r0c2'],
    ['r1c0', 'r1c1', '__EMPTY_ITEM__'],
  ])

  // with focusShift a disabled item is a hole too, so it is shifted over
  expect(
    normalizeRows(groupItemsByRows(grid), undefined, true).map(ids),
  ).toEqual([
    ['r0c0', 'r0c1', 'r0c2'],
    ['r1c0', 'r1c0', 'r1c2'],
  ])

  // a hole in the first column looks forward instead of backward
  expect(
    normalizeRows(
      [[{ id: 'x', disabled: true }, { id: 'y' }]],
      undefined,
      true,
    ).map(ids),
  ).toEqual([['y', 'y']])
})

test('verticalizeItems transposes a grid and re-keys the rows to columns', () => {
  const verticalized = verticalizeItems(grid)

  expect(ids(verticalized)).toEqual([
    'r0c0',
    'r1c0',
    'r0c1',
    'r1c1',
    'r0c2',
    'r1c2',
  ])
  expect(verticalized.map((item) => item.rowId)).toEqual([
    '0',
    '0',
    '1',
    '1',
    '2',
    '2',
  ])

  // a one-dimensional composite stays one row, so up / down keep working on it
  expect(ids(verticalizeItems(flat))).toEqual(['a', 'b', 'c', 'd'])
  expect(verticalizeItems(flat).every((item) => item.rowId === undefined)).toBe(
    true,
  )
})

// --- one-dimensional navigation ---------------------------------------------

test('navigation skips disabled items and stops at the ends', () => {
  expect(getNextId('next', { items: flat, activeId: 'a' })).toBe('c')
  expect(getNextId('next', { items: flat, activeId: 'd' })).toBe(undefined)
  expect(getNextId('previous', { items: flat, activeId: 'c' })).toBe('a')
  expect(getNextId('previous', { items: flat, activeId: 'a' })).toBe(undefined)
  // up / down navigate the single column of a one-dimensional composite
  expect(getNextId('down', { items: flat, activeId: 'a' })).toBe('c')
  expect(getNextId('up', { items: flat, activeId: 'c' })).toBe('a')
})

test('navigation without an active item enters at the closest end', () => {
  expect(getNextId('next', { items: flat })).toBe('a')
  expect(getNextId('next', { items: flat, activeId: null })).toBe('a')
  expect(getNextId('previous', { items: flat, activeId: null })).toBe('d')
  // an unknown id is normal during a mount race and must not throw
  expect(getNextId('next', { items: flat, activeId: 'gone' })).toBe('a')
  expect(getNextId('next', { items: [] })).toBe(undefined)
})

test('focusLoop wraps around, per axis', () => {
  expect(
    getNextId('next', { items: flat, activeId: 'd', focusLoop: true }),
  ).toBe('a')
  expect(
    getNextId('previous', { items: flat, activeId: 'a', focusLoop: true }),
  ).toBe('d')

  // `horizontal` loops next / previous only, `vertical` loops up / down only
  expect(
    getNextId('next', { items: flat, activeId: 'd', focusLoop: 'horizontal' }),
  ).toBe('a')
  expect(
    getNextId('down', { items: flat, activeId: 'd', focusLoop: 'horizontal' }),
  ).toBe(undefined)
  expect(
    getNextId('next', { items: flat, activeId: 'd', focusLoop: 'vertical' }),
  ).toBe(undefined)
  expect(
    getNextId('down', { items: flat, activeId: 'd', focusLoop: 'vertical' }),
  ).toBe('a')
})

test('rtl inverts the horizontal directions only', () => {
  expect(getNextId('next', { items: flat, activeId: 'a', rtl: true })).toBe(
    undefined,
  )
  expect(getNextId('previous', { items: flat, activeId: 'a', rtl: true })).toBe(
    'c',
  )
  expect(getNextId('next', { items: flat, activeId: 'd', rtl: true })).toBe('c')
  expect(getNextId('down', { items: flat, activeId: 'a', rtl: true })).toBe('c')
})

test('includesBaseElement puts the composite element in the focus order', () => {
  // `null` is the composite element itself, and only a loop can reach it going
  // forward
  expect(
    getNextId('next', {
      items: flat,
      activeId: 'd',
      focusLoop: true,
      includesBaseElement: true,
    }),
  ).toBe(null)
  expect(
    getNextId('previous', {
      items: flat,
      activeId: 'a',
      focusLoop: true,
      includesBaseElement: true,
    }),
  ).toBe('d')
  // moving up from the first item always reaches it
  expect(
    getNextId('up', { items: flat, activeId: 'a', includesBaseElement: true }),
  ).toBe(null)
  // moving down from the last one does not, without a loop
  expect(
    getNextId('down', {
      items: flat,
      activeId: 'd',
      includesBaseElement: true,
    }),
  ).toBe(undefined)
})

test('skip jumps inside the row and clamps to its last enabled item', () => {
  expect(getNextId('next', { items: flat, activeId: 'a', skip: 1 })).toBe('d')
  // fewer items left than asked for: stop at the last one
  expect(getNextId('next', { items: flat, activeId: 'a', skip: 2 })).toBe('d')
  // a negative skip is Ariakit's `next(-1)`: the end of the row
  expect(getNextId('next', { items: flat, activeId: 'a', skip: -1 })).toBe('d')
  expect(getNextId('previous', { items: flat, activeId: 'd', skip: -1 })).toBe(
    'a',
  )
})

// --- grid navigation --------------------------------------------------------

test('grid navigation stays inside the row and the column', () => {
  expect(getNextId('next', { items: grid, activeId: 'r0c0' })).toBe('r0c1')
  expect(getNextId('next', { items: grid, activeId: 'r0c2' })).toBe(undefined)
  expect(getNextId('down', { items: grid, activeId: 'r0c0' })).toBe('r1c0')
  expect(getNextId('up', { items: grid, activeId: 'r1c0' })).toBe('r0c0')
  // the item below is disabled, and nothing shifts without `focusShift`
  expect(getNextId('down', { items: grid, activeId: 'r0c1' })).toBe(undefined)
  expect(getNextId('down', { items: grid, activeId: 'r1c0' })).toBe(undefined)
  expect(getNextId('next', { items: grid, activeId: 'r0c0', rtl: true })).toBe(
    undefined,
  )
})

test('focusWrap moves between rows and columns, focusLoop stays in one', () => {
  expect(
    getNextId('next', { items: grid, activeId: 'r0c2', focusWrap: true }),
  ).toBe('r1c0')
  // `vertical` wraps between columns only, so a horizontal move does not wrap
  expect(
    getNextId('next', { items: grid, activeId: 'r0c2', focusWrap: 'vertical' }),
  ).toBe(undefined)
  expect(
    getNextId('down', { items: grid, activeId: 'r1c0', focusWrap: true }),
  ).toBe('r0c1')
  expect(
    getNextId('down', { items: grid, activeId: 'r1c2', focusWrap: true }),
  ).toBe(undefined)

  // a loop returns to the beginning of the same row / column
  expect(
    getNextId('next', { items: grid, activeId: 'r0c2', focusLoop: true }),
  ).toBe('r0c0')
  expect(
    getNextId('down', { items: grid, activeId: 'r1c0', focusLoop: true }),
  ).toBe('r0c0')
})

test('focusShift shifts to the previous item of a short or disabled column', () => {
  // the item below is disabled, so the move shifts to the one before it
  expect(
    getNextId('down', { items: grid, activeId: 'r0c1', focusShift: true }),
  ).toBe('r1c0')
  // the last row is one item short, so the column has no item to move to
  expect(getNextId('down', { items: ragged, activeId: 'r0c2' })).toBe(undefined)
  expect(
    getNextId('down', { items: ragged, activeId: 'r0c2', focusShift: true }),
  ).toBe('r1c1')
  expect(getNextId('up', { items: ragged, activeId: 'r1c1' })).toBe('r0c1')
})

test('skip inside a grid row is the Home / End behavior', () => {
  expect(getNextId('next', { items: grid, activeId: 'r1c0', skip: -1 })).toBe(
    'r1c2',
  )
  expect(
    getNextId('previous', { items: grid, activeId: 'r0c2', skip: -1 }),
  ).toBe('r0c0')
})

// --- keyboard intents -------------------------------------------------------

test('item keys map to navigation, filtered by orientation', () => {
  expect(mapNavigationIntent({ key: 'ArrowRight' })).toEqual({ move: 'next' })
  expect(mapNavigationIntent({ key: 'ArrowLeft' })).toEqual({
    move: 'previous',
  })
  expect(mapNavigationIntent({ key: 'ArrowDown' })).toEqual({ move: 'down' })
  expect(mapNavigationIntent({ key: 'ArrowUp' })).toEqual({ move: 'up' })
  expect(mapNavigationIntent({ key: 'Enter' })).toBe(null)

  expect(
    mapNavigationIntent({ key: 'ArrowDown' }, { orientation: 'horizontal' }),
  ).toBe(null)
  expect(
    mapNavigationIntent({ key: 'ArrowRight' }, { orientation: 'vertical' }),
  ).toBe(null)
  // orientation does not apply to a grid: all four arrows navigate
  expect(
    mapNavigationIntent(
      { key: 'ArrowDown' },
      { orientation: 'horizontal', grid: true },
    ),
  ).toEqual({ move: 'down' })
})

test('Home and End stay inside a grid row unless Ctrl is held', () => {
  expect(mapNavigationIntent({ key: 'Home' })).toEqual({ move: 'first' })
  expect(mapNavigationIntent({ key: 'End' })).toEqual({ move: 'last' })

  expect(mapNavigationIntent({ key: 'Home' }, { grid: true })).toEqual({
    move: 'previous',
    skip: -1,
  })
  expect(mapNavigationIntent({ key: 'End' }, { grid: true })).toEqual({
    move: 'next',
    skip: -1,
  })
  expect(
    mapNavigationIntent({ key: 'End', ctrlKey: true }, { grid: true }),
  ).toEqual({ move: 'last' })

  // a vertical composite inside a text field leaves Home / End to the caret
  expect(
    mapNavigationIntent(
      { key: 'Home' },
      { orientation: 'vertical', baseIsTextField: true },
    ),
  ).toBe(null)
  expect(
    mapNavigationIntent({ key: 'Home' }, { baseIsTextField: true }),
  ).toEqual({ move: 'first' })
})

test('paging falls back to the ends without a measured page size', () => {
  expect(mapNavigationIntent({ key: 'PageDown' })).toEqual({ move: 'last' })
  expect(mapNavigationIntent({ key: 'PageUp' })).toEqual({ move: 'first' })
  expect(mapNavigationIntent({ key: 'PageDown' }, { pageSize: 4 })).toEqual({
    move: 'down',
    skip: 4,
  })
  expect(mapNavigationIntent({ key: 'PageUp' }, { pageSize: 4 })).toEqual({
    move: 'up',
    skip: 4,
  })
})

test('base element keys pick an entry point instead of a step', () => {
  expect(mapEntryIntent({ key: 'ArrowDown' })).toEqual({ move: 'first' })
  expect(mapEntryIntent({ key: 'ArrowRight' })).toEqual({ move: 'first' })
  expect(mapEntryIntent({ key: 'ArrowLeft' })).toEqual({ move: 'last' })
  expect(mapEntryIntent({ key: 'ArrowUp' })).toEqual({ move: 'last' })
  expect(mapEntryIntent({ key: 'Home' })).toEqual({ move: 'first' })
  expect(mapEntryIntent({ key: 'End' })).toEqual({ move: 'last' })
  expect(mapEntryIntent({ key: 'PageUp' })).toEqual({ move: 'first' })
  expect(mapEntryIntent({ key: 'PageDown' })).toEqual({ move: 'last' })
  expect(mapEntryIntent({ key: 'a' })).toBe(null)

  // on a grid, up enters at the beginning of the last row
  expect(mapEntryIntent({ key: 'ArrowUp' }, { grid: true })).toEqual({
    move: 'firstInLastRow',
  })
  expect(
    mapEntryIntent({ key: 'ArrowUp' }, { orientation: 'horizontal' }),
  ).toBe(null)

  // horizontal keys belong to the caret of a text field base element
  expect(mapEntryIntent({ key: 'Home' }, { baseIsTextField: true })).toBe(null)
  expect(mapEntryIntent({ key: 'ArrowRight' }, { baseIsTextField: true })).toBe(
    null,
  )
  expect(
    mapEntryIntent({ key: 'ArrowDown' }, { baseIsTextField: true }),
  ).toEqual({ move: 'first' })
})
