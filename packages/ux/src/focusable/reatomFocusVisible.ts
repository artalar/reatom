/**
 * Global keyboard-modality model.
 *
 * Layer 1. Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-solid-components/src/focusable/focusable.tsx`, where the
 * flag is a module-level `let isKeyboardModality = true` maintained by two
 * global capture listeners installed once by the first `Focusable` to mount.
 */

import type { Action, Atom } from '@reatom/core'
import { atom, named, withActions } from '@reatom/core'

import type { ModalityEvent } from './focusIntent'
import { mapModalityIntent } from './focusIntent'

/** A `keydown` reduced to the fields the modality policy reads. */
export type ModalityKeyEvent = Omit<ModalityEvent & { type: 'keydown' }, 'type'>

/** A `mousedown` / `pointerdown` reduced to the fields the policy reads. */
export type ModalityPointerEvent = Omit<
  ModalityEvent & { type: 'pointerdown' },
  'type'
>

/** Options for {@link reatomFocusVisible}. */
export interface FocusVisibleOptions {
  /**
   * Initial modality. Ariakit starts in keyboard modality on purpose: before
   * any interaction happens, focus arriving programmatically (a dialog opening,
   * an autofocused field) should be visible.
   *
   * @default true
   */
  keyboardModality?: boolean
  /** Name of the atom. */
  name?: string
}

/**
 * Model returned by {@link reatomFocusVisible}. Reading it tells whether the
 * user is currently navigating with the keyboard.
 */
export interface FocusVisibleModel extends Atom<boolean> {
  /** Feeds a `keydown` into the modality policy; returns the applied value. */
  keyDown: Action<[event?: ModalityKeyEvent], boolean | null>
  /** Feeds a `mousedown` into the modality policy; returns the applied value. */
  pointerDown: Action<[event?: ModalityPointerEvent], boolean | null>
}

/**
 * Creates the global keyboard-modality atom that decides whether focus should
 * be _visible_.
 *
 * This is Layer 1 only: it holds the flag and the transitions, but installs no
 * listeners. Attach `withGlobalModality()` from
 * [`focusableDom.ts`](./focusableDom.ts) — or use the shared `keyboardModality`
 * instance exported there — to wire it to the document.
 *
 * @example
 *   const modality = reatomFocusVisible({ name: 'app.modality' })
 *
 *   modality.pointerDown({}) // a plain click
 *   modality() // false
 *   modality.keyDown({}) // Tab, an arrow key, …
 *   modality() // true
 *
 * @param options - See {@link FocusVisibleOptions}.
 */
export const reatomFocusVisible = (
  options: FocusVisibleOptions = {},
): FocusVisibleModel => {
  const { keyboardModality: init = true, name = named('focusVisible') } =
    options

  return atom(init, name).extend(
    withActions((target) => ({
      keyDown: (event: ModalityKeyEvent = {}) => {
        const next = mapModalityIntent({ ...event, type: 'keydown' })
        if (next !== null) target.set(next)
        return next
      },
      pointerDown: (event: ModalityPointerEvent = {}) => {
        const next = mapModalityIntent({ ...event, type: 'pointerdown' })
        if (next !== null) target.set(next)
        return next
      },
    })),
  )
}

/**
 * The process-wide modality flag every {@link reatomFocusable} uses by default.
 *
 * Modality is a property of the user, not of a widget, so Ariakit keeps a
 * single module-level flag. Pass a dedicated model through `reatomFocusable({
 * modality })` in tests, or to scope modality to one document (an iframe, an
 * embedded editor).
 */
export const keyboardModality: FocusVisibleModel = reatomFocusVisible({
  name: 'keyboardModality',
})
