/**
 * Layer 1 for `tooltip`: the model.
 *
 * A tooltip is a hovercard with three differences: it sits above its anchor by
 * default, it closes the instant the pointer leaves, and it belongs to a page
 * where only one tooltip is active at a time. Ariakit's store says the first
 * two in eight lines and leaves the third to a module-level store maintained
 * from the anchor component; this port keeps all three in the model, so a
 * tooltip is still a boolean atom you can drive from anywhere.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/tooltip/tooltip-store.ts` and the policy
 * Ariakit keeps in `packages/ariakit-react-components/src/tooltip/*`.
 */

import type { AssignerExt, Atom, Computed } from '@reatom/core'
import {
  atom,
  computed,
  named,
  peek,
  retryComputed,
  withChangeHook,
  withComputed,
} from '@reatom/core'

import type { FocusVisibleModel } from '../focusable/reatomFocusVisible'
import { keyboardModality } from '../focusable/reatomFocusVisible'
import type {
  HovercardExtOptions,
  HovercardUnits,
} from '../hovercard/reatomHovercard'
import { withHovercard } from '../hovercard/reatomHovercard'
import type { PopoverPlacement } from '../popover/popoverPlacement'
import type { TooltipPropRecords, TooltipPropsOptions } from './props'
import { withTooltipProps } from './props'
import type {
  TooltipRegistryEntry,
  TooltipRegistryModel,
} from './reatomTooltipRegistry'
import {
  scheduleTooltipRelease,
  tooltipRegistry,
} from './reatomTooltipRegistry'

/**
 * Where a tooltip sits by default (`tooltip-store.ts`: `placement: 'top'`),
 * against the hovercard's `'bottom'`.
 */
export const TOOLTIP_PLACEMENT: PopoverPlacement = 'top'

/**
 * How long a closed tooltip stays active, in milliseconds — the window in which
 * every other tooltip on the page opens without waiting.
 */
export const TOOLTIP_SKIP_TIMEOUT = 300

/** Options accepted by both {@link reatomTooltip} and {@link withTooltip}. */
export interface TooltipExtOptions extends HovercardExtOptions {
  /**
   * Where the tooltip is placed relative to its anchor.
   *
   * @default 'top'
   */
  placement?: PopoverPlacement
  /**
   * How long to wait before hiding, in milliseconds. A tooltip closes at once
   * by default — there is nothing inside it to travel to.
   *
   * @default 0
   */
  hideTimeout?: number
  /**
   * How long a closed tooltip keeps every other tooltip's show delay skipped,
   * in milliseconds.
   *
   * @default 300
   */
  skipTimeout?: number
  /**
   * Whether the tooltip closes when the pointer leaves its anchor. Seeds
   * {@link TooltipUnits.hideOnPointerLeave}; the inherited `hideOnHoverOutside`
   * is derived from it and from {@link TooltipUnits.anchorFocusVisible}.
   *
   * @default true
   */
  hideOnHoverOutside?: boolean
  /**
   * The registry the tooltip competes for. Defaults to the shared
   * {@link tooltipRegistry}; pass your own to isolate a test or a document.
   */
  registry?: TooltipRegistryModel
  /**
   * The keyboard-modality flag that decides whether focus on the anchor is
   * focus-_visible_, and therefore whether it opens the tooltip. Defaults to
   * the shared {@link keyboardModality}.
   */
  modality?: FocusVisibleModel
}

/** Options of the {@link reatomTooltip} factory. */
export interface TooltipOptions extends TooltipExtOptions, TooltipPropsOptions {
  /**
   * Initial `open` state. To adopt a caller-owned atom instead, extend it with
   * {@link withTooltip}.
   *
   * @default false
   */
  open?: boolean
}

/** Units attached by {@link withTooltip}, on top of the hovercard ones. */
export interface TooltipUnits extends HovercardUnits {
  /** How long this tooltip stays active after closing. */
  skipTimeout: Atom<number>
  /**
   * Whether the pointer entered the anchor since the tooltip last closed.
   *
   * @remarks
   *   Ariakit keeps it in a `useRef` and resets it from a `sync` on `mounted`:
   *   "the user hovers over an anchor, which shows a tooltip, then presses
   *   escape to close the tooltip. We don't want to show the tooltip again
   *   while the anchor is still hovered." Here the `anchor` prop record's
   *   `onMouseEnter` arms it and the tooltip closing disarms it, in the same
   *   change hook that maintains the registry.
   */
  canShowOnHover: Atom<boolean>
  /**
   * Whether the anchor currently shows a focus ring.
   *
   * @remarks
   *   Ariakit reads `'focusVisible' in anchorElement.dataset` from inside its
   *   `hideOnHoverOutside` callback — a DOM read in a predicate. The `anchor`
   *   prop record writes this atom instead, so the policy stays pure; a
   *   consumer whose anchor is a `reatomFocusable` can also derive it with
   *   `tooltip.anchorFocusVisible.extend(withComputed(() =>
   *   button.focusVisible()))`.
   */
  anchorFocusVisible: Atom<boolean>
  /**
   * Whether the pointer leaving the anchor closes the tooltip — the consumer's
   * preference, before the focus rule is applied to it.
   */
  hideOnPointerLeave: Atom<boolean>
  /** The registry this tooltip competes for. */
  registry: TooltipRegistryModel
  /** The keyboard-modality flag the anchor's focus handling reads. */
  modality: FocusVisibleModel
  /** Whether this is the registry's active tooltip. */
  active: Computed<boolean>
  /** Whether this tooltip opens without waiting, because another one is active. */
  skipDelay: Computed<boolean>
}

/** A boolean atom extended with the tooltip behavior. */
export interface TooltipModel extends Atom<boolean>, TooltipUnits {}

/**
 * The model returned by {@link reatomTooltip}: {@link TooltipModel} plus prop
 * records.
 */
export interface Tooltip extends TooltipModel {
  /** Reactive prop records for the tooltip's elements. */
  props: TooltipPropRecords
}

/**
 * Adds the tooltip behavior to an existing boolean atom.
 *
 * @remarks
 *   The extension applies {@link withHovercard} itself — Ariakit's
 *   `createTooltipStore` merges `createHovercardStore` into its own state — and
 *   changes four things:
 *
 *   - `placement` defaults to `'top'` and `hideTimeout` to `0`, which is the whole
 *       of Ariakit's tooltip store;
 *   - `hideOnHoverOutside` becomes a derivation of
 *       {@link TooltipUnits.hideOnPointerLeave} and
 *       {@link TooltipUnits.anchorFocusVisible}, because a tooltip opened by the
 *       keyboard must survive the pointer wandering off: "the tooltip will be
 *       hidden only if the user presses the Escape key or if the anchor element
 *       loses focus";
 *   - `canShowOnHover` is added, and reset whenever the tooltip unmounts;
 *   - The `open` atom is wired to the {@link TooltipRegistryModel}, so opening this
 *       tooltip closes the active one and closing it starts the skip window.
 *
 *   That last wiring is a `withChangeHook`, which fires in the hooks phase: after
 *   a bare `show()` / `hide()` / `open.set(...)` the registry catches up on the
 *   next `notify()`. Every prop-record handler calls `notify()` already, so
 *   this only shows up in tests and in code that drives the atom directly.
 *
 *   The deprecated `type: 'label' | 'description'` store option is not ported.
 *   Ariakit warns on `'label'` and points at "render a visually hidden label or
 *   use the `aria-label` / `aria-labelledby` attributes on the anchor element
 *   instead", so the tooltip element is always `role="tooltip"`.
 * @example
 *   // a caller-owned atom that also drives a tooltip
 *   const open = atom(false, 'save.tip')
 *   const tooltip = open.extend(withTooltip({ skipTimeout: 0 }))
 *
 * @see {@link reatomTooltip} for the batteries-included factory.
 */
export const withTooltip = (
  options: TooltipExtOptions = {},
): AssignerExt<TooltipUnits, Atom<boolean>> => {
  const {
    // The two lines that are Ariakit's whole tooltip store.
    placement = TOOLTIP_PLACEMENT,
    hideTimeout = 0,
    skipTimeout: initSkipTimeout = TOOLTIP_SKIP_TIMEOUT,
    hideOnHoverOutside: initHideOnPointerLeave = true,
    registry = tooltipRegistry,
    modality = keyboardModality,
    ...hovercardOptions
  } = options

  return (target) => {
    const { name } = target
    // The registry stores tooltips, and the units that make this atom one are
    // attached only after this assigner returns — the same forward reference
    // `withDialog` makes when it registers itself with its `parent`.
    const self = target as unknown as TooltipRegistryEntry

    const hovercard = withHovercard({
      ...hovercardOptions,
      placement,
      hideTimeout,
      hideOnHoverOutside: initHideOnPointerLeave,
    })(target)

    const skipTimeout = atom(initSkipTimeout, `${name}.skipTimeout`)

    const canShowOnHover = atom(false, `${name}.canShowOnHover`)
    const anchorFocusVisible = atom(false, `${name}.anchorFocusVisible`)
    const hideOnPointerLeave = atom(
      initHideOnPointerLeave,
      `${name}.hideOnPointerLeave`,
    )

    // Ariakit's `hideOnHoverOutside(event)` callback, as a derivation. The
    // hovercard's `disablePointerEventsOnApproach` follows this flag, which is
    // right: while the tooltip refuses to hide there is nothing to protect the
    // approach from.
    hovercard.hideOnHoverOutside.extend(
      withComputed(() => {
        // Both reads are unconditional so neither dependency can be dropped.
        const preference = hideOnPointerLeave()
        const focused = anchorFocusVisible()
        return preference && !focused
      }),
    )
    // `withHovercard` peeks this atom to seed `disablePointerEventsOnApproach`,
    // and an atom whose frame already exists keeps serving it: the derivation
    // just attached would never record a dependency, so the flag would be frozen
    // at its initial value.
    retryComputed(hovercard.hideOnHoverOutside)

    // The two `useEffect`s Ariakit's anchor installs, as one hook on the state
    // they both watch. It is on `open` rather than on `mounted` because the skip
    // window measures how long ago the user last _read_ a tooltip, not how long
    // its exit animation takes.
    target.extend(
      withChangeHook((open: boolean) => {
        if (open) {
          registry.activate(self)
          return
        }
        // `sync(store, ['mounted'], state => { if (state.mounted) return;
        // canShowOnHoverRef.current = false })`. A side effect rather than a
        // derivation on purpose: a derivation only notices a transition between
        // two _reads_, and nothing reads this flag between the show and the
        // Escape that closes it again.
        canShowOnHover.set(false)
        scheduleTooltipRelease(registry, self, skipTimeout())
      }),
    )
    // `withChangeHook` observes transitions, not the initial atom state. Adopt
    // an already-open atom into the registry now so it still participates in
    // one-at-a-time ownership.
    if (peek(target)) registry.activate(self)

    return {
      ...hovercard,
      skipTimeout,
      canShowOnHover,
      anchorFocusVisible,
      hideOnPointerLeave,
      registry,
      modality,
      active: computed(() => registry() === self, `${name}.active`),
      skipDelay: computed(() => {
        const active = registry()
        return active !== null && active !== self
      }, `${name}.skipDelay`),
    }
  }
}

/**
 * Creates a tooltip model: a hovercard above its anchor that opens on hover and
 * on keyboard focus, closes as soon as the pointer leaves, and shares a "one
 * tooltip at a time" registry with every other tooltip on the page.
 *
 * @remarks
 *   Ariakit's `createTooltipStore` is eight lines of overrides — `placement:
 *   'top'`, `hideTimeout: 0`, plus `skipTimeout` and the deprecated `type`.
 *   Everything else that makes a tooltip feel like one lives in `TooltipAnchor`
 *   and `Tooltip`: the active-tooltip store, the `canShowOnHover` ref, the
 *   `data-focus-visible` read, and the anchor exemption from
 *   outside-interaction dismissal. All of it is model state here, which is what
 *   makes the whole contract testable without a browser.
 * @example
 *   const save = reatomTooltip({ name: 'save.tip' })
 *
 *   save.placement() // 'top'
 *   save.hideDelay() // 0
 *   save.props.content().role // 'tooltip'
 *
 * @example
 *   // @reatom/jsx
 *   ;<>
 *   <button $spread={save.props.anchor} aria-label="Save">
 *   <SaveIcon />
 *   </button>
 *   <div $spread={save.props.wrapper}>
 *   <div $spread={save.props.content}>
 *   <div $spread={save.props.arrow} />
 *   Save
 *   </div>
 *   </div>
 *   </>
 *
 * @example
 *   // a toolbar's tooltips: the first waits, the rest are instant
 *   const registry = reatomTooltipRegistry({ name: 'toolbar.tooltips' })
 *   const bold = reatomTooltip({ registry, name: 'toolbar.bold.tip' })
 *   const italic = reatomTooltip({ registry, name: 'toolbar.italic.tip' })
 *
 * @see https://ariakit.com/components/tooltip
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
 */
export const reatomTooltip = (options: TooltipOptions = {}): Tooltip => {
  const {
    open: initOpen = false,
    name = named('tooltip'),
    alwaysVisible,
    hidden,
    fixed,
    arrowSize,
    ...ext
  } = options

  return atom(initOpen, name).extend(
    withTooltip(ext),
    withTooltipProps({ alwaysVisible, hidden, fixed, arrowSize }),
  )
}
