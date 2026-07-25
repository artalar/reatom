/**
 * Layer 2 for `hovercard`: the pointer tracking.
 *
 * Three opt-in extensions, each lazy and each self-cleaning:
 * {@link withHovercardHover} (the safe polygon and the delayed hide),
 * {@link withHovercardDisclosure} (revealing the keyboard disclosure button),
 * and {@link withHovercardDom}, which applies both.
 *
 * Every decision here is one of the pure functions in
 * [`hovercardIntent.ts`](./hovercardIntent.ts) and
 * [`safePolygon.ts`](./safePolygon.ts) — this file only reads the DOM facts
 * they need and carries out what they return, which is why the whole policy is
 * asserted in Node.
 *
 * Each listener is installed once, for the lifetime of the connection, and
 * decides per event whether it has anything to do. Ariakit instead adds and
 * removes them as the card mounts and unmounts, through effects that depend on
 * `mounted`; the same shape here would be a cycle — an `effect` created inside
 * a model's own connect hook, reading that model, keeps it connected, so the
 * hook's abort scope never runs and its listeners outlive the widget. Reading
 * the state inside the listener costs one atom read on a `mousemove` that was
 * going to be dispatched anyway, and it makes the teardown provable
 * (`hovercard.test.browser.ts`).
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/hovercard/hovercard.tsx`,
 * `hovercard-anchor.tsx`, `hovercard-disclosure.tsx`,
 * `packages/ariakit-react-utils/src/hooks.ts` (`useIsMouseMoving`), and
 * `packages/ariakit-utils/src/focus.ts` (`hasFocusWithin`).
 */

import type { GenericExt } from '@reatom/core'
import { abortVar, notify, onEvent, withConnectHook, wrap } from '@reatom/core'

import { contains, isFocusTrap } from '../dialog/dialogDom'
import { canUseDOM } from '../focusable/focusableDom'
import {
  mapHovercardMoveIntent,
  nextHovercardEnterPoint,
} from './hovercardIntent'
import type { HovercardModel } from './reatomHovercard'
import { scheduleHovercardDelay } from './reatomHovercard'
import type { PointerMovingModel } from './reatomPointerMoving'
import { pointerMoving } from './reatomPointerMoving'
import { getEventPoint, getSafePolygon, isPointInPolygon } from './safePolygon'

/**
 * `true` when focus is on the element or inside it, including through
 * `aria-activedescendant`.
 *
 * Port of Ariakit's `hasFocusWithin` (`ariakit-utils/src/focus.ts`). A card
 * that has focus stays open no matter where the pointer is, so this is the
 * first question the pointer policy asks.
 */
const hasFocusWithin = (element: Element): boolean => {
  const active = element.ownerDocument.activeElement
  if (!active) return false
  if (contains(element, active)) return true

  const activeDescendant = active.getAttribute('aria-activedescendant')
  if (!activeDescendant) return false
  if (activeDescendant === element.id) return true

  return !!element.querySelector(`#${CSS.escape(activeDescendant)}`)
}

/**
 * Feeds a pointer-movement model from the document.
 *
 * @remarks
 *   The five listeners are Ariakit's `useIsMouseMoving`: `mousemove` sets the
 *   flag, and a press, a key, or a scroll clears it — a scroll fires
 *   `mousemove` under a still pointer, and a click must not count as hover
 *   intent ([ariakit#1137](https://github.com/ariakit/ariakit/issues/1137)).
 *
 *   Ariakit installs them once per page and never removes them, "because we may
 *   lose some events if this component is unmounted, but others are still
 *   mounted". Here they are bound to the calling abort scope instead, so they
 *   disappear with the widget that asked for them. Calling this more than once
 *   for one model is harmless: both transitions are idempotent, so N listeners
 *   reach the same state as one.
 *
 *   Like `connectKeyboardModality`, child frames are not covered; a frame needs
 *   its own model and its own call.
 * @param model - The model to feed; defaults to the shared
 *   {@link pointerMoving}.
 */
export const connectPointerMoving = (
  model: PointerMovingModel = pointerMoving,
): void => {
  if (!canUseDOM()) return

  onEvent(
    document,
    'mousemove',
    (event) => {
      model.move(event)
    },
    { capture: true },
  )

  const stop = () => {
    model.stop()
  }

  onEvent(document, 'mousedown', stop, { capture: true })
  onEvent(document, 'mouseup', stop, { capture: true })
  onEvent(document, 'keydown', stop, { capture: true })
  onEvent(document, 'scroll', stop, { capture: true })
}

/** The events Ariakit suppresses while the pointer approaches the card. */
const APPROACH_EVENTS = [
  'mouseenter',
  'mouseover',
  'mouseout',
  'mouseleave',
] as const

/**
 * Closes the card when the pointer leaves it without heading for it, and keeps
 * it open while the pointer is on its way.
 *
 * @remarks
 *   The listeners sit on the document in the capture phase, because the
 *   interesting positions are the ones over neither the card nor the anchor.
 *   For each of them {@link mapHovercardMoveIntent} answers one of four things,
 *   and this extension carries it out:
 *
 *   - `keep` — cancel the pending hide, and remember the position while the pointer
 *       is over the anchor: that is the point the safe polygon will fan out
 *       from.
 *   - `approach` — the pointer is inside the polygon between the anchor and the
 *       card, so refresh it and swallow the event. Swallowing matters: a bare
 *       `mousemove` over unrelated content can focus it and close the card
 *       mid-approach, which is why the four pointer-transition events are
 *       suppressed as well.
 *   - `hide` — start the delayed hide.
 *   - `ignore` — nothing to do.
 *
 *   Lazy by design: nothing is installed until the model has its first
 *   subscriber, and both delays are aborted when it loses its last one — which
 *   is Ariakit's `clearTimeout` on unmount.
 *
 *   Escape is left to `withDialogDismiss()`. Ariakit additionally re-hides the
 *   card two frames after an Escape, to survive the `focusVisible` its own
 *   anchor gains from the key press; that only matters for an anchor that opens
 *   the card _on focus_, which is the tooltip's behavior rather than the
 *   hovercard's.
 * @example
 *   const profile = reatomHovercard({ name: 'profile' }).extend(
 *     withHovercardHover(),
 *   )
 *   const unsubscribe = profile.subscribe(() => {})
 *
 *   profile.props.anchor().onMouseMove({ currentTarget: link, movementX: 4 })
 *   // …500ms later the card is open and the pointer is being watched
 */
export const withHovercardHover = (): GenericExt<HovercardModel> => (target) =>
  target.extend(
    withConnectHook(() => {
      if (!canUseDOM()) return

      connectPointerMoving(target.moving)

      /**
       * The card, and the safe polygon between it and the anchor — or `null`
       * when there is nothing to watch: the card is off screen, or the pointer
       * never was on the anchor, so there is no point to travel from.
       */
      const watched = () => {
        if (!target.mounted()) return null
        const card = target.contentElement()
        if (!card) return null

        const enterPoint = target.enterPoint()

        return {
          card,
          polygon: enterPoint
            ? getSafePolygon(card.getBoundingClientRect(), enterPoint)
            : null,
        }
      }

      // Ariakit clears both timeouts when the components unmount. There is no
      // handle to clear here, only a flow to abort.
      abortVar.subscribe(() => {
        target.showDelayed.abort('disconnect')
        target.hideDelayed.abort('disconnect')
      })

      // The anchor's own leave handler is global and in the capture phase on
      // purpose: "We're using the native mouseleave event instead of React's
      // onMouseLeave so we bypass the event.stopPropagation() logic set on the
      // Hovercard component for when the mouse is moving toward the Hovercard"
      // (`hovercard-anchor.tsx`).
      onEvent(
        document,
        'mouseleave',
        (event) => {
          if (event.target !== target.anchorElement()) return
          target.showDelayed.abort('mouseleave')
          notify()
        },
        { capture: true },
      )

      onEvent(
        document,
        'mousemove',
        (event) => {
          // Ariakit's `if (!mayHideOnHoverOutside && !mayDisablePointerEvents)
          // return`: with both off there is nothing the position could change.
          if (
            !target.hideOnHoverOutside() &&
            !target.disablePointerEventsOnApproach()
          ) {
            return
          }

          const context = watched()
          if (!context) return
          const { card, polygon } = context

          // `composedPath()[0]` instead of `target`, so an element inside a
          // shadow root is still recognized as part of the card.
          const [eventTarget] = event.composedPath() as Array<Node>
          const onAnchor = contains(target.anchorElement(), eventTarget)
          const point = getEventPoint(event)

          const intent = mapHovercardMoveIntent({
            moving: target.moving(),
            focusWithin: hasFocusWithin(card),
            onCard:
              contains(card, eventTarget) ||
              target
                .nestedCards()
                .some((element) => contains(element, eventTarget)),
            onAnchor,
            hidePending: target.hidePending(),
            inPolygon: !!polygon && isPointInPolygon(point, polygon),
            hideOnHoverOutside: target.hideOnHoverOutside(),
          })

          if (intent === 'ignore') return

          if (intent === 'keep') {
            target.enterPoint.set(nextHovercardEnterPoint(onAnchor, point))
            target.hideDelayed.abort('hover')
            notify()
            return
          }

          if (intent === 'approach') {
            // Refresh it, so the polygon keeps narrowing as the pointer gets
            // closer instead of allowing a detour.
            target.enterPoint.set(point)
            notify()
            if (!target.disablePointerEventsOnApproach()) return
            event.preventDefault()
            event.stopPropagation()
            return
          }

          scheduleHovercardDelay(target.hideDelayed)
          notify()
        },
        { capture: true },
      )

      // "Disable mouse events while the mouse is moving toward the hovercard.
      // This is necessary because these events may trigger focus on other
      // elements and close the hovercard while the user is moving the mouse
      // toward it."
      for (const type of APPROACH_EVENTS) {
        onEvent(
          document,
          type,
          (event) => {
            if (!target.disablePointerEventsOnApproach()) return
            const polygon = watched()?.polygon
            if (!polygon) return
            if (!isPointInPolygon(getEventPoint(event), polygon)) return
            event.preventDefault()
            event.stopPropagation()
          },
          { capture: true },
        )
      }
    }),
  )

/**
 * Reveals the keyboard disclosure button once the anchor is focus-visible, and
 * hides it again when focus leaves the anchor, the card, and the button.
 *
 * @remarks
 *   A hovercard is opened by hovering, which no keyboard can do, so Ariakit
 *   renders a visually hidden button next to the anchor and shows it exactly
 *   when a keyboard user could want it (`hovercard-disclosure.tsx`).
 *
 *   The reveal watches `data-focus-visible` with a `MutationObserver`, which is
 *   Ariakit's own mechanism: the attribute is written imperatively by the
 *   focusable layer — see `applyFocusVisible` in `focusableDom.ts` — so there
 *   is no state to derive it from, and it lands after the `focus` event.
 *   Ariakit observes the anchor and re-targets the observer whenever
 *   `anchorElement` changes; one attribute-filtered observer on the document
 *   covers every anchor the model may adopt, including a card shared by a list
 *   of links.
 *
 *   Pair the anchor with `reatomFocusable` for the attribute to ever appear.
 * @example
 *   const profile = reatomHovercard({ name: 'profile' }).extend(
 *     withHovercardDisclosure(),
 *   )
 *
 *   profile.disclosureVisible() // false — until the anchor is focus-visible
 */
export const withHovercardDisclosure =
  (): GenericExt<HovercardModel> => (target) =>
    target.extend(
      withConnectHook(() => {
        if (!canUseDOM()) return

        const reveal = () => {
          const anchor = target.anchorElement()
          if (!anchor?.hasAttribute('data-focus-visible')) return
          target.disclosureVisible.set(true)
          notify()
        }

        // An anchor adopted while it already has the ring — a card created for
        // the element that currently has focus.
        reveal()

        if (typeof MutationObserver === 'function') {
          const observer = new MutationObserver(wrap(reveal))
          observer.observe(document, {
            subtree: true,
            attributeFilter: ['data-focus-visible'],
          })
          abortVar.subscribe(() => observer.disconnect())
        }

        // `focusout` has no `on*` property on `Document`, so the event type is
        // given explicitly instead of being inferred from the target.
        onEvent<FocusEvent>(
          document,
          'focusout',
          (event) => {
            if (!target.disclosureVisible()) return
            const next = event.relatedTarget as Element | null

            if (next) {
              if (contains(target.anchorElement(), next)) return
              // Ariakit checks its `popoverElement`, which is the positioning
              // wrapper. The card is checked too, so a consumer that assigns
              // only `content` is covered.
              if (contains(target.popoverElement(), next)) return
              if (contains(target.contentElement(), next)) return
              if (contains(target.disclosureElement(), next)) return
              // A portalled card renders its focus-trap sentinels outside the
              // portal, and they may hand focus back to the button.
              if (isFocusTrap(next)) return
            }

            target.disclosureVisible.set(false)
            notify()
          },
          { capture: true },
        )
      }),
    )

/**
 * Applies every DOM behavior a hovercard has: {@link withHovercardHover} and
 * {@link withHovercardDisclosure}.
 *
 * The dialog behaviors are separate on purpose — a hovercard rarely wants the
 * focus restore or the inert background of a modal dialog. Add
 * `withDialogDismiss()` when Escape and outside clicks should close the card
 * too.
 *
 * @example
 *   const profile = reatomHovercard({ name: 'profile' }).extend(
 *     withHovercardDom(),
 *     withDialogDismiss(),
 *   )
 */
export const withHovercardDom = (): GenericExt<HovercardModel> => (target) =>
  target.extend(withHovercardHover(), withHovercardDisclosure())
