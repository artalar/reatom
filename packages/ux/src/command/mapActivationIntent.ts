/**
 * Pure keyboard-activation policy for command (button-like) elements.
 *
 * Layer 1. Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-solid-components/src/command/command.tsx` (and its React
 * twin `packages/ariakit-react-components/src/command/command.tsx`), which has
 * no store — the whole behavior lives in the component's `onKeyDown` /
 * `onKeyUp` handlers. This module extracts that policy as a total function over
 * plain data.
 */

import type { ElementDescriptor } from '../interactions/element'
import { isButtonDescriptor } from '../interactions/element'

/**
 * `true` for the space key.
 *
 * Ariakit matches `' '` only. `'Spacebar'` is the legacy key name still
 * reported by old Edge and IE, and Chromvoid's `headless-ui` accepts it; the
 * alias is a deliberate superset of the Ariakit behavior.
 */
export const isActivationSpaceKey = (key: string): boolean =>
  key === ' ' || key === 'Spacebar'

/** Plain-data key event the activation policy reads. */
export interface CommandActivationEvent {
  /** Which handler the event came from. */
  type: 'keydown' | 'keyup'
  /** `KeyboardEvent.key`. */
  key: string
  /** `KeyboardEvent.defaultPrevented` — a consumer already handled the key. */
  defaultPrevented?: boolean
  /**
   * `KeyboardEvent.isTrusted`. Only trusted events make the browser fire its
   * own click, so script-dispatched keys always take the synthetic path.
   */
  isTrusted?: boolean
  /** `KeyboardEvent.metaKey`. */
  metaKey?: boolean
  /** `isSelfTarget(event)` — `false` when the key came from a child element. */
  selfTarget?: boolean
  /**
   * Descriptor of `event.currentTarget`. When omitted the element is treated as
   * a non-native clickable (the `<div role="button">` case), which is the
   * situation the whole module exists for.
   */
  element?: ElementDescriptor
}

/** Options and current model state the activation policy reads. */
export interface CommandActivationContext {
  /**
   * Whether `Enter` activates the element.
   *
   * @default true
   */
  clickOnEnter?: boolean
  /**
   * Whether pressing and releasing space activates the element.
   *
   * @default true
   */
  clickOnSpace?: boolean
  /**
   * Disabled commands ignore keys entirely.
   *
   * @default false
   */
  disabled?: boolean
  /**
   * Ariakit's `activeRef`: a space `keydown` was already handled by this model.
   * A `keyup` without it must not activate, so focus arriving while space is
   * held cannot fire a click.
   *
   * @default false
   */
  pressed?: boolean
  /**
   * Firefox blocks a `target="_blank"` popup when the click is dispatched
   * synchronously or in a microtask, so on Firefox the `Enter` click waits for
   * `keyup` instead.
   *
   * @default false
   */
  firefox?: boolean
}

/**
 * What the DOM layer must do for a key event, as plain data.
 *
 * `pressed` and `active` are `null` when the flag must keep its current value,
 * which keeps the intent a complete description of the transition without
 * needing to know the previous state.
 */
export interface CommandActivationIntent {
  /** Call `event.preventDefault()`. */
  preventDefault: boolean
  /** Next value of the model's `pressed` flag, or `null` to keep it. */
  pressed: boolean | null
  /** Next value of the model's `active` flag (`data-active`), or `null`. */
  active: boolean | null
  /**
   * When and whether to dispatch a synthetic click:
   *
   * - `'none'` — no click (the browser fires its own, or the key is not an
   *   activation key);
   * - `'microtask'` — `queueMicrotask`;
   * - `'before-keyup'` — next animation frame, or `keyup`, whichever comes first.
   */
  click: 'none' | 'microtask' | 'before-keyup'
}

const IGNORE: CommandActivationIntent = Object.freeze({
  preventDefault: false,
  pressed: null,
  active: null,
  click: 'none',
})

/**
 * `true` when the browser itself will turn this key event into a click, so the
 * command must not dispatch one.
 *
 * Port of Ariakit's `isNativeClick`. `Enter` is native on buttons, `<summary>`
 * and `<a>`; space is native on buttons, `<summary>`, `<input>` and
 * `<select>`.
 */
export const isNativeActivation = (
  event: Pick<CommandActivationEvent, 'key' | 'isTrusted'>,
  element?: ElementDescriptor,
): boolean => {
  if (!event.isTrusted) return false
  if (!element) return false
  if (event.key === 'Enter') {
    return (
      isButtonDescriptor(element) ||
      element.tagName === 'summary' ||
      element.tagName === 'a'
    )
  }
  if (isActivationSpaceKey(event.key)) {
    return (
      isButtonDescriptor(element) ||
      element.tagName === 'summary' ||
      element.tagName === 'input' ||
      element.tagName === 'select'
    )
  }
  return false
}

const mapKeyDownIntent = (
  event: CommandActivationEvent,
  context: Required<Omit<CommandActivationContext, 'pressed'>>,
): CommandActivationIntent => {
  if (event.defaultPrevented) return IGNORE
  if (context.disabled) return IGNORE
  // A key that bubbled up from a child, or that lands in an editable element,
  // belongs to that element — typing a space inside a nested input must not
  // activate the surrounding command.
  if (event.selfTarget === false) return IGNORE
  if (event.element?.textField) return IGNORE
  if (event.element?.contentEditable) return IGNORE

  const isEnterKey = event.key === 'Enter'
  const isSpaceKey = isActivationSpaceKey(event.key)
  if (!isEnterKey && !isSpaceKey) return IGNORE

  // Turning the key off blocks the browser default instead of falling through
  // to it: `clickOnEnter: false` on a native button must not submit a form.
  if (isEnterKey ? !context.clickOnEnter : !context.clickOnSpace) {
    return { preventDefault: true, pressed: null, active: null, click: 'none' }
  }

  const native = isNativeActivation(event, event.element)

  if (isEnterKey) {
    if (native) return IGNORE
    return {
      preventDefault: true,
      pressed: null,
      active: null,
      click: context.firefox ? 'before-keyup' : 'microtask',
    }
  }

  // Space is tracked even on native controls, so a `keyup` can always tell
  // whether its `keydown` was seen here.
  if (native) {
    return { preventDefault: false, pressed: true, active: null, click: 'none' }
  }
  // Space activates on release, so the keydown only marks the element active
  // (`data-active`) and blocks the page from scrolling.
  return { preventDefault: true, pressed: true, active: true, click: 'none' }
}

const mapKeyUpIntent = (
  event: CommandActivationEvent,
  context: Required<CommandActivationContext>,
): CommandActivationIntent => {
  if (!context.pressed) return IGNORE
  if (!context.clickOnSpace || !isActivationSpaceKey(event.key)) return IGNORE

  const native = isNativeActivation(event, event.element)

  // Releasing space always ends the press, before any of the guards below — a
  // keyup that refuses to click must still not leave the element looking
  // pressed (react-components 0.3.1, `command.tsx`: "Clear the active state as
  // soon as Space is released, before all the guards below"). `pressed` is
  // cleared even for native controls, so a stale keydown can never activate a
  // later keyup; `active` is only ever set for non-native ones.
  const release: CommandActivationIntent = {
    preventDefault: false,
    pressed: false,
    active: native ? null : false,
    click: 'none',
  }

  if (event.defaultPrevented) return release
  // The keydown only records the press when it was self-targeted, so a keyup
  // bubbling up from a child that took focus mid-press must not click this
  // element.
  if (event.selfTarget === false) return release
  if (context.disabled) return release
  // Releasing space after a meta shortcut (Cmd+Space and friends) is not an
  // activation.
  if (event.metaKey) return release
  if (native) return release

  return {
    preventDefault: true,
    pressed: false,
    active: false,
    click: 'microtask',
  }
}

/**
 * Maps a key event to the activation transition it should cause.
 *
 * This is the whole of Ariakit's `Command` keyboard behavior as a pure
 * function: `Enter` activates on `keydown`, space activates on `keyup` after a
 * matching `keydown`, and native clickable elements are left to the browser.
 *
 * A space `keyup` always ends the press, whatever the guards decide about the
 * click, so nothing can leave the element stuck with `data-active`. The one
 * release the keyboard never sees — focus moving away while space is held — is
 * `CommandModel.cancel`.
 *
 * @example
 *   // Enter on a custom button dispatches the click ourselves
 *   mapActivationIntent({ type: 'keydown', key: 'Enter', isTrusted: true })
 *   // { preventDefault: true, pressed: null, active: null, click: 'microtask' }
 *
 * @example
 *   // Enter on a native button is left alone
 *   mapActivationIntent({
 *     type: 'keydown',
 *     key: 'Enter',
 *     isTrusted: true,
 *     element: { tagName: 'button' },
 *   })
 *   // { preventDefault: false, pressed: null, active: null, click: 'none' }
 *
 * @param event - The key event, reduced to plain data.
 * @param context - Options plus the model's current `pressed` flag.
 */
export const mapActivationIntent = (
  event: CommandActivationEvent,
  context: CommandActivationContext = {},
): CommandActivationIntent => {
  const {
    clickOnEnter = true,
    clickOnSpace = true,
    disabled = false,
    pressed = false,
    firefox = false,
  } = context

  return event.type === 'keyup'
    ? mapKeyUpIntent(event, {
        clickOnEnter,
        clickOnSpace,
        disabled,
        pressed,
        firefox,
      })
    : mapKeyDownIntent(event, {
        clickOnEnter,
        clickOnSpace,
        disabled,
        firefox,
      })
}

/**
 * Modifier and propagation flags copied from a key event onto the synthetic
 * click.
 *
 * Port of Ariakit's `getClickEventInit`. Native DOM events do not enumerate
 * their own properties the way React's synthetic events do, so a plain spread
 * would drop the modifier state; the non-serializable `view` is dropped on
 * purpose. Without this, `Cmd+Enter` on a link would lose its "open in new tab"
 * meaning.
 */
export interface ActivationClickInit {
  bubbles: boolean
  cancelable: boolean
  composed: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
}

/** Builds the {@link ActivationClickInit} for a synthetic activation click. */
export const getActivationClickInit = (event: {
  bubbles?: boolean
  cancelable?: boolean
  composed?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}): ActivationClickInit => ({
  bubbles: event.bubbles ?? false,
  cancelable: event.cancelable ?? false,
  composed: event.composed ?? false,
  ctrlKey: event.ctrlKey ?? false,
  shiftKey: event.shiftKey ?? false,
  altKey: event.altKey ?? false,
  metaKey: event.metaKey ?? false,
})
