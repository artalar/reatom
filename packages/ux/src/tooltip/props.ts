/**
 * Layer 2 for `tooltip`: the reactive prop records.
 *
 * Two of the hovercard's records change and the rest are inherited unchanged —
 * `TooltipArrow` only lowers the arrow size, and `Tooltip` itself adds nothing
 * to `useHovercard` beyond the two policies that became model derivations.
 *
 * The records alone are a working tooltip: hovering the anchor opens it after
 * the delay (or at once, while a neighbour is still active), keyboard focus
 * opens it immediately, blur closes it, and Escape is the dialog's own
 * contract. What they cannot do is watch the pointer _outside_ the anchor,
 * which is the hovercard's `withHovercardDom`.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/tooltip/tooltip-anchor.tsx`,
 * `tooltip.tsx`, and `tooltip-arrow.tsx`.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed, notify, wrap } from '@reatom/core'

import { isFocusEventOutside } from '../focusable/focusableDom'
import type { FocusVisibleEvent } from '../focusable/focusIntent'
import { mapFocusVisibleIntent } from '../focusable/focusIntent'
import type {
  HovercardAnchorEvent,
  HovercardAnchorProps,
  HovercardContentProps,
  HovercardPropRecords,
  HovercardPropsOptions,
} from '../hovercard/props'
import { hovercardProps } from '../hovercard/props'
import { scheduleHovercardDelay } from '../hovercard/reatomHovercard'
import { describeElement } from '../interactions/describeElement'
import type {
  ElementDescriptor,
  EventTargetsLike,
} from '../interactions/element'
import { isSelfTarget } from '../interactions/element'
import type { TooltipModel } from './reatomTooltip'
import type { TooltipRegistryEntry } from './reatomTooltipRegistry'
import { mapTooltipShowIntent } from './tooltipIntent'

/**
 * The size Ariakit's `TooltipArrow` defaults to, in pixels — half the
 * popover's, because a tooltip is a smaller thing (`tooltip-arrow.tsx`: `size =
 * 16`).
 */
export const TOOLTIP_ARROW_SIZE = 16

/**
 * The minimal shape of a focus or blur event the tooltip anchor needs.
 *
 * Structural on purpose, like the hovercard's mouse event: a DOM `FocusEvent`,
 * a React synthetic one, and a plain object from a unit test all satisfy it.
 * The two derived facts — is this the anchor's own focus, is focus really
 * leaving — are read off the live nodes when they are there, and can be stated
 * outright when they are not.
 */
export interface TooltipAnchorFocusEvent {
  defaultPrevented?: boolean
  /**
   * `event.target`. A live element is reduced with `describeElement` here, so a
   * text field shows its tooltip however focus arrived — the caret has to be
   * discoverable either way; a plain {@link ElementDescriptor} is taken as it
   * is.
   */
  target?: ElementDescriptor | EventTarget | null
  /** The anchor element, adopted as `anchorElement` and `disclosureElement`. */
  currentTarget?: EventTarget | null
  /** Where focus is going, for a blur. */
  relatedTarget?: EventTarget | null
  /**
   * `isSelfTarget(event)` — `false` when a child element was focused. Derived
   * from `target === currentTarget` when both are given.
   */
  selfTarget?: boolean
  /**
   * `isFocusEventOutside(event)` for a blur: `false` when focus only moved to a
   * descendant of the anchor, which is not a focus loss. Derived from
   * {@link TooltipAnchorFocusEvent.relatedTarget} when the anchor can answer
   * `contains`.
   */
  focusOutside?: boolean
}

/**
 * Reduces a tooltip anchor's focus or blur event to the plain data
 * `mapFocusVisibleIntent` consumes.
 *
 * The anchor is not a `reatomFocusable`, so `describeFocusEvent` — which needs
 * a real `FocusEvent` — is not usable here: the record has to accept the same
 * hand-written events its hover handlers do.
 */
export const describeTooltipFocusEvent = (
  event: TooltipAnchorFocusEvent,
  type: 'focus' | 'blur',
): FocusVisibleEvent => ({
  type,
  defaultPrevented: event.defaultPrevented,
  selfTarget: isAnchorTarget(event),
  focusOutside: type === 'blur' ? isFocusLeavingAnchor(event) : undefined,
  target: describeFocusTarget(event.target),
})

/** A live element is described; anything else is already a descriptor. */
const describeFocusTarget = (
  target: TooltipAnchorFocusEvent['target'],
): ElementDescriptor | undefined => {
  if (!target) return undefined
  return typeof (target as Element).getAttribute === 'function'
    ? describeElement(target as Element)
    : (target as ElementDescriptor)
}

/**
 * `undefined` rather than `false` when the event does not say: an event
 * carrying only a `target` descriptor is a test describing the focused element,
 * not one claiming a child was focused.
 */
const isAnchorTarget = (
  event: TooltipAnchorFocusEvent,
): boolean | undefined => {
  if (event.selfTarget !== undefined) return event.selfTarget
  if (!event.target || !event.currentTarget) return undefined
  return isSelfTarget(event as EventTargetsLike)
}

const isFocusLeavingAnchor = (
  event: TooltipAnchorFocusEvent,
): boolean | undefined => {
  if (event.focusOutside !== undefined) return event.focusOutside
  const anchor = event.currentTarget as Element | null | undefined
  // A stand-in handle cannot answer containment, and guessing it would turn a
  // blur into a non-blur.
  if (!anchor || typeof anchor.contains !== 'function') return undefined
  return isFocusEventOutside({
    currentTarget: anchor,
    relatedTarget: event.relatedTarget ?? null,
  })
}

/** Props to spread on the element the tooltip describes. */
export interface TooltipAnchorProps extends HovercardAnchorProps {
  /**
   * Links the anchor to the tooltip element.
   *
   * @remarks
   *   Ariakit sets `aria-labelledby` instead, and only for the deprecated `type:
   *   'label'` tooltip; it deliberately leaves the description linkage to the
   *   consumer, because "the tooltip is strictly for visual purposes". The [APG
   *   tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)
   *   requires it, so this port sets it — and the anchor still needs an
   *   accessible name of its own, which no prop record can provide.
   */
  'aria-describedby': string
  /**
   * Arms the tooltip: only a pointer that _entered_ the anchor may open it. Set
   * unconditionally, like Ariakit's — a handler that prevented the event still
   * left the pointer on the anchor.
   */
  onMouseEnter: (event?: HovercardAnchorEvent) => void
  /**
   * Opens the tooltip when the anchor becomes focus-visible, with no delay: a
   * keyboard user has already committed to the element.
   */
  onFocus: (event?: TooltipAnchorFocusEvent) => void
  /**
   * Closes the tooltip when the anchor loses focus, and ends the skip window.
   *
   * @remarks
   *   Ariakit's `onBlur` only clears the flag and the active store; the close
   *   comes from the dialog's own `focusout` dismissal, which needs the
   *   document listeners of `withDialogDom`. Doing it here makes the APG rule —
   *   "the tooltip remains visible until Escape is pressed or focus moves away
   *   from the trigger" — true for the records on their own.
   */
  onBlur: (event?: TooltipAnchorFocusEvent) => void
}

/** Props to spread on the tooltip element. */
export interface TooltipContentProps extends Omit<
  HovercardContentProps,
  'role'
> {
  /**
   * Always `'tooltip'`.
   *
   * @remarks
   *   Ariakit derives `role` from the deprecated `type` state — `'tooltip'` for a
   *   description, `'none'` for a label — which is not ported, so the inherited
   *   `model.role()` (a `DialogRole`) is not what this element renders.
   */
  role: 'tooltip'
}

/** Reactive prop records of a tooltip model. */
export interface TooltipPropRecords extends Omit<
  HovercardPropRecords,
  'anchor' | 'content'
> {
  /** The element the tooltip describes, and hovering which opens it. */
  anchor: Computed<TooltipAnchorProps>
  /** The tooltip element itself. */
  content: Computed<TooltipContentProps>
}

/** Options of {@link tooltipProps} and {@link withTooltipProps}. */
export interface TooltipPropsOptions extends HovercardPropsOptions {}

/**
 * Builds the reactive prop records of a tooltip model.
 *
 * @remarks
 *   The anchor record is where a tooltip differs from a hovercard. It answers two
 *   extra questions before the hovercard's own hover policy is allowed to act —
 *   is the anchor armed, and is another tooltip active — and it owns the
 *   keyboard route in, which for a hovercard is a separate hidden disclosure
 *   button and for a tooltip is the anchor itself.
 *
 *   Focus is decided from {@link TooltipModel.modality} through the shared
 *   `mapFocusVisibleIntent`, which is what makes "opens on Tab, not on click"
 *   work without a `Focusable` wrapper. Both the focus and the hover route
 *   assign `disclosureElement` alongside `anchorElement`, which is this port's
 *   version of Ariakit's tooltip-specific `hideOnInteractOutside` override:
 *   `isDialogInteractionOutside` already exempts the disclosure element, so
 *   clicking the anchor cannot dismiss the tooltip.
 * @example
 *   const save = reatomTooltip({ timeout: 0, name: 'save.tip' })
 *
 *   save.props.anchor().onMouseEnter()
 *   save.props.anchor().onMouseMove({ currentTarget: button, movementX: 4 })
 *   save() // true — a zero delay shows the tooltip in the same tick
 */
export const tooltipProps = (
  model: TooltipModel,
  options: TooltipPropsOptions = {},
): TooltipPropRecords => {
  const {
    name = model.name,
    arrowSize = TOOLTIP_ARROW_SIZE,
    ...hovercardOptions
  } = options
  const hovercard = hovercardProps(model, {
    ...hovercardOptions,
    arrowSize,
    name,
  })
  // The registry stores tooltips by identity, and the model is the tooltip.
  const self = model as unknown as TooltipRegistryEntry

  /** Adopts the anchor as both handles; see the remarks above. */
  const adopt = (element: EventTarget | null | undefined) => {
    if (!element) return
    model.anchorElement.set(element as HTMLElement)
    model.disclosureElement.set(element as HTMLElement)
  }

  return {
    ...hovercard,

    anchor: computed((): TooltipAnchorProps => {
      const base = hovercard.anchor()

      return {
        ...base,
        'aria-describedby': model.contentId(),

        onMouseEnter: wrap(() => {
          model.canShowOnHover.set(true)
          notify()
        }),

        onMouseMove: wrap((event: HovercardAnchorEvent = {}) => {
          // Feed the shared flag from the event itself, so the record works
          // without the document listeners of `withHovercardDom`.
          model.moving.move(event)

          const intent = mapTooltipShowIntent({
            defaultPrevented: !!event.defaultPrevented,
            showPending: model.showPending(),
            moving: model.moving(),
            showOnHover: model.showOnHover(),
            canShowOnHover: model.canShowOnHover(),
            skipDelay: model.skipDelay(),
          })
          if (intent === 'ignore') return

          adopt(event.currentTarget)

          if (intent === 'showNow') model.show()
          else scheduleHovercardDelay(model.showDelayed)
          notify()
        }),

        onFocus: wrap((event: TooltipAnchorFocusEvent = {}) => {
          const intent = mapFocusVisibleIntent(
            describeTooltipFocusEvent(event, 'focus'),
            {
              focusVisible: model.anchorFocusVisible(),
              keyboardModality: model.modality(),
            },
          )
          if (intent === 'none') return

          if (intent === 'clear') {
            model.anchorFocusVisible.set(false)
            notify()
            return
          }

          model.anchorFocusVisible.set(true)
          adopt(event.currentTarget)
          // `onFocusVisible` calls `store.show()` directly: the show delay
          // exists to protect a pointer that is only passing over the anchor,
          // and a keyboard focus is never accidental.
          model.show()
          notify()
        }),

        onBlur: wrap((event: TooltipAnchorFocusEvent = {}) => {
          const intent = mapFocusVisibleIntent(
            describeTooltipFocusEvent(event, 'blur'),
          )
          if (intent !== 'clear') return

          model.anchorFocusVisible.set(false)
          // "Sets canShowOnHover to false so moving the mouse over the anchor
          // after it loses focus (for example, clicking on a menu button)
          // doesn't show the tooltip until the mouse leaves and re-enters the
          // anchor."
          model.canShowOnHover.set(false)
          model.hide()
          // "If the current tooltip is the active tooltip and the anchor loses
          // focus […] we don't want to show subsequent tooltips without a
          // delay. So we set the active tooltip to null."
          model.registry.clear(self)
          notify()
        }),
      }
    }, `${name}.props.anchor`),

    content: computed(
      (): TooltipContentProps => ({
        ...hovercard.content(),
        role: 'tooltip',
      }),
      `${name}.props.content`,
    ),
  }
}

/**
 * Attaches {@link tooltipProps} to a tooltip model as `model.props`.
 *
 * {@link reatomTooltip} applies it already; use it explicitly for models built
 * from an adopted atom with `withTooltip`.
 *
 * @example
 *   const open = atom(false, 'save.tip')
 *   const tooltip = open
 *     .extend(withTooltip())
 *     .extend(withTooltipProps({ fixed: true }))
 */
export const withTooltipProps = (
  options: TooltipPropsOptions = {},
): AssignerExt<{ props: TooltipPropRecords }, TooltipModel> => {
  return (target) => ({ props: tooltipProps(target, options) })
}
