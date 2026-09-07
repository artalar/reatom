/**
 * Layer 1 pure navigation for `composite`: every arrow-key query Ariakit's
 * composite store answers, as functions of a plain item list.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/composite/composite-store.ts` and
 * `packages/ariakit-react-components/src/composite/utils.ts`.
 *
 * Ariakit hides these helpers inside `createCompositeStore`, which is why its
 * grid / loop / wrap / shift matrix can only be tested through a rendered
 * widget. They are exported here so the matrix is covered by node tests over
 * plain arrays, and so adapters can answer "which item is next" without a
 * model.
 */

/** Orientation of a composite widget. */
export type CompositeOrientation = 'horizontal' | 'vertical' | 'both'

/**
 * A focus policy that can be limited to one axis: `true` on both axes,
 * `'horizontal'` / `'vertical'` on one, `false` never.
 */
export type CompositeFocusPolicy = boolean | CompositeOrientation

/** The direction of a single navigation step. */
export type CompositeDirection = 'next' | 'previous' | 'up' | 'down'

/**
 * The plain item snapshot navigation works on — the data Ariakit keeps in
 * `renderedItems`.
 */
export interface CompositeNavigationItem {
  /** The item id. `null` for the base element placeholder, see {@link flipItems}. */
  id: string
  /** Whether arrow keys must skip the item. */
  disabled?: boolean
  /** The row the item belongs to on a two-dimensional composite. */
  rowId?: string
}

/** The navigation flags {@link getNextId} reads, all optional. */
export interface CompositeNavigationState {
  /**
   * The rendered items, in DOM order. Registered but unrendered items are not
   * navigable, which is why Ariakit navigates `renderedItems` and not `items`.
   */
  items?: ReadonlyArray<CompositeNavigationItem>
  /**
   * The current active item id. `null` is the base element, `undefined` is "no
   * active item yet" — both make navigation start from the first enabled item.
   */
  activeId?: string | null
  /** Loops from the last item back to the first one. */
  focusLoop?: CompositeFocusPolicy
  /** On a grid, moves from the end of a row/column into the next one. */
  focusWrap?: CompositeFocusPolicy
  /**
   * On a grid, shifts to the previous item when the next one is missing or
   * disabled.
   */
  focusShift?: boolean
  /** Whether the base element takes part in the focus order. */
  includesBaseElement?: boolean
  /** Inverts `next` / `previous`, for `dir="rtl"` widgets. */
  rtl?: boolean
  /**
   * How many enabled items to skip inside the current row or column — the Home
   * / End / PageUp / PageDown mode. A negative skip lands on the last item of
   * the row or column.
   */
  skip?: number
}

/**
 * The base element placeholder.
 *
 * Ariakit's `NULL_ITEM`: an item whose id is `null` marks the composite
 * container in the focus order, so "next" can step out of the items and onto
 * the widget itself. The lie about the type is Ariakit's too — it keeps the
 * item shape uniform while `getNextId` still returns `null` for it.
 */
const NULL_ITEM: CompositeNavigationItem = { id: null as unknown as string }

const EMPTY_ITEM_ID = '__EMPTY_ITEM__'

/**
 * Finds the first item that is not disabled, optionally ignoring one id.
 *
 * @remarks
 *   `excludeId` is how Ariakit keeps a navigation step from returning the item it
 *   started at.
 */
export const findFirstEnabledItem = <T extends CompositeNavigationItem>(
  items: ReadonlyArray<T>,
  excludeId?: string | null,
): T | undefined =>
  items.find((item) =>
    excludeId ? !item.disabled && item.id !== excludeId : !item.disabled,
  )

/** Filters out the disabled items, optionally ignoring one id. */
export const getEnabledItems = <T extends CompositeNavigationItem>(
  items: ReadonlyArray<T>,
  excludeId?: string | null,
): Array<T> =>
  items.filter((item) =>
    excludeId ? !item.disabled && item.id !== excludeId : !item.disabled,
  )

/**
 * Filters the items of one row. A `rowId` of `undefined` selects the items of a
 * one-dimensional composite, which is exactly what the grid code needs when it
 * runs over a flat list.
 */
export const getItemsInRow = <T extends CompositeNavigationItem>(
  items: ReadonlyArray<T>,
  rowId?: string,
): Array<T> => items.filter((item) => item.rowId === rowId)

/** Groups the items into rows by their `rowId`, keeping the item order. */
export const groupItemsByRows = <T extends CompositeNavigationItem>(
  items: ReadonlyArray<T>,
): Array<Array<T>> => {
  const rows: Array<Array<T>> = []
  for (const item of items) {
    const row = rows.find((currentRow) => currentRow[0]?.rowId === item.rowId)
    if (row) row.push(item)
    else rows.push([item])
  }
  return rows
}

/**
 * Whether the items describe a two-dimensional composite.
 *
 * One `rowId` on any item is enough, which is Ariakit's `isGrid`: a grid where
 * only some rows are marked would navigate as a grid anyway.
 */
export const isCompositeGrid = (
  items: ReadonlyArray<CompositeNavigationItem>,
): boolean => items.some((item) => !!item.rowId)

/**
 * Returns the id of the first enabled item, `undefined` when every item is
 * disabled — Ariakit's `store.first()`.
 */
export const getFirstEnabledId = (
  items: ReadonlyArray<CompositeNavigationItem>,
): string | undefined => findFirstEnabledItem(items)?.id

/** Returns the id of the last enabled item — Ariakit's `store.last()`. */
export const getLastEnabledId = (
  items: ReadonlyArray<CompositeNavigationItem>,
): string | undefined => findFirstEnabledItem([...items].reverse())?.id

/**
 * Returns the id of the first enabled item of the last row.
 *
 * @remarks
 *   Ariakit's `findFirstEnabledItemInTheLastRow`: pressing `ArrowUp` on the base
 *   element of a grid must enter the grid at the beginning of its last row,
 *   which is neither the last item nor what an `up` step from "no active item"
 *   would give.
 */
export const getFirstEnabledIdInLastRow = (
  items: ReadonlyArray<CompositeNavigationItem>,
): string | undefined =>
  findFirstEnabledItem(groupItemsByRows(items).reverse().flat())?.id

/**
 * Moves every item before `activeId` to the end of the list, so that a plain
 * "find the next enabled item" scan wraps around — this is how `focusLoop`
 * works.
 *
 * @remarks
 *   Ported from Ariakit's `flipItems`. The active item itself is dropped, so the
 *   scan can not return it.
 * @example
 *   flipItems([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'b')
 *   // [{ id: 'c' }, { id: 'a' }]
 *
 * @param items - The items of one row, column, or of the whole list.
 * @param activeId - The id the loop starts after. It must be an id of `items`;
 *   an unknown id rotates around index `-1` and repeats items, which is
 *   Ariakit's behavior and unreachable through {@link getNextId} because that
 *   resolves the active item first.
 * @param insertBaseElement - Inserts the {@link NULL_ITEM} placeholder between
 *   the last and the first item, which is what `includesBaseElement` means: the
 *   widget itself is part of the loop.
 */
export const flipItems = <T extends CompositeNavigationItem>(
  items: ReadonlyArray<T>,
  activeId: string,
  insertBaseElement = false,
): Array<T> => {
  const index = items.findIndex((item) => item.id === activeId)
  return [
    ...items.slice(index + 1),
    ...(insertBaseElement ? [NULL_ITEM as T] : []),
    ...items.slice(0, index),
  ]
}

/**
 * Pads every row to the length of the longest one, so that vertical navigation
 * over a ragged grid stays on a column.
 *
 * @remarks
 *   Ported from Ariakit's `normalizeRows`, which mutates the rows in place; this
 *   version copies them, because the helper is public.
 *
 *   Holes are filled with a disabled placeholder, so moving down from the last
 *   item of a short row goes nowhere instead of jumping to a different column.
 *   With `focusShift`, the hole is filled with the previous item of the same
 *   row instead — the "shift to the item right before it" behavior — and
 *   disabled items are treated as holes so that they are shifted over as well.
 * @param rows - Rows as returned by {@link groupItemsByRows}.
 * @param activeId - The active item is never used as a shift target, otherwise
 *   moving down could land on the item it started at.
 * @param focusShift - Enables the shift behavior described above.
 */
export const normalizeRows = <T extends CompositeNavigationItem>(
  rows: ReadonlyArray<ReadonlyArray<T>>,
  activeId?: string | null,
  focusShift?: boolean,
): Array<Array<T>> => {
  const maxLength = rows.reduce((max, row) => Math.max(max, row.length), 0)

  return rows.map((row) => {
    const normalized = [...row]

    for (let i = 0; i < maxLength; i += 1) {
      const item = normalized[i]
      if (item && !(focusShift && item.disabled)) continue

      // A hole in the first column has no previous item, so `focusShift` looks
      // forward instead, to the first enabled item of the row.
      const previousItem =
        i === 0 && focusShift
          ? findFirstEnabledItem(normalized)
          : normalized[i - 1]

      normalized[i] =
        previousItem && activeId !== previousItem.id && focusShift
          ? previousItem
          : ({
              id: EMPTY_ITEM_ID,
              disabled: true,
              rowId: previousItem?.rowId,
            } as T)
    }

    return normalized
  })
}

/**
 * Transposes a grid: reads the items column by column and re-assigns their
 * `rowId` to the column index, which turns vertical navigation into the same
 * "next item in a row" scan horizontal navigation uses.
 *
 * @remarks
 *   Ported from Ariakit's `verticalizeItems`. Items of a one-dimensional
 *   composite (no `rowId`) keep an undefined `rowId`, so they stay one row and
 *   up / down keep working on a single column.
 */
export const verticalizeItems = <T extends CompositeNavigationItem>(
  items: ReadonlyArray<T>,
): Array<T> => {
  const rows = groupItemsByRows(items)
  const maxLength = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const verticalized: Array<T> = []

  for (let i = 0; i < maxLength; i += 1) {
    for (const row of rows) {
      const item = row[i]
      if (item) {
        verticalized.push({ ...item, rowId: item.rowId ? `${i}` : undefined })
      }
    }
  }

  return verticalized
}

/**
 * Returns the id of the item a navigation step lands on, `null` for the base
 * element, and `undefined` when there is nowhere to go.
 *
 * @remarks
 *   Ported from the `getNextId` closure of Ariakit's `createCompositeStore`. The
 *   only change is that the state is a parameter instead of a store read, which
 *   makes the whole grid / loop / wrap / shift matrix a pure function.
 *
 *   The three return values are distinct on purpose: `undefined` means "no move",
 *   so a key handler must not `preventDefault`, while `null` is a real move
 *   onto the composite element itself.
 * @example
 *   const items = [{ id: 'a' }, { id: 'b', disabled: true }, { id: 'c' }]
 *   getNextId('next', { items, activeId: 'a' }) // 'c' — disabled is skipped
 *   getNextId('next', { items, activeId: 'c' }) // undefined — at the end
 *   getNextId('next', { items, activeId: 'c', focusLoop: true }) // 'a'
 *
 * @param direction - `next` / `previous` walk the row, `up` / `down` the
 *   column.
 * @param state - See {@link CompositeNavigationState}.
 */
export const getNextId = (
  direction: CompositeDirection = 'next',
  state: CompositeNavigationState = {},
): string | null | undefined => {
  const {
    items: renderedItems = [],
    activeId,
    focusLoop = false,
    focusWrap = false,
    focusShift = false,
    includesBaseElement = false,
    rtl = false,
    skip = 0,
  } = state

  const isVerticalDirection = direction === 'up' || direction === 'down'
  const isNextDirection = direction === 'next' || direction === 'down'

  const canReverse = isNextDirection
    ? rtl && !isVerticalDirection
    : !rtl || isVerticalDirection

  // Shifting and skipping are mutually exclusive: Home / End must land on a
  // real item of the row, never on a shifted duplicate.
  const canShift = focusShift && !skip

  let items: Array<CompositeNavigationItem> = !isVerticalDirection
    ? [...renderedItems]
    : normalizeRows(groupItemsByRows(renderedItems), activeId, canShift).flat()

  if (canReverse) items = items.reverse()
  if (isVerticalDirection) items = verticalizeItems(items)

  // Without an active item, any direction just enters at the first enabled one.
  if (activeId == null) return findFirstEnabledItem(items)?.id

  const activeIndex = items.findIndex((item) => item.id === activeId)
  const activeItem = items[activeIndex]
  if (!activeItem) return findFirstEnabledItem(items)?.id

  const isGrid = items.some((item) => item.rowId)
  const nextItems = items.slice(activeIndex + 1)
  const nextItemsInRow = getItemsInRow(nextItems, activeItem.rowId)

  if (skip) {
    // Home, End, PageUp, PageDown
    const nextEnabledItemsInRow = getEnabledItems(nextItemsInRow, activeId)
    const nextItem =
      nextEnabledItemsInRow.slice(skip)[0] ??
      // Fewer items left than the skip asked for: stop at the last one.
      nextEnabledItemsInRow[nextEnabledItemsInRow.length - 1]
    return nextItem?.id
  }

  const canLoop =
    !!focusLoop &&
    (isVerticalDirection
      ? focusLoop !== 'horizontal'
      : focusLoop !== 'vertical')

  const canWrap =
    isGrid &&
    !!focusWrap &&
    (isVerticalDirection
      ? focusWrap !== 'horizontal'
      : focusWrap !== 'vertical')

  // When calling next directly, hasNullItem will only be true if it's not a
  // grid and focusLoop is set to true, which means that pressing right or down
  // keys on grids will never focus the composite container element. On
  // one-dimensional composites that don't loop, pressing right or down keys
  // also doesn't focus on the composite container element.
  const hasNullItem = isNextDirection
    ? (!isGrid || isVerticalDirection) && canLoop && includesBaseElement
    : isVerticalDirection
      ? includesBaseElement
      : false

  if (canLoop) {
    const loopItems =
      canWrap && !hasNullItem ? items : getItemsInRow(items, activeItem.rowId)
    const sortedItems = flipItems(loopItems, activeId, hasNullItem)
    return findFirstEnabledItem(sortedItems, activeId)?.id
  }

  if (canWrap) {
    const nextItem = findFirstEnabledItem(
      // `nextItems` contains the items of the following rows too, which is what
      // makes the wrap possible. With a null item, only the current row is
      // considered, so moving next from the last item focuses the composite
      // container instead — on grids that happens on vertical moves only.
      hasNullItem ? nextItemsInRow : nextItems,
      activeId,
    )
    return hasNullItem ? (nextItem?.id ?? null) : nextItem?.id
  }

  const nextItem = findFirstEnabledItem(nextItemsInRow, activeId)
  if (!nextItem && hasNullItem) return null
  return nextItem?.id
}
