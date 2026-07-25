/**
 * Per-element focusable model: disabled semantics, `tabIndex` and focus-visible
 * state.
 *
 * Layer 1. Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-solid-components/src/focusable/focusable.tsx`, which has no
 * store — the state below is component-local signals there.
 */

import type { Action, Atom, Computed } from '@reatom/core'
import { atom, computed, named, withActions, withComputed } from '@reatom/core'

import type { ElementDescriptor } from '../interactions/element'
import type { FocusVisibleEvent, FocusVisibleIntent } from './focusIntent'
import {
  getFocusableTabIndex,
  isNativeTabbable,
  mapFocusVisibleIntent,
  needsSafariTabIndex,
  supportsDisabledAttribute,
} from './focusIntent'
import type { FocusVisibleModel } from './reatomFocusVisible'
import { keyboardModality } from './reatomFocusVisible'

/** A focus-related event without the `type` field, which the action supplies. */
export type FocusableEvent = Omit<FocusVisibleEvent, 'type'>

/** Options for {@link reatomFocusable}. */
export interface FocusableOptions {
  /**
   * Whether the added `Focusable` features are active. Turning it off leaves
   * native focusability intact but removes the improved `autoFocus`,
   * `accessibleWhenDisabled` and focus-visible tracking.
   *
   * @default true
   */
  focusable?: boolean
  /**
   * Whether the element is disabled. Unlike the native attribute this works on
   * any element, because it is also surfaced as `aria-disabled`.
   *
   * @default false
   */
  disabled?: boolean
  /**
   * Keeps a disabled element reachable by keyboard, so its existence stays
   * discoverable. See [Focusability of disabled
   * controls](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#focusabilityofdisabledcontrols).
   *
   * @default false
   */
  accessibleWhenDisabled?: boolean
  /**
   * Focus the element once it is attached. The native `autofocus` attribute
   * fires before refs and effects are assigned, so the model only records the
   * intent and Layer 2 performs the focus in a microtask.
   *
   * @default false
   */
  autoFocus?: boolean
  /** The `tabIndex` the consumer asked for, if any. */
  tabIndex?: number
  /**
   * Whether the host browser is Safari, where buttons and button-like inputs
   * need an explicit `tabIndex` to receive focus on `mousedown`. Layer 2 sets
   * it from `isSafari()`; Layer 1 stays free of platform sniffing.
   *
   * @default false
   */
  safari?: boolean
  /**
   * Keyboard-modality model to read. Defaults to the shared `keyboardModality`
   * instance, matching Ariakit's single module-level flag.
   */
  modality?: FocusVisibleModel
  /** Name prefix for every unit of the model. */
  name?: string
}

/**
 * Model returned by {@link reatomFocusable}.
 *
 * Reading the model reads `focusVisible` — the state behind Ariakit's
 * `data-focus-visible` attribute and `onFocusVisible` callback.
 */
export interface FocusableModel extends Atom<boolean> {
  /** Whether the added `Focusable` features are active. */
  focusable: Atom<boolean>
  /** Whether the element is disabled. */
  disabled: Atom<boolean>
  /** Whether a disabled element stays keyboard-reachable. */
  accessibleWhenDisabled: Atom<boolean>
  /** Whether the element must be focused once attached. */
  autoFocus: Atom<boolean>
  /** The `tabIndex` the consumer asked for. */
  tabIndexOption: Atom<number | undefined>
  /** Whether Safari's explicit-`tabIndex` workaround applies. */
  safari: Atom<boolean>
  /** The attached DOM node, set from a `ref` by Layer 2. */
  element: Atom<HTMLElement | null>
  /** Plain-data snapshot of {@link FocusableModel.element}. */
  descriptor: Atom<ElementDescriptor | null>
  /** The keyboard-modality model this element reads. */
  modality: FocusVisibleModel
  /** What `aria-disabled` must report: Ariakit's `focusable && disabled`. */
  ariaDisabled: Computed<boolean>
  /** Disabled _and_ not keyboard-reachable: Ariakit's `trulyDisabled`. */
  trulyDisabled: Computed<boolean>
  /** {@link isNativeTabbable} for the attached element. */
  nativeTabbable: Computed<boolean>
  /** {@link supportsDisabledAttribute} for the attached element. */
  supportsDisabled: Computed<boolean>
  /** The `tabIndex` to render; `undefined` means "no attribute". */
  tabIndex: Computed<number | undefined>
  /** Applies a `keydown` and returns the focus-visible intent. */
  keyDown: Action<[event?: FocusableEvent], FocusVisibleIntent>
  /** Applies a `focus` and returns the focus-visible intent. */
  focus: Action<[event?: FocusableEvent], FocusVisibleIntent>
  /** Applies a `blur` and returns the focus-visible intent. */
  blur: Action<[event?: FocusableEvent], FocusVisibleIntent>
  /**
   * Turns focus-visible on. Layer 2 calls it for an `'apply'` intent, after
   * confirming the element still has focus.
   */
  show: Action<[], boolean>
  /** Turns focus-visible off. */
  hide: Action<[], false>
}

/**
 * Creates the focus model of a single element.
 *
 * @example
 *   const focusable = reatomFocusable({ name: 'saveButton' })
 *
 *   focusable.descriptor.set({ tagName: 'div' })
 *   focusable.tabIndex() // 0 — a custom button needs an explicit tab stop
 *
 *   focusable.disabled.set(true)
 *   focusable.ariaDisabled() // true
 *   focusable.tabIndex() // -1 — a div ignores `disabled`, so keep it out of tab
 *
 * @param options - See {@link FocusableOptions}.
 */
export const reatomFocusable = (
  options: FocusableOptions = {},
): FocusableModel => {
  const {
    focusable: initFocusable = true,
    disabled: initDisabled = false,
    accessibleWhenDisabled: initAccessibleWhenDisabled = false,
    autoFocus: initAutoFocus = false,
    tabIndex: initTabIndex,
    safari: initSafari = false,
    modality = keyboardModality,
    name = named('focusable'),
  } = options

  const focusableAtom = atom(initFocusable, `${name}.focusable`)
  const disabled = atom(initDisabled, `${name}.disabled`)
  const accessibleWhenDisabled = atom(
    initAccessibleWhenDisabled,
    `${name}.accessibleWhenDisabled`,
  )
  const autoFocus = atom(initAutoFocus, `${name}.autoFocus`)
  const tabIndexOption = atom(initTabIndex, `${name}.tabIndexOption`)
  const safari = atom(initSafari, `${name}.safari`)
  const element = atom<HTMLElement | null>(null, `${name}.element`)
  const descriptor = atom<ElementDescriptor | null>(null, `${name}.descriptor`)

  const ariaDisabled = computed(
    () => focusableAtom() && disabled(),
    `${name}.ariaDisabled`,
  )
  const trulyDisabled = computed(
    () => ariaDisabled() && !accessibleWhenDisabled(),
    `${name}.trulyDisabled`,
  )

  // A disabled element fires no `blur`, so the focus ring could never be cleared
  // from an event. Ariakit runs an effect that writes `focusVisible = false`;
  // deriving it instead makes the invariant impossible to violate.
  const focusVisible = atom(false, name).extend(
    withComputed((state) => {
      if (!focusableAtom()) return false
      return trulyDisabled() ? false : state
    }),
  )

  const nativeTabbable = computed(
    () => focusableAtom() && isNativeTabbable(descriptor()?.tagName),
    `${name}.nativeTabbable`,
  )
  const supportsDisabled = computed(
    () => focusableAtom() && supportsDisabledAttribute(descriptor()?.tagName),
    `${name}.supportsDisabled`,
  )

  const tabIndex = computed(() => {
    const snapshot = descriptor()
    return getFocusableTabIndex({
      focusable: focusableAtom(),
      trulyDisabled: trulyDisabled(),
      nativeTabbable: nativeTabbable(),
      supportsDisabled: supportsDisabled(),
      safariTabIndex:
        safari() && needsSafariTabIndex(snapshot?.tagName, snapshot?.type),
      tabIndex: tabIndexOption(),
    })
  }, `${name}.tabIndex`)

  const applyIntent = (
    event: FocusableEvent,
    type: FocusVisibleEvent['type'],
  ) => {
    const intent = mapFocusVisibleIntent(
      { ...event, type },
      {
        focusable: focusableAtom(),
        focusVisible: focusVisible(),
        keyboardModality: modality(),
      },
    )
    // `'apply'` is deferred on purpose: Layer 2 has to re-check that the element
    // still has focus before the ring appears.
    if (intent === 'clear') focusVisible.set(false)
    return intent
  }

  return focusVisible
    .extend(() => ({
      focusable: focusableAtom,
      disabled,
      accessibleWhenDisabled,
      autoFocus,
      tabIndexOption,
      safari,
      element,
      descriptor,
      modality,
      ariaDisabled,
      trulyDisabled,
      nativeTabbable,
      supportsDisabled,
      tabIndex,
    }))
    .extend(
      withActions((target) => ({
        keyDown: (event: FocusableEvent = {}) => applyIntent(event, 'keydown'),
        focus: (event: FocusableEvent = {}) => applyIntent(event, 'focus'),
        blur: (event: FocusableEvent = {}) => applyIntent(event, 'blur'),
        show: () => target.set(focusableAtom() && !trulyDisabled()),
        hide: () => target.set(false) as false,
      })),
    )
}
