/**
 * Layer 2 for `tag`: the handful of DOM reads and writes the tag prop records
 * need, plus the touch-device probe as an opt-in extension.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): `packages/ariakit-utils/src/platform.ts`,
 * `packages/ariakit-utils/src/focus.ts`, `packages/ariakit-utils/src/dom.ts`,
 * and `packages/ariakit-react-components/src/tag/utils.ts`.
 */

import type { Ext } from '@reatom/core'
import { withConnectHook } from '@reatom/core'

import { canUseDOM, isFocusable } from '../focusable/focusableDom'
import type { TagModel } from './reatomTag'
import type { TagInputCaret } from './tagIntent'

/**
 * `true` on a device with a touch screen.
 *
 * Port of Ariakit's `isTouchDevice`. It is a capability check, not a "is the
 * user touching right now" check, so a laptop with a touch screen counts.
 */
export const isTouchDevice = (): boolean =>
  canUseDOM() && !!navigator.maxTouchPoints

/**
 * Fills in {@link TagModel.touch} from the device, once the model is used.
 *
 * @remarks
 *   Ariakit probes the device in an effect (`useTouchDevice`) rather than during
 *   render, so that server-rendered markup is the pointer variant and hydration
 *   cannot mismatch. The connect hook is the same deferral: the atom keeps its
 *   `false` default until something subscribes to the model.
 * @example
 *   const invitees = reatomTag({ name: 'invitees' }).extend(withTagTouch())
 *
 *   // on a touch device, once subscribed:
 *   invitees.props.listbox().role // 'list'
 *   invitees.props.remove('react')().role // 'button'
 */
export const withTagTouch = <T extends TagModel>(): Ext<T, T> => {
  return (target) =>
    target.extend(
      withConnectHook(() => {
        target.touch.set(isTouchDevice())
      }),
    )
}

/**
 * The closest ancestor of `element` — itself included — that can take focus, or
 * `null`.
 *
 * @remarks
 *   Port of Ariakit's `getClosestFocusable`, used by the tag list to tell "the
 *   user clicked the padding around the tags" from "the user clicked a tag or
 *   the remove button". Ariakit walks with
 *   `element.closest(focusableSelector)`, which can revisit the same element
 *   when it matches the selector but is not focusable (a hidden input); walking
 *   the parent chain cannot.
 */
export const getClosestFocusable = (
  element?: Element | null,
): HTMLElement | null => {
  let current = element ?? null
  while (current) {
    if (isFocusable(current)) return current as HTMLElement
    current = current.parentElement
  }
  return null
}

/** The value and the caret of a text field, as one DOM read. */
export interface TagInputReading extends TagInputCaret {
  /** The value the element reports, `''` for anything that has none. */
  value: string
  /** Length of {@link TagInputReading.value}, so the shape is a `TagInputCaret`. */
  length: number
}

/**
 * Reads the value and the caret of a text field in one go.
 *
 * @remarks
 *   Port of Ariakit's `getTextboxSelection` for the text-field half — a tag input
 *   is an `<input>` or a `<textarea>`, never a contenteditable, because the
 *   value has to round-trip through the `value` prop.
 *
 *   Reading `selectionStart` throws on Safari for input types without a selection
 *   API, hence the `try`. A `null` selection stays `null` rather than being
 *   normalized here, because the two consumers disagree about what it means:
 *   the caret guards read it as offset `0`, the change mapper as the end of the
 *   value. Both follow Ariakit.
 *
 *   `element` is `unknown` because a handler gets `event.currentTarget`, which is
 *   `EventTarget | null` in the DOM types and a plain object in a node test.
 */
export const readTagInput = (element: unknown): TagInputReading => {
  const field = element as {
    value?: unknown
    selectionStart?: unknown
    selectionEnd?: unknown
  } | null

  const value = typeof field?.value === 'string' ? field.value : ''

  try {
    const start =
      typeof field?.selectionStart === 'number' ? field.selectionStart : null
    const end =
      typeof field?.selectionEnd === 'number' ? field.selectionEnd : start
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      length: value.length,
    }
  } catch {
    return {
      value,
      selectionStart: null,
      selectionEnd: null,
      length: value.length,
    }
  }
}

const SELECTABLE_INPUT_TYPES = /^(|text|search|password|tel|url)$/i

/**
 * Restores the caret of a text field.
 *
 * @remarks
 *   Port of Ariakit's `setSelectionRange`, which is called from a microtask after
 *   the value is written: a value that reaches the element asynchronously —
 *   through a framework render — resets the caret to the end, so the offsets
 *   have to be re-applied. The input-type guard is Ariakit's;
 *   `setSelectionRange` throws on a `number` or `email` input.
 */
export const setTagInputCaret = (
  element: unknown,
  start?: number | null,
  end?: number | null,
): void => {
  const field = element as HTMLInputElement | null
  if (!field || typeof field.setSelectionRange !== 'function') return
  if (start == null || end == null) return
  if (!SELECTABLE_INPUT_TYPES.test(field.type ?? '')) return
  try {
    field.setSelectionRange(start, end)
  } catch {
    // A field that lost its selection API between the read and the write; the
    // caret is the browser's business then.
  }
}
