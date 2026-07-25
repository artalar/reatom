/**
 * Layer 2 for `focusable`: global modality listeners, element attachment, the
 * deferred focus-visible apply, and the improved `autoFocus`.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-solid-components/src/focusable/focusable.tsx`,
 * `packages/ariakit-utils/src/focus.ts`,
 * `packages/ariakit-utils/src/platform.ts`.
 */

import { onEvent, wrap } from '@reatom/core'

import { describeElement } from '../interactions/describeElement'
import { isSelfTarget } from '../interactions/element'
import { queueBeforeEvent } from '../interactions/queueBeforeEvent'
import type { FocusVisibleEvent } from './focusIntent'
import type { FocusableEvent, FocusableModel } from './reatomFocusable'
import type { FocusVisibleModel } from './reatomFocusVisible'
import { keyboardModality } from './reatomFocusVisible'

/** `true` in a browser, `false` during SSR. Port of Ariakit's `canUseDOM`. */
export const canUseDOM = (): boolean =>
  typeof window !== 'undefined' && !!window.document?.createElement

/** Port of Ariakit's `isApple` (`ariakit-utils/src/platform.ts`). */
export const isApple = (): boolean =>
  canUseDOM() && /mac|iphone|ipad|ipod/i.test(navigator.platform)

/** Port of Ariakit's `isSafari`. Safari needs the explicit-`tabIndex` fix. */
export const isSafari = (): boolean =>
  canUseDOM() && isApple() && /apple/i.test(navigator.vendor)

const FOCUSABLE_SELECTOR =
  "input:not([type='hidden']):not([disabled]), select:not([disabled]), " +
  'textarea:not([disabled]), a[href], button:not([disabled]), [tabindex], ' +
  'summary, iframe, object, embed, area[href], audio[controls], ' +
  "video[controls], [contenteditable]:not([contenteditable='false'])"

/** Port of Ariakit's `isVisible` (`ariakit-utils/src/dom.ts`). */
const isVisible = (element: Element): boolean => {
  if (typeof element.checkVisibility === 'function') {
    return element.checkVisibility()
  }
  const html = element as HTMLElement
  return (
    html.offsetWidth > 0 ||
    html.offsetHeight > 0 ||
    element.getClientRects().length > 0
  )
}

/**
 * `true` when the element can receive focus right now.
 *
 * Port of Ariakit's `isFocusable` (`ariakit-utils/src/focus.ts`).
 */
export const isFocusable = (element: Element): boolean => {
  if (!element.matches(FOCUSABLE_SELECTOR)) return false
  if (!isVisible(element)) return false
  if (element.closest('[inert]')) return false
  return true
}

/**
 * `true` when the element has focus, including through `aria-activedescendant`.
 *
 * Port of Ariakit's `hasFocus` (`ariakit-utils/src/focus.ts`).
 */
export const hasFocus = (element: Element): boolean => {
  const activeElement = element.ownerDocument.activeElement
  if (!activeElement) return false
  if (activeElement === element) return true
  const activeDescendant = activeElement.getAttribute('aria-activedescendant')
  return !!activeDescendant && activeDescendant === element.id
}

/**
 * `true` when focus is leaving the container entirely rather than moving to a
 * descendant.
 *
 * Port of Ariakit's `isFocusEventOutside` (`ariakit-utils/src/events.ts`).
 */
export const isFocusEventOutside = (
  event: Pick<FocusEvent, 'currentTarget' | 'relatedTarget'>,
  container?: Element | null,
): boolean => {
  const element = container ?? (event.currentTarget as Element | null)
  const relatedTarget = event.relatedTarget as Node | null
  if (!element) return true
  if (!relatedTarget) return true
  return element !== relatedTarget && !element.contains(relatedTarget)
}

const modalityListeners = new WeakMap<FocusVisibleModel, () => void>()

/**
 * Wires a keyboard-modality model to the document.
 *
 * Both listeners are installed in the capture phase, so modality is already up
 * to date by the time an element's own `focus` handler runs — a `mousedown`
 * must be able to suppress the ring for the focus it is about to cause.
 *
 * Repeated calls for the same model reuse the existing listeners, matching
 * Ariakit's `hasInstalledGlobalEventListeners` guard: every focusable element
 * asks for them, only the first one installs them.
 *
 * Unlike Ariakit's `addGlobalEventListener`, child frames are not covered; a
 * frame needs its own model and its own call.
 *
 * @param model - Model to update; defaults to the shared `keyboardModality`.
 * @returns A function that removes the listeners.
 */
export const connectKeyboardModality = (
  model: FocusVisibleModel = keyboardModality,
): (() => void) => {
  const installed = modalityListeners.get(model)
  if (installed) return installed

  if (!canUseDOM()) return () => {}

  const unsubscribeKeyDown = onEvent(
    document,
    'keydown',
    (event) => {
      model.keyDown({
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
      })
    },
    { capture: true },
  )
  const unsubscribeMouseDown = onEvent(
    document,
    'mousedown',
    (event) => {
      const target = event.target as Element | null
      model.pointerDown({
        focusVisibleTarget:
          !!target &&
          'hasAttribute' in target &&
          target.hasAttribute('data-focus-visible'),
      })
    },
    { capture: true },
  )

  const unsubscribe = () => {
    unsubscribeKeyDown()
    unsubscribeMouseDown()
    modalityListeners.delete(model)
  }

  modalityListeners.set(model, unsubscribe)

  return unsubscribe
}

/** Reduces a real focus or key event to the plain data the model consumes. */
export const describeFocusEvent = (
  event: KeyboardEvent | FocusEvent,
  type: FocusVisibleEvent['type'],
): FocusableEvent => {
  const target = event.target as Element | null
  return {
    defaultPrevented: event.defaultPrevented,
    metaKey: 'metaKey' in event ? event.metaKey : undefined,
    ctrlKey: 'ctrlKey' in event ? event.ctrlKey : undefined,
    altKey: 'altKey' in event ? event.altKey : undefined,
    selfTarget: isSelfTarget(event),
    focusOutside:
      type === 'blur' ? isFocusEventOutside(event as FocusEvent) : undefined,
    target: target ? describeElement(target) : undefined,
  }
}

/**
 * Carries out an `'apply'` focus-visible intent.
 *
 * The apply is queued before `focusout` rather than run inline for two reasons
 * Ariakit documents: password managers such as 1Password dispatch synthetic
 * `keydown` events on autofill and immediately move focus away, so the element
 * must be re-checked for focus; and deferring lets `data-focus-visible` land in
 * the same paint as sibling attributes such as `data-active-item`
 * ([ariakit#4083](https://github.com/ariakit/ariakit/issues/4083)).
 *
 * @returns A cancel function, or `undefined` when there was nothing to do.
 */
export const applyFocusVisible = (
  model: FocusableModel,
  element: HTMLElement | null = model.element(),
): (() => void) | undefined => {
  if (!element) return
  return queueBeforeEvent(element, 'focusout', () => {
    if (!hasFocus(element)) return
    // Ariakit sets the attribute imperatively so it is visible to CSS even
    // before a renderer reacts to the state change.
    element.dataset.focusVisible = 'true'
    model.show()
  })
}

/** Removes the imperative `data-focus-visible` marker. */
export const clearFocusVisible = (
  model: FocusableModel,
  element: HTMLElement | null = model.element(),
): void => {
  element?.removeAttribute('data-focus-visible')
  model.hide()
}

/**
 * Attaches a DOM element to a focusable model.
 *
 * Handles the three things that cannot be expressed in Layer 1:
 *
 * - The element snapshot (`descriptor`) and the Safari flag the `tabIndex`
 *   derivation needs;
 * - The improved `autoFocus`: the native attribute fires its focus event before
 *   refs and effects are assigned, so focus is queued in a microtask to let
 *   other attachments land first;
 * - A hidden element fires no `blur`, so while the ring is on the element is
 *   observed and the ring cleared as soon as it stops being focusable.
 *
 * @returns A cleanup function; call it when the element is detached.
 */
export const connectFocusable = (
  model: FocusableModel,
  element: HTMLElement,
): (() => void) => {
  connectKeyboardModality(model.modality)

  model.element.set(element)
  model.descriptor.set(describeElement(element))
  model.safari.set(isSafari())

  if (model.focusable() && model.autoFocus()) {
    queueMicrotask(
      wrap(() => {
        if (hasFocus(element)) return
        if (!isFocusable(element)) return
        element.focus()
      }),
    )
  }

  let observer: IntersectionObserver | undefined
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(
      wrap(() => {
        if (!model()) return
        if (isFocusable(element)) return
        clearFocusVisible(model, element)
      }),
    )
    observer.observe(element)
  }

  return () => {
    observer?.disconnect()
    if (model.element() === element) {
      model.element.set(null)
      model.descriptor.set(null)
    }
  }
}
