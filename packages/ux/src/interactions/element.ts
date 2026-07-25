/**
 * Plain-data element descriptors shared by the `command` and `focusable`
 * models.
 *
 * Layer 1 (pure). Ariakit's `command.tsx` and `focusable.tsx` read
 * `event.currentTarget` directly inside their handlers, which couples every
 * decision to a live DOM node. Here the element is first reduced to a plain
 * record (see `describeElement` in
 * [`describeElement.ts`](./describeElement.ts)) so all the interaction policy
 * stays pure and node-testable.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): `packages/ariakit-utils/src/dom.ts`,
 * `packages/ariakit-utils/src/misc.ts`,
 * `packages/ariakit-solid-components/src/command/command.tsx`,
 * `packages/ariakit-solid-components/src/focusable/focusable.tsx`.
 */

/**
 * Plain-data snapshot of the element an interaction happened on.
 *
 * Every field except {@link ElementDescriptor.tagName} is optional so tests can
 * describe the minimum an assertion needs (`{ tagName: 'div' }` is a valid
 * custom button).
 */
export interface ElementDescriptor {
  /** Lowercased tag name, e.g. `'button'`, `'input'`, `'div'`. */
  tagName: string
  /** The `type` property of an `input` or `button` element. */
  type?: string
  /** The element's own `disabled` property. */
  disabled?: boolean
  /** The element's `aria-disabled` attribute, as authored. */
  ariaDisabled?: boolean | 'true' | 'false' | null
  /** The `readOnly` property of a form control. */
  readOnly?: boolean
  /** `element.isContentEditable`. */
  contentEditable?: boolean
  /**
   * `true` when text can be selected inside the element.
   *
   * Ariakit derives this from `selectionStart !== null` inside a `try`/`catch`
   * instead of an input-type allowlist, because Safari throws on non-text
   * inputs and the set of types supporting the selection API keeps changing.
   * The probe is a DOM read, so it is captured here as a boolean.
   */
  textField?: boolean
  /** The `role` attribute. */
  role?: string | null
  /**
   * The `data-name` dataset entry. Ariakit's custom Select inside a form
   * renders `role="combobox"` plus `data-name`, which is how `focusable`
   * recognizes it as an always-focus-visible control.
   */
  dataName?: string | null
  /** `true` when the element already carries the `data-focus-visible` flag. */
  focusVisible?: boolean
}

/**
 * `input` types that behave like a button — clicking them activates rather than
 * edits, so `isButton` treats them as native clickable elements.
 */
export const BUTTON_INPUT_TYPES: ReadonlyArray<string> = [
  'button',
  'color',
  'file',
  'image',
  'reset',
  'submit',
]

/**
 * Checks whether the descriptor denotes a native HTML button.
 *
 * Port of Ariakit's `isButton` (`ariakit-utils/src/dom.ts`): `<button>` and
 * button-like `<input>`s qualify, `<div role="button">` and text inputs do
 * not.
 *
 * @example
 *   isButtonDescriptor({ tagName: 'button' }) // true
 *   isButtonDescriptor({ tagName: 'input', type: 'submit' }) // true
 *   isButtonDescriptor({ tagName: 'input', type: 'text' }) // false
 *   isButtonDescriptor({ tagName: 'div', role: 'button' }) // false
 */
export const isButtonDescriptor = (element: ElementDescriptor): boolean => {
  if (element.tagName === 'button') return true
  if (element.tagName === 'input' && element.type) {
    return BUTTON_INPUT_TYPES.includes(element.type)
  }
  return false
}

/**
 * Checks whether the descriptor is disabled, natively or via ARIA.
 *
 * Merges Ariakit's `disabledFromProps` and `disabledFromElement`
 * (`ariakit-utils/src/misc.ts`): `aria-disabled` counts as disabled so the
 * behavior works on elements that ignore the native `disabled` attribute.
 */
export const isDisabledDescriptor = (element: ElementDescriptor): boolean => {
  if (element.disabled) return true
  return element.ariaDisabled === true || element.ariaDisabled === 'true'
}

/** Minimal shape of a DOM event needed to tell self-targeted events apart. */
export interface EventTargetsLike {
  target: unknown
  currentTarget: unknown
}

/**
 * `true` when the event was fired on the element that handles it, rather than
 * bubbling up from a child.
 *
 * Port of Ariakit's `isSelfTarget` (`ariakit-utils/src/events.ts`). Both
 * `command` (a keypress inside a nested input must not activate the button) and
 * `focusable` (focus moving into a child must not show the parent's focus ring)
 * depend on it.
 */
export const isSelfTarget = (event: EventTargetsLike): boolean =>
  event.target === event.currentTarget
