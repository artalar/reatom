/**
 * Layer 2 for `focusable`: the reactive prop record.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-solid-components/src/focusable/focusable.tsx`.
 */

import type { Computed } from '@reatom/core'
import { computed, notify, wrap } from '@reatom/core'

import {
  applyFocusVisible,
  clearFocusVisible,
  connectFocusable,
  describeFocusEvent,
} from './focusableDom'
import type { FocusableModel } from './reatomFocusable'

/** Attributes and handlers a focusable element needs. */
export interface FocusableElementProps {
  'data-focus-visible': true | undefined
  'data-autofocus': true | undefined
  'aria-disabled': true | undefined
  tabIndex: number | undefined
  disabled: true | undefined
  style: { pointerEvents: 'none' } | undefined
  ref: (element: HTMLElement | null) => void
  onKeyDown: (event: KeyboardEvent) => void
  onFocus: (event: FocusEvent) => void
  onBlur: (event: FocusEvent) => void
}

/** Prop record produced by {@link focusableProps}. */
export interface FocusableProps {
  /** Props for the focusable element itself. */
  element: Computed<FocusableElementProps>
}

/**
 * Reactive prop record for a focusable element.
 *
 * The handlers correspond to Ariakit's capture-phase `onKeyDownCapture` and
 * `onFocusCapture`, plus a bubbling `onBlur` — Ariakit notes that
 * `onBlurCapture` breaks composite items using virtual focus, so blur must stay
 * on the bubble phase. Consumers that need the capture phase should bind these
 * with `{ capture: true }`.
 *
 * `disabled` and `tabIndex` are `undefined` rather than absent when they must
 * not be rendered, so a spread cannot fall back to a stale consumer value.
 *
 * @example
 *   const focusable = reatomFocusable({ name: 'saveButton' })
 *   const props = focusableProps(focusable)
 *   // @reatom/jsx: <button $spread={props.element} />
 */
export const focusableProps = (
  model: FocusableModel,
  name: string = model.name,
): FocusableProps => {
  let disconnect: (() => void) | undefined

  return {
    element: computed(
      () => ({
        'data-focus-visible': (model.focusable() && model()) || undefined,
        'data-autofocus': model.autoFocus() || undefined,
        'aria-disabled': model.ariaDisabled() || undefined,
        tabIndex: model.tabIndex(),
        disabled:
          model.supportsDisabled() && model.trulyDisabled()
            ? (true as const)
            : undefined,
        // A truly disabled element must not react to the pointer at all; the
        // consumer's own `style` is merged on top by the view layer.
        style: model.trulyDisabled()
          ? ({ pointerEvents: 'none' } as const)
          : undefined,
        ref: wrap((element: HTMLElement | null) => {
          disconnect?.()
          disconnect = element ? connectFocusable(model, element) : undefined
          notify()
        }),
        onKeyDown: wrap((event: KeyboardEvent) => {
          const intent = model.keyDown(describeFocusEvent(event, 'keydown'))
          if (intent === 'apply') {
            applyFocusVisible(model, event.currentTarget as HTMLElement | null)
          }
          notify()
        }),
        onFocus: wrap((event: FocusEvent) => {
          const intent = model.focus(describeFocusEvent(event, 'focus'))
          if (intent === 'apply') {
            applyFocusVisible(model, event.currentTarget as HTMLElement | null)
          }
          if (intent === 'clear') {
            clearFocusVisible(model, event.currentTarget as HTMLElement | null)
          }
          notify()
        }),
        onBlur: wrap((event: FocusEvent) => {
          const intent = model.blur(describeFocusEvent(event, 'blur'))
          // The attribute is removed here rather than left to a re-render,
          // because on lower-end devices the render can be skipped entirely.
          if (intent === 'clear') {
            clearFocusVisible(model, event.currentTarget as HTMLElement | null)
          }
          notify()
        }),
      }),
      `${name}.props.element`,
    ),
  }
}
