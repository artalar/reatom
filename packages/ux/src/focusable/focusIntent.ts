/**
 * Pure focus policy: keyboard modality, focus-visible transitions and the
 * `tabIndex` matrix.
 *
 * Layer 1. Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-solid-components/src/focusable/focusable.tsx` (and its
 * React twin `packages/ariakit-react-components/src/focusable/focusable.tsx`),
 * which has no store — everything below is component-local state and
 * module-level globals there.
 */

import type { ElementDescriptor } from '../interactions/element'
import { BUTTON_INPUT_TYPES } from '../interactions/element'

// --- keyboard modality ------------------------------------------------------

/** Plain-data event that can change the global keyboard modality. */
export type ModalityEvent =
  | {
      type: 'keydown'
      metaKey?: boolean
      ctrlKey?: boolean
      altKey?: boolean
    }
  | {
      type: 'pointerdown'
      /** Whether `event.target` already carries `data-focus-visible`. */
      focusVisibleTarget?: boolean
    }

/**
 * Next value of the global keyboard-modality flag, or `null` to keep the
 * current one.
 *
 * Port of Ariakit's module-level `onGlobalKeyDown` / `onGlobalMouseDown`. Two
 * asymmetries are load-bearing:
 *
 * - A `keydown` with a modifier held is an OS or browser shortcut (`Cmd+Tab`,
 *   `Ctrl+R`), not site navigation, so it must not flip modality back to
 *   keyboard;
 * - Clicking an element that is _already_ focus-visible keeps keyboard modality,
 *   so a keyboard-focused control does not lose its ring when it is clicked.
 *
 * @example
 *   mapModalityIntent({ type: 'pointerdown' }) // false
 *   mapModalityIntent({ type: 'pointerdown', focusVisibleTarget: true }) // null
 *   mapModalityIntent({ type: 'keydown' }) // true
 *   mapModalityIntent({ type: 'keydown', metaKey: true }) // null
 */
export const mapModalityIntent = (event: ModalityEvent): boolean | null => {
  if (event.type === 'keydown') {
    if (event.metaKey || event.ctrlKey || event.altKey) return null
    return true
  }
  if (event.focusVisibleTarget) return null
  return false
}

// --- focus-visible ----------------------------------------------------------

/**
 * `input` types that are always focus-visible: they accept text, so the caret
 * has to be discoverable however focus arrived.
 */
export const ALWAYS_FOCUS_VISIBLE_INPUT_TYPES: ReadonlyArray<string> = [
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'number',
  'date',
  'month',
  'week',
  'time',
  'datetime',
  'datetime-local',
]

/**
 * `true` when the element must show focus even when focus arrived by pointer.
 *
 * Port of Ariakit's `isAlwaysFocusVisible`. The `role="combobox"` plus
 * `data-name` case is Ariakit's own custom Select rendered inside a form.
 */
export const isAlwaysFocusVisible = (
  element?: ElementDescriptor | null,
): boolean => {
  if (!element) return false
  if (element.tagName === 'textarea' && !element.readOnly) return true
  if (element.tagName === 'select' && !element.readOnly) return true
  if (element.tagName === 'input' && !element.readOnly) {
    return ALWAYS_FOCUS_VISIBLE_INPUT_TYPES.includes(element.type ?? '')
  }
  if (element.contentEditable) return true
  if (element.role === 'combobox' && element.dataName) return true
  return false
}

/**
 * `true` for controls that submit a form natively.
 *
 * Port of Ariakit's `isNativeSubmitControl`. React's `useFormStatus` can lose
 * the pending state when component state changes while a native submit control
 * is pending, which is why the React and Solid bindings deliberately skip the
 * `focusVisible` state update for these elements and only set the DOM
 * attribute. `@reatom/ux` has no render cycle to lose, so the model always
 * updates its state; this predicate is exported so a React adapter can
 * reproduce the original workaround if it needs to.
 */
export const isNativeSubmitControl = (
  element?: ElementDescriptor | null,
): boolean => {
  if (!element) return false
  if (element.tagName === 'button') return element.type === 'submit'
  if (element.tagName === 'input') {
    return element.type === 'submit' || element.type === 'image'
  }
  return false
}

/** Plain-data event that can change an element's focus-visible state. */
export interface FocusVisibleEvent {
  /** Which handler the event came from. */
  type: 'keydown' | 'focus' | 'blur'
  /** `event.defaultPrevented` — a consumer already handled it. */
  defaultPrevented?: boolean
  /** `KeyboardEvent.metaKey`. */
  metaKey?: boolean
  /** `KeyboardEvent.ctrlKey`. */
  ctrlKey?: boolean
  /** `KeyboardEvent.altKey`. */
  altKey?: boolean
  /** `isSelfTarget(event)` — `false` when focus went to a child element. */
  selfTarget?: boolean
  /**
   * `isFocusEventOutside(event)` for a `blur`: `false` when focus only moved to
   * a descendant, which is not a real focus loss.
   */
  focusOutside?: boolean
  /** Descriptor of `event.target`, used by {@link isAlwaysFocusVisible}. */
  target?: ElementDescriptor
}

/** Options and current state the focus-visible policy reads. */
export interface FocusVisibleContext {
  /**
   * Whether the `Focusable` features are active at all.
   *
   * @default true
   */
  focusable?: boolean
  /**
   * Whether the element is already focus-visible.
   *
   * @default false
   */
  focusVisible?: boolean
  /**
   * The global keyboard-modality flag.
   *
   * @default true
   */
  keyboardModality?: boolean
}

/**
 * What a focus-related event means for the element's focus-visible state.
 *
 * - `'none'` — leave the state alone;
 * - `'apply'` — show the focus ring, but only after the DOM layer confirms the
 *   element still has focus (Ariakit defers this before `focusout`);
 * - `'clear'` — hide the focus ring immediately.
 */
export type FocusVisibleIntent = 'none' | 'apply' | 'clear'

/**
 * Maps a focus-related event to a {@link FocusVisibleIntent}.
 *
 * This is Ariakit's `onKeyDownCapture` / `onFocusCapture` / `onBlur` policy as
 * a pure function.
 *
 * @example
 *   // pointer focus on a plain button: no ring
 *   mapFocusVisibleIntent({ type: 'focus' }, { keyboardModality: false })
 *   // 'clear'
 *
 * @example
 *   // pointer focus on a text input: ring anyway, the caret must be visible
 *   mapFocusVisibleIntent(
 *     { type: 'focus', target: { tagName: 'input', type: 'text' } },
 *     { keyboardModality: false },
 *   )
 *   // 'apply'
 */
export const mapFocusVisibleIntent = (
  event: FocusVisibleEvent,
  context: FocusVisibleContext = {},
): FocusVisibleIntent => {
  const {
    focusable = true,
    focusVisible = false,
    keyboardModality = true,
  } = context

  // Turning `focusable` off removes every added feature, including this one.
  if (!focusable) return 'none'

  if (event.type === 'blur') {
    // Focus moving to a descendant (or through a portal) is not a focus loss.
    return event.focusOutside === false ? 'none' : 'clear'
  }

  if (event.defaultPrevented) return 'none'

  if (event.type === 'keydown') {
    if (focusVisible) return 'none'
    // Modifier chords are shortcuts, not interaction with this element.
    if (event.metaKey || event.ctrlKey || event.altKey) return 'none'
    if (event.selfTarget === false) return 'none'
    return 'apply'
  }

  // `focus` bubbling up from a child means this element is not the one focused.
  if (event.selfTarget === false) return 'clear'
  if (keyboardModality || isAlwaysFocusVisible(event.target)) return 'apply'
  return 'clear'
}

// --- tabIndex ---------------------------------------------------------------

/**
 * `true` for tags that are focusable without a `tabindex` attribute.
 *
 * Port of Ariakit's `isNativeTabbable`. An unknown tag (no element attached
 * yet) is optimistically treated as tabbable, matching Ariakit's `if (!tagName)
 * return true`.
 */
export const isNativeTabbable = (tagName?: string): boolean => {
  if (!tagName) return true
  return (
    tagName === 'button' ||
    tagName === 'summary' ||
    tagName === 'input' ||
    tagName === 'select' ||
    tagName === 'textarea' ||
    tagName === 'a'
  )
}

/**
 * `true` for tags that honour the native `disabled` attribute.
 *
 * Port of Ariakit's `supportsDisabledAttribute`. Notably `<a>`, `<audio>` and
 * `<video>` do not, which is why they need an explicit `tabIndex={-1}` when
 * disabled.
 */
export const supportsDisabledAttribute = (tagName?: string): boolean => {
  if (!tagName) return true
  return (
    tagName === 'button' ||
    tagName === 'input' ||
    tagName === 'select' ||
    tagName === 'textarea'
  )
}

/**
 * `true` when Safari needs an explicit `tabIndex` for the element to receive
 * focus on `mousedown`.
 *
 * Port of Ariakit's `needsSafariTabIndex`: buttons plus button-like, checkbox
 * and radio inputs.
 */
export const needsSafariTabIndex = (
  tagName?: string,
  inputType?: string,
): boolean => {
  if (tagName === 'button') return true
  if (tagName === 'input' && inputType) {
    if (inputType === 'checkbox' || inputType === 'radio') return true
    return BUTTON_INPUT_TYPES.includes(inputType)
  }
  return false
}

/** Inputs of the {@link getFocusableTabIndex} decision table. */
export interface FocusableTabIndexParams {
  /** Whether the `Focusable` features are active. */
  focusable: boolean
  /** Disabled and not `accessibleWhenDisabled`. */
  trulyDisabled: boolean
  /** {@link isNativeTabbable} for the attached element. */
  nativeTabbable: boolean
  /** {@link supportsDisabledAttribute} for the attached element. */
  supportsDisabled: boolean
  /** {@link needsSafariTabIndex} for the attached element, on Safari only. */
  safariTabIndex: boolean
  /** The `tabIndex` the consumer asked for, if any. */
  tabIndex?: number
}

/**
 * The `tabIndex` a focusable element must render.
 *
 * Port of Ariakit's `getTabIndex`. `undefined` means "render no `tabindex`
 * attribute", which is different from `0`.
 *
 * @example
 *   // a custom button is not natively tabbable, so it needs tabIndex 0
 *   getFocusableTabIndex({
 *     focusable: true,
 *     trulyDisabled: false,
 *     nativeTabbable: false,
 *     supportsDisabled: false,
 *     safariTabIndex: false,
 *   })
 *   // 0
 */
export const getFocusableTabIndex = ({
  focusable,
  trulyDisabled,
  nativeTabbable,
  supportsDisabled,
  safariTabIndex,
  tabIndex,
}: FocusableTabIndexParams): number | undefined => {
  if (!focusable) return tabIndex
  if (trulyDisabled) {
    // Anchor, audio and video tags ignore `disabled`, so they need an explicit
    // `tabIndex={-1}` to stay out of the tab order.
    if (nativeTabbable && !supportsDisabled) return -1
    // Elements honouring `disabled` are already unreachable.
    return undefined
  }
  if (nativeTabbable) {
    // On Safari, buttons and button-like inputs (checkbox, radio, submit,
    // reset, …) only receive focus on `mousedown` with an explicit `tabIndex`.
    if (safariTabIndex && tabIndex == null) return 0
    return tabIndex
  }
  // An enabled element that is not natively tabbable must fall back to 0.
  return tabIndex ?? 0
}
