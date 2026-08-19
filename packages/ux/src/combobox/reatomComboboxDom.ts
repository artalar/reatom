/**
 * Layer 2 for `combobox`: the handful of DOM reads and writes the prop records
 * need, plus the two behaviors that need a lifetime rather than an event — the
 * Safari-touch platform probe and the auto-select.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): `packages/ariakit-utils/src/platform.ts`,
 * `packages/ariakit-utils/src/dom.ts`, `packages/ariakit-utils/src/events.ts`,
 * the `isTouchSafari` guard of
 * `packages/ariakit-components/src/combobox/combobox-store.ts`, and the
 * auto-select and inline-commit effects of
 * `packages/ariakit-react-components/src/combobox/combobox.tsx`.
 */

import type { Ext } from '@reatom/core'
import { effect, withConnectHook } from '@reatom/core'

import { canUseDOM, hasFocus, isSafari } from '../focusable/focusableDom'
import type { ComboboxModel } from './reatomCombobox'

/**
 * `true` on a device with a touch screen.
 *
 * @remarks
 *   Port of Ariakit's `isTouchDevice`. It is a capability check, not a "is the
 *   user touching right now" check, so a laptop with a touch screen counts.
 *
 *   Deliberately duplicated from `tag/reatomTagDom.ts` rather than imported: the
 *   `tag` edge of `combobox` is type-only, and a runtime import would make
 *   every combobox pull the tag module in. Both copies should move to
 *   `interactions/` together.
 *
 *   Only the `tag` copy is re-exported from `src/index.ts`, since two identical
 *   public `isTouchDevice` names cannot coexist there.
 */
const isTouchDevice = (): boolean => canUseDOM() && !!navigator.maxTouchPoints

/**
 * `true` on Safari _and_ a touch screen, the combination where
 * `aria-activedescendant` does not work on a combobox.
 *
 * Port of Ariakit's module-level `const isTouchSafari = isSafari() &&
 * isTouchDevice()` (`combobox-store.ts:32`).
 */
export const isTouchSafari = (): boolean => isSafari() && isTouchDevice()

/**
 * Fills in {@link ComboboxModel.touchSafari} from the platform, once the model
 * is used — which turns virtual focus off.
 *
 * @remarks
 *   Ariakit's comment (`combobox-store.ts:134-138`): "Safari doesn't support
 *   aria-activedescendant on combobox elements. This is particularly
 *   problematic when using touch devices as moving the VoiceOver virtual cursor
 *   through the combobox items will always move the focus to the input element.
 *   To work around this, we disable virtual focus on touch devices when using
 *   Safari."
 *
 *   Ariakit reads the platform when its module is evaluated, which is wrong on
 *   the server: the store would be created with `virtualFocus: true` there and
 *   with `false` in the browser, and the two markups differ in `tabindex` and
 *   `aria-activedescendant`. The connect hook is the same deferral
 *   `withTagTouch` uses — the atom keeps its `false` default until something
 *   subscribes.
 * @example
 *   const fruit = reatomCombobox({ name: 'fruit' }).extend(
 *     withComboboxTouchSafari(),
 *   )
 *
 *   // on Safari with a touch screen, once subscribed:
 *   fruit.composite.virtualFocus() // false
 *   fruit.props.input()['aria-activedescendant'] // undefined
 */
export const withComboboxTouchSafari = <T extends ComboboxModel<any>>(): Ext<
  T,
  T
> => {
  return (target) =>
    target.extend(
      withConnectHook(() => {
        target.touchSafari.set(isTouchSafari())
      }),
    )
}

/**
 * Activates the item typing should pick, whenever
 * {@link ComboboxModel.autoSelecting} says an auto-select is due.
 *
 * @remarks
 *   Ariakit runs the same policy from an effect that depends on the value _and_
 *   the rendered items, so an item list that arrives asynchronously is caught
 *   too (`combobox.tsx:363-422`). Two of its guards are ported:
 *
 *   - The popover must be open and settled — Ariakit observes its own private
 *       `data-placing` attribute with a `MutationObserver` "to prevent the
 *       focus from moving to the first item while the popover is still
 *       calculating its position, which could cause a scroll jump"; here that
 *       state is `popover.placing()`, so the observer is a plain dependency;
 *   - The input must still hold focus, so a value that changes after the widget was
 *       left alone does not move anything.
 *
 *   The `else` branch of Ariakit's effect is **not** ported: it scrolls the
 *   active item back into view after a selection reset, which is a view concern
 *   and needs layout. Neither are the `wheel` / `scroll` listeners that
 *   suppress the auto-select on a virtualized list — clear
 *   {@link ComboboxModel.canAutoSelect} from your own scroll handler for that.
 * @example
 *   const fruit = reatomCombobox({ autoSelect: true, name: 'fruit' }).extend(
 *     withComboboxAutoSelect(),
 *   )
 */
export const withComboboxAutoSelect = <T extends ComboboxModel<any>>(): Ext<
  T,
  T
> => {
  return (target) =>
    target.extend(
      withConnectHook(() => {
        // No `target()` read: the auto-select reacts to `autoSelecting` (armed
        // on type) and the item list, never to the value atom that owns this
        // connect hook. Reading only those non-value units keeps the effect
        // independent of its own hook target, so there is no connect/subscribe
        // feedback and the hook can disconnect — unsubscribing the effect is
        // that cleanup.
        const observer = effect(() => {
          const open = target.popover()
          const placing = target.popover.placing()
          const selecting = target.autoSelecting()
          const base = target.composite.baseElement()
          target.composite.navigationItems()

          if (!open || placing || !selecting) return
          if (base && !hasFocus(base)) return

          target.autoSelectFirst()
        }, `${target.name}.autoSelectOnType`)

        return () => observer.unsubscribe()
      }),
    )
}

/** The value, the caret, and the kind of edit of one `input` event. */
export interface ComboboxInputReading {
  /** The value the element reports, `''` for anything that has none. */
  value: string
  /**
   * The caret position after the edit, `null` for a field with no selection
   * API.
   */
  selectionStart: number | null
  /** The end of the selection after the edit. */
  selectionEnd: number | null
  /**
   * The `inputType` of a native `InputEvent`, which is what tells an insertion
   * from a deletion.
   */
  inputType?: string
  /** Whether an IME composition is in progress. */
  isComposing: boolean
}

/**
 * Reads everything the input's `onInput` handler needs, in one go.
 *
 * @remarks
 *   Ariakit reads the same five things inline from `event.currentTarget` and
 *   `event.nativeEvent` (`combobox.tsx:461-481`). Reading `selectionStart`
 *   throws on Safari for input types without a selection API, hence the `try`.
 *
 *   Both arguments are `unknown` because a handler gets `event.currentTarget`,
 *   which is `EventTarget | null` in the DOM types and a plain object in a node
 *   test.
 */
export const readComboboxInput = (
  element: unknown,
  event?: unknown,
): ComboboxInputReading => {
  const field = element as {
    value?: unknown
    selectionStart?: unknown
    selectionEnd?: unknown
  } | null
  const input = event as {
    inputType?: unknown
    isComposing?: unknown
  } | null

  const value = typeof field?.value === 'string' ? field.value : ''
  const inputType =
    typeof input?.inputType === 'string' ? input.inputType : undefined
  const isComposing = input?.isComposing === true

  try {
    const start =
      typeof field?.selectionStart === 'number' ? field.selectionStart : null
    const end =
      typeof field?.selectionEnd === 'number' ? field.selectionEnd : start
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      inputType,
      isComposing,
    }
  } catch {
    return {
      value,
      selectionStart: null,
      selectionEnd: null,
      inputType,
      isComposing,
    }
  }
}

const SELECTABLE_INPUT_TYPES = /^(|text|search|password|tel|url)$/i

/**
 * Restores the caret of the combobox input.
 *
 * @remarks
 *   Port of Ariakit's `setSelectionRange`, called from a microtask after the
 *   value is written: "When the value is not set synchronously, the selection
 *   range may be lost." A value that reaches the element through a framework
 *   render resets the caret to the end, so the offsets have to be re-applied.
 *
 *   The input-type guard is Ariakit's; `setSelectionRange` throws on a `number`
 *   or `email` input.
 */
export const setComboboxInputCaret = (
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

/**
 * Whether focus left every one of `elements` — the condition Ariakit's
 * `isFocusEventOutside` expresses for the combobox input _and_ its list
 * together.
 *
 * @remarks
 *   Focus moving from the input into the list, or between two items of the list,
 *   must not commit the inline completion: the user is still choosing. Only a
 *   `relatedTarget` outside both elements is a real blur of the widget.
 *
 *   A `relatedTarget` of `null` — focus went to the page, or to another window —
 *   counts as outside, which is Ariakit's behavior too.
 */
export const isFocusLeavingCombobox = (
  relatedTarget: unknown,
  elements: ReadonlyArray<HTMLElement | null>,
): boolean => {
  const next = relatedTarget as Node | null
  if (!next) return true
  return !elements.some(
    (element) =>
      !!element &&
      (element === next ||
        (typeof element.contains === 'function' && element.contains(next))),
  )
}
