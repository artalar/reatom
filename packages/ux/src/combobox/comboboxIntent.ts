/**
 * Layer 1 interaction policy for `combobox`: which of the three things a key
 * press on a combobox can mean, and when a pointer or key interaction is
 * allowed to open the list — all as pure functions of the event.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): the `onKeyDown` and `onMouseDown` handlers of
 * `packages/ariakit-react-components/src/combobox/combobox.tsx` and the
 * `onKeyDown` handler of
 * `packages/ariakit-react-components/src/combobox/combobox-item.tsx`.
 *
 * Ariakit inlines all of it in component bodies, where it can only be tested by
 * rendering a widget and pressing keys.
 */

/**
 * The minimal shape of a key event the mappers read.
 *
 * Structural on purpose: a DOM `KeyboardEvent`, a React synthetic event, and a
 * plain object from a unit test all satisfy it.
 */
export interface ComboboxKeyEvent {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
}

/**
 * Whether a modifier other than `Shift` is held.
 *
 * @remarks
 *   Ariakit checks the four flags one by one before opening the list, so that
 *   `Ctrl+ArrowDown` (jump a paragraph) and the browser's own `Alt+ArrowDown`
 *   keep working. `Shift` is in the list because `Shift+ArrowDown` extends a
 *   text selection.
 */
export const hasComboboxModifier = (event: ComboboxKeyEvent): boolean =>
  !!(event.ctrlKey || event.altKey || event.shiftKey || event.metaKey)

/**
 * Whether the key press asks for the list to be shown: an unmodified arrow up
 * or down, which is the ARIA-recommended way to open a combobox popup.
 *
 * @example
 *   isComboboxShowKey({ key: 'ArrowDown' }) // true
 *   isComboboxShowKey({ key: 'ArrowDown', ctrlKey: true }) // false
 *   isComboboxShowKey({ key: 'a' }) // false
 */
export const isComboboxShowKey = (event: ComboboxKeyEvent): boolean =>
  (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
  !hasComboboxModifier(event)

/**
 * Whether `Enter` must be swallowed instead of doing anything else.
 *
 * @remarks
 *   Ariakit's comment: "When the popover is open, prevent Enter (with or without
 *   modifiers) from triggering the default behavior (submitting a parent form).
 *   […] If there's no active item (e.g., all items are filtered out, or
 *   activeId is stale after a React transition), Enter should be a no-op rather
 *   than submitting a form."
 *
 *   The active item is picked before this applies — that part of Ariakit's flow
 *   goes through its keyboard event proxy, and is the `activeValue` branch of
 *   the input's `onKeyDown` here.
 * @example
 *   isComboboxEnterBlocked({ key: 'Enter' }, true) // true
 *   isComboboxEnterBlocked({ key: 'Enter' }, false) // false — may submit a form
 */
export const isComboboxEnterBlocked = (
  event: ComboboxKeyEvent,
  open: boolean,
): boolean => open && event.key === 'Enter'

/**
 * Whether a key press on an _item_ should be handed to the combobox input.
 *
 * @remarks
 *   Ariakit's comment: "When the combobox is not working with virtual focus, the
 *   items will receive DOM focus. Therefore, pressing printable keys will not
 *   fill the text field. So we need to programmatically focus on the text field
 *   when the user presses printable keys."
 *
 *   One deliberate deviation: Ariakit's condition is `event.key.length === 1 ||
 *   key === 'Backspace' || key === 'Delete'`, which also matches `Ctrl+C` and
 *   `Cmd+A` — those would move focus out of the item and break copying from it.
 *   The modifier check excludes them; `Shift` is allowed, because a capital
 *   letter must reach the input.
 * @example
 *   isComboboxTypeaheadKey({ key: 'a' }) // true
 *   isComboboxTypeaheadKey({ key: 'A', shiftKey: true }) // true
 *   isComboboxTypeaheadKey({ key: 'Backspace' }) // true
 *   isComboboxTypeaheadKey({ key: 'c', ctrlKey: true }) // false
 *   isComboboxTypeaheadKey({ key: 'ArrowDown' }) // false
 */
export const isComboboxTypeaheadKey = (event: ComboboxKeyEvent): boolean => {
  if (event.ctrlKey || event.altKey || event.metaKey) return false
  return (
    event.key.length === 1 ||
    event.key === 'Backspace' ||
    event.key === 'Delete'
  )
}

/** The minimal shape of a pointer event the input's `onMouseDown` reads. */
export interface ComboboxPointerEvent {
  /** `0` is the primary button; Ariakit ignores every other one. */
  button?: number
  ctrlKey?: boolean
}

/**
 * Whether a pointer press on the input counts as "the user clicked the field".
 *
 * @remarks
 *   Ariakit's guards: a secondary button opens a context menu, and `Ctrl+click`
 *   is a right click on macOS.
 * @example
 *   isComboboxPrimaryPress({ button: 0 }) // true
 *   isComboboxPrimaryPress({ button: 2 }) // false
 *   isComboboxPrimaryPress({ ctrlKey: true }) // false
 */
export const isComboboxPrimaryPress = (event: ComboboxPointerEvent): boolean =>
  !event.button && !event.ctrlKey

/**
 * Whether the list may be shown for a value of this length.
 *
 * Port of Ariakit's `canShow`, the default of its `showOnChange`,
 * `showOnClick`, and `showOnKeyPress` props.
 *
 * @example
 *   canShowComboboxList('', 0) // true
 *   canShowComboboxList('', 1) // false
 *   canShowComboboxList('a', 1) // true
 */
export const canShowComboboxList = (
  value: string,
  showMinLength = 0,
): boolean => value.length >= showMinLength
