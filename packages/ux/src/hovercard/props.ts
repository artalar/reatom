/**
 * Layer 2 for `hovercard`: the reactive prop records.
 *
 * Three of the popover's records change, and the rest — `wrapper`, `arrow`,
 * `heading`, `description`, `dismiss`, `backdrop`, `focusTrap` — are inherited
 * unchanged, because `HovercardArrow`, `HovercardHeading`,
 * `HovercardDescription`, and `HovercardDismiss` add nothing to their popover
 * counterparts either.
 *
 * The records alone are a working hovercard: hovering the anchor opens the card
 * after the delay and leaving it cancels the pending open. What they cannot do
 * is watch the pointer _outside_ the anchor, which is the safe-polygon half in
 * [`reatomHovercardDom.ts`](./reatomHovercardDom.ts).
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/hovercard/hovercard-anchor.tsx`,
 * `hovercard-disclosure.tsx`, and the `useAutoFocusOnHide` half of
 * `hovercard.tsx`.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed, notify, wrap } from '@reatom/core'

import { VISUALLY_HIDDEN_STYLE } from '../dialog/dialogDom'
import type { DisclosureButtonProps } from '../disclosure/props'
import { disclosureProps } from '../disclosure/props'
import type { PopoverContentProps, PopoverPropRecords } from '../popover/props'
import type { PopoverPropsOptions } from '../popover/props'
import { popoverProps } from '../popover/props'
import type { PointerMovementEvent } from './hovercardIntent'
import { mapHovercardShowIntent } from './hovercardIntent'
import type { HovercardModel } from './reatomHovercard'
import { scheduleHovercardDelay } from './reatomHovercard'

/**
 * The minimal shape of a mouse event the anchor needs.
 *
 * Structural on purpose: a DOM `MouseEvent`, a React synthetic event, and a
 * plain object from a unit test all satisfy it. The movement fields are what
 * separate a real pointer move from the `mousemove` a scroll or a touch tap
 * produces.
 */
export interface HovercardAnchorEvent extends PointerMovementEvent {
  defaultPrevented?: boolean
  /** The anchor element, adopted as `anchorElement` and `disclosureElement`. */
  currentTarget?: EventTarget | null
}

/** The minimal shape of a focus event the card and its disclosure need. */
export interface HovercardFocusEvent {
  defaultPrevented?: boolean
}

/** Props to spread on the element the card is anchored to. */
export interface HovercardAnchorProps {
  /**
   * Assigns the model's `anchorElement`, unless a connected one is already set.
   *
   * @remarks
   *   Ariakit guards the assignment so that "the anchor element [is not] being
   *   reassigned to a different element when using multiple anchors and new
   *   anchors are added to the DOM" (`hovercard-anchor.tsx`) — one card shared
   *   by a list of links keeps pointing at the link the pointer is on.
   */
  ref: (element: HTMLElement | null) => void
  /** Starts the delayed show when the pointer moves over the anchor. */
  onMouseMove: (event?: HovercardAnchorEvent) => void
  /** Cancels a pending show when the pointer leaves the anchor. */
  onMouseLeave: (event?: HovercardAnchorEvent) => void
  /**
   * Cancels a pending show, and declares the pointer still.
   *
   * A click is not hover intent: without this, releasing the mouse over the
   * anchor would open the card the user just dismissed.
   */
  onClick: (event?: HovercardAnchorEvent) => void
}

/**
 * Props to spread on the visually hidden button that opens the card by
 * keyboard.
 */
export interface HovercardDisclosureProps extends DisclosureButtonProps {
  'aria-haspopup': 'dialog'
  /**
   * Visually hidden until the anchor is focus-visible, and never hidden from
   * assistive technology: it is the only keyboard route into the card.
   */
  style: typeof VISUALLY_HIDDEN_STYLE | undefined
  /** Reveals the button, for a user who tabbed straight to it. */
  onFocus: (event?: HovercardFocusEvent) => void
}

/** Props to spread on the card element. */
export interface HovercardContentProps extends PopoverContentProps {
  /**
   * Arms the focus restore. A hovercard does not restore focus by default —
   * there was none to restore — but once focus has been inside the card it must
   * go back to the anchor when the card closes.
   */
  onFocus: (event?: HovercardFocusEvent) => void
}

/** Reactive prop records of a hovercard model. */
export interface HovercardPropRecords extends Omit<
  PopoverPropRecords,
  'anchor' | 'disclosure' | 'content'
> {
  /** The element the card is anchored to, and hovering which opens it. */
  anchor: Computed<HovercardAnchorProps>
  /** The visually hidden button that opens the card by keyboard. */
  disclosure: Computed<HovercardDisclosureProps>
  /** The card element itself. */
  content: Computed<HovercardContentProps>
}

/** Options of {@link hovercardProps} and {@link withHovercardProps}. */
export interface HovercardPropsOptions extends PopoverPropsOptions {}

/**
 * Builds the reactive prop records of a hovercard model.
 *
 * @remarks
 *   The anchor record is where a hovercard differs most from a popover: it is not
 *   a button, it does not toggle, and it carries the hover intent. The
 *   disclosure record is deliberately _not_ the popover's — that one adopts the
 *   clicked button as the anchor, which would move a hovercard from the text it
 *   describes onto a 1×1 hidden button (`hovercard-disclosure.tsx` applies
 *   `useDialogDisclosure`, not `usePopoverDisclosure`, for exactly this
 *   reason).
 * @example
 *   const profile = reatomHovercard({ timeout: 0, name: 'profile' })
 *
 *   profile.props.anchor().onMouseMove({ currentTarget: link, movementX: 4 })
 *   profile() // true — a zero delay shows the card in the same tick
 *   profile.anchorElement() // link
 */
export const hovercardProps = (
  model: HovercardModel,
  options: HovercardPropsOptions = {},
): HovercardPropRecords => {
  const { name = model.name, ...popoverOptions } = options
  const popover = popoverProps(model, { ...popoverOptions, name })
  // The button contract — `type`, `aria-expanded`, `aria-controls`, the toggle,
  // and the `disclosureElement` bookkeeping — is the plain disclosure one, built
  // under its own name so it does not shadow the popover's records.
  const button = disclosureProps(model, { name: `${name}.keyboard` }).button

  return {
    ...popover,

    anchor: computed(
      (): HovercardAnchorProps => ({
        // No `notify()` in a ref: it runs while the view renders, which may
        // already be inside a notification flush.
        ref: wrap((element: HTMLElement | null) => {
          if (model.anchorElement()?.isConnected) return
          model.anchorElement.set(element)
        }),

        onMouseMove: wrap((event: HovercardAnchorEvent = {}) => {
          // Feed the shared flag from the event itself, so the record works
          // without the document listeners of `withHovercardDom`. Feeding it
          // twice for one event is harmless: the flag only ever moves to `true`.
          model.moving.move(event)

          const intent = mapHovercardShowIntent({
            defaultPrevented: !!event.defaultPrevented,
            showPending: model.showPending(),
            moving: model.moving(),
            showOnHover: model.showOnHover(),
          })
          if (intent === 'ignore') return

          const element = event.currentTarget
          if (element) {
            model.anchorElement.set(element as HTMLElement)
            // Ariakit assigns the disclosure element here and again in a
            // microtask after showing, "so it doesn't get assigned an arbitrary
            // element by the dialog component". Nothing reassigns it here, so
            // once is enough.
            model.disclosureElement.set(element as HTMLElement)
          }

          scheduleHovercardDelay(model.showDelayed)
          notify()
        }),

        onMouseLeave: wrap(() => {
          model.showDelayed.abort('mouseleave')
          notify()
        }),

        onClick: wrap(() => {
          model.showDelayed.abort('click')
          // Ariakit's global `mousedown` / `mouseup` listeners do this, see
          // https://github.com/ariakit/ariakit/issues/1137.
          model.moving.stop()
          notify()
        }),
      }),
      `${name}.props.anchor`,
    ),

    disclosure: computed((): HovercardDisclosureProps => {
      const base = button()
      const visible = model.disclosureVisible()

      return {
        ...base,
        'aria-haspopup': 'dialog',
        style: visible ? undefined : VISUALLY_HIDDEN_STYLE,
        onClick: wrap((event) => {
          if (event?.defaultPrevented) return
          // "By default, hovercards don't receive focus when they are shown.
          // When the disclosure element is clicked, though, we want it to behave
          // like a popover" — set before the toggle, so the flag is already true
          // when the focus layer reacts to the open state.
          model.autoFocusOnShow.set(true)
          base.onClick(event)
        }),
        onFocus: wrap((event?: HovercardFocusEvent) => {
          if (event?.defaultPrevented) return
          // The button is only visually hidden, so it can be tabbed to before
          // the anchor was ever focused.
          model.disclosureVisible.set(true)
          notify()
        }),
      }
    }, `${name}.props.disclosure`),

    content: computed(
      (): HovercardContentProps => ({
        ...popover.content(),
        onFocus: wrap((event?: HovercardFocusEvent) => {
          if (event?.defaultPrevented) return
          model.autoFocusOnHide.set(true)
          notify()
        }),
      }),
      `${name}.props.content`,
    ),
  }
}

/**
 * Attaches {@link hovercardProps} to a hovercard model as `model.props`.
 *
 * {@link reatomHovercard} applies it already; use it explicitly for models built
 * from an adopted atom with `withHovercard`.
 *
 * @example
 *   const open = atom(false, 'profile.open')
 *   const profile = open
 *     .extend(withHovercard())
 *     .extend(withHovercardProps({ fixed: true }))
 */
export const withHovercardProps = (
  options: HovercardPropsOptions = {},
): AssignerExt<{ props: HovercardPropRecords }, HovercardModel> => {
  return (target) => ({ props: hovercardProps(target, options) })
}
