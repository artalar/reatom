/**
 * Layer 2 for `dialog`: the document-level behaviors.
 *
 * Three opt-in extensions, each lazy and each self-cleaning:
 * {@link withDialogDismiss} (Escape and outside interactions),
 * {@link withDialogFocus} (focus in on show, focus back on hide), and
 * {@link withDialogModal} (inert background, scroll lock, hidden dismiss
 * button). {@link withDialogDom} applies all three.
 *
 * Nothing here decides policy — every branch is one of the pure predicates in
 * [`dialogIntent.ts`](./dialogIntent.ts), which is why the same behavior can be
 * asserted in Node without a DOM.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/dialog/dialog.tsx` and
 * `packages/ariakit-react-components/src/dialog/utils/*`.
 */

import type { Action, AssignerExt, GenericExt } from '@reatom/core'
import {
  abortVar,
  action,
  effect,
  ifChanged,
  notify,
  onEvent,
  withAbort,
  withConnectHook,
  wrap,
} from '@reatom/core'

import { canUseDOM, isFocusable } from '../focusable/focusableDom'
import {
  claimEscape,
  contains,
  disableTree,
  disableTreeOutside,
  getEventTargets,
  isDisclosureTarget,
  isFocusOutsideDialog,
  isInDocument,
  isPointerEventInside,
  lockBodyScroll,
  prependHiddenDismiss,
  resolveFinalFocus,
  resolveInitialFocus,
} from './dialogDom'
import type { DialogOutsideContext } from './dialogIntent'
import {
  isDialogEscape,
  isDialogInteractionOutside,
  isDialogOutsideClick,
  nextDialogFinalFocus,
} from './dialogIntent'
import type { DialogModel } from './reatomDialog'

/**
 * Closes the dialog on Escape and on interactions outside it.
 *
 * @remarks
 *   The listeners are installed on the document rather than on the dialog
 *   element, which is what makes Escape work while focus is outside the dialog
 *   (`dialog.tsx`: "We're attaching the listener to the document instead of the
 *   dialog element so we can listen to the Escape key anywhere in the
 *   document").
 *
 *   Escape takes **two passes** over one key press, as it does in Ariakit since
 *   `@ariakit/react-components` 0.3.4: a capture listener decides whether the
 *   key is this dialog's to act on, and a bubble listener commits the
 *   dismissal. A key a widget nested in the dialog consumed with
 *   `stopPropagation()` never reaches the second pass, so it keeps the dialog
 *   open — and once the dismissal is committed the event is stopped at the
 *   document, so nothing above the dialog acts on the same press. Deciding in
 *   the capture pass is what keeps the decision honest: at that point nothing
 *   has closed yet, so `topmost` still describes the stack the user pressed the
 *   key in.
 *
 *   Only the topmost dialog of a nested stack reacts to Escape — see
 *   `DialogUnits.topmost`.
 *
 *   Ariakit distinguishes a close caused by a pointer (which suppresses focus
 *   restoration) from one caused by focus moving out (which does not). This
 *   port records `'outside'` for both: when focus has already moved out, the
 *   restore is skipped anyway because the target is no longer the active
 *   element.
 *
 *   Lazy by design — the listeners are installed on the model's first subscriber
 *   and only while the dialog is mounted, so a closed dialog costs nothing.
 * @example
 *   const dialog = reatomDialog({ name: 'confirm' }).extend(
 *     withDialogDismiss(),
 *   )
 *   const unsubscribe = dialog.subscribe(() => {})
 *
 *   dialog.show() // the document listeners are attached
 */
export const withDialogDismiss = (): GenericExt<DialogModel> => (target) => {
  const { name } = target

  return target.extend(
    withConnectHook(() => {
      effect(() => {
        // `mounted`, not `open`: an animated dialog is still on screen while it
        // closes, and Escape must keep working until it is gone.
        if (!target.mounted()) return
        const document =
          target.contentElement()?.ownerDocument ??
          (canUseDOM() ? globalThis.document : null)
        if (!document) return

        /**
         * The presses this dialog accepted, mapped to whether they were already
         * default-prevented then — Ariakit's `escapeEvents` map. A press
         * prevented _after_ the accept pass was consumed below the dialog too,
         * exactly like one whose propagation was stopped.
         */
        const accepted = new WeakMap<Event, boolean>()

        onEvent(
          document,
          'keydown',
          (event) => {
            const content = target.contentElement()
            const disclosure = target.disclosureElement()
            const eventTarget = event.target as Element | null

            const escape = isDialogEscape({
              key: event.key,
              defaultPrevented: event.defaultPrevented,
              propagationStopped: event.cancelBubble,
              enabled: target.hideOnEscape(),
              topmost: target.topmost(),
              bodyTarget: eventTarget?.tagName === 'BODY',
              insideContent: contains(content, eventTarget),
              hasDisclosure: !!disclosure,
              insideDisclosure: contains(disclosure, eventTarget),
            })
            if (!escape) return

            accepted.set(event, event.defaultPrevented)
          },
          { capture: true },
        )

        onEvent(document, 'keydown', (event) => {
          const wasPrevented = accepted.get(event)
          if (wasPrevented === undefined) return
          accepted.delete(event)

          // Both are a descendant of the dialog saying it handled the key
          // itself. `cancelBubble` is the belt to the bubble phase's braces: an
          // event stopped below the document never gets here in the first place.
          if (event.cancelBubble) return
          if (event.defaultPrevented && !wasPrevented) return

          // Only one dialog of a stack may act on one key press, whichever of
          // its handlers gets there first.
          if (!claimEscape(event)) return

          // The dialog is the boundary of its own Escape: nothing above it —
          // another widget's document listener, a `window` handler — acts on a
          // press this dialog just consumed.
          event.stopPropagation()

          target.dismiss('escape')
          notify()
        })
      }, `${name}.escape`)

      effect(() => {
        if (!target()) return
        const content = target.contentElement()
        if (!content) return
        const document = content.ownerDocument

        // Recreated on every open, which is exactly Ariakit's
        // `usePreviousMouseDownRef(open)`: the press that opened the dialog
        // happened before this run, so the click it produces is ignored.
        let pressed = false
        let pressedOutside = false

        const onNestedDialog = (eventTarget: Element) =>
          target
            .nestedDialogs()
            .some(
              (dialog) =>
                contains(dialog.contentElement(), eventTarget) ||
                contains(dialog.backdropElement(), eventTarget),
            )

        const describe = (event: Event): DialogOutsideContext => {
          // The retargeted target is the one to ask about the document: an
          // element inside a shadow root is not reachable from `body`, so a
          // connectivity check on it would call every such event detached.
          const rootTarget = event.target as Element | null
          const targets = getEventTargets(event)

          return {
            inDocument: !!rootTarget && isInDocument(rootTarget),
            insideContent: targets.some((eventTarget) =>
              contains(content, eventTarget),
            ),
            onNestedDialog: targets.some(onNestedDialog),
            onDisclosure: targets.some((eventTarget) =>
              isDisclosureTarget(target.disclosureElement(), eventTarget),
            ),
            onFocusTrap: targets.some((eventTarget) =>
              eventTarget.hasAttribute?.('data-focus-trap'),
            ),
            onContentBox: isPointerEventInside(event, content),
          }
        }

        const dismiss = () => {
          if (!target.hideOnInteractOutside()) return
          target.dismiss('outside')
          notify()
        }

        onEvent(
          document,
          'mousedown',
          (event) => {
            pressed = true
            // The composed path, not `event.target`, preserves interactions
            // from inside an open shadow root.
            pressedOutside = !getEventTargets(event).some(
              (eventTarget) =>
                contains(content, eventTarget) || onNestedDialog(eventTarget),
            )
          },
          { capture: true },
        )

        onEvent(
          document,
          'click',
          (event) => {
            if (
              !isDialogOutsideClick({
                ...describe(event),
                pressed,
                pressedOutside,
              })
            ) {
              return
            }
            dismiss()
          },
          { capture: true },
        )

        onEvent(
          document,
          'contextmenu',
          (event) => {
            if (!isDialogInteractionOutside(describe(event))) return
            dismiss()
          },
          { capture: true },
        )

        // `focusin` has no `on*` property on `Document`, so the event type is
        // given explicitly instead of being inferred from the target.
        onEvent<FocusEvent>(
          document,
          'focusin',
          (event) => {
            // Focus landing on the document itself is not an outside element,
            // see https://github.com/ariakit/ariakit/issues/619.
            if (event.target === document) return
            if (!isDialogInteractionOutside(describe(event))) return
            dismiss()
          },
          { capture: true },
        )
      }, `${name}.interactOutside`)
    }),
  )
}

/** Units attached by {@link withDialogFocus}. */
export interface DialogFocusUnits {
  /**
   * Moves focus into the dialog. Called automatically when the dialog opens
   * while the model is connected.
   */
  focusOnShow: Action<[], Promise<void>>
  /**
   * Restores focus to the disclosure element, or to `finalFocus`. Called
   * automatically when the dialog closes while the model is connected.
   */
  focusOnHide: Action<[], Promise<void>>
}

/**
 * Moves focus into the dialog when it opens and back out when it closes.
 *
 * @remarks
 *   The focus itself is queued in a microtask, like Ariakit does, for two
 *   reasons: the dialog element may still be moving (a portal, a changed
 *   `modal` prop) and focusing an element that is about to be re-parented
 *   causes a scroll jump. The dialog is re-checked after the wait, so a close
 *   that happened in between cannot steal focus back from the restored
 *   element.
 *
 *   The restore retries once on the next frame when the target is not focusable
 *   yet, which is how Ariakit handles a nested dialog that still has to drop
 *   `inert` from the elements around it. `withAbort()` replaces the retry
 *   bookkeeping: a new transition aborts the pending one.
 * @example
 *   const dialog = reatomDialog({ name: 'confirm' }).extend(
 *     withDialogFocus(),
 *   )
 *
 *   dialog.initialFocus.set(input) // otherwise the first tabbable element wins
 */
export const withDialogFocus = (): AssignerExt<
  DialogFocusUnits,
  DialogModel
> => {
  return (target) => {
    const { name } = target

    const focusOnShow = action(async () => {
      if (!target.autoFocusOnShow()) return
      if (!target.contentElement()?.isConnected) return

      await wrap(new Promise<void>((resolve) => queueMicrotask(resolve)))
      // The dialog was closed while the focus was queued.
      if (!target()) return
      const content = target.contentElement()
      if (!content?.isConnected) return

      // Resolved after the wait, not before: the candidates are picked by
      // whether they can be focused *now*, and a view that renders `hidden`
      // from the prop record has only just revealed them.
      resolveInitialFocus(content, target.initialFocus()).focus()
    }, `${name}.focusOnShow`).extend(withAbort())

    const resolveRestore = (canRetry: boolean) => {
      const requested = target.finalFocus() ?? target.disclosureElement()
      const element = resolveFinalFocus(requested)

      return {
        element,
        intent: nextDialogFinalFocus({
          enabled: target.autoFocusOnHide(),
          interactedOutside: target.interactedOutside(),
          focusMovedElsewhere: isFocusOutsideDialog(target.contentElement()),
          hasTarget: !!element,
          targetFocusable: !!element && isFocusable(element),
          canRetry,
        }),
      }
    }

    const focusOnHide = action(async () => {
      let { element, intent } = resolveRestore(true)

      if (intent === 'retry') {
        await wrap(
          typeof requestAnimationFrame === 'function'
            ? new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
              )
            : Promise.resolve(),
        )
        ;({ element, intent } = resolveRestore(false))
      }

      if (intent !== 'focus') return
      element?.focus()
    }, `${name}.focusOnHide`).extend(withAbort())

    target.extend(
      withConnectHook(() => {
        effect(() => {
          const isOpen = target()
          // Reading the element makes a late `ref` re-run the flow, which is
          // Ariakit's reason for depending on `contentElement` instead of a ref.
          const content = target.contentElement()

          let show = false
          let hide = false
          // `isFirst` means there is no previous frame to diff against, so a
          // closed dialog on the first run is not a close transition.
          ifChanged(target, (open, _prevOpen, isFirst) => {
            if (open) show = true
            else hide = !isFirst
          })

          if (isOpen && content) show = true

          if (show) return focusOnShow()
          if (hide) return focusOnHide()
          return
        }, `${name}.focus`)
      }),
    )

    return { focusOnShow, focusOnHide }
  }
}

/**
 * Applies what makes a dialog modal: an inert background, a locked body scroll,
 * and a dismiss button for screen-reader users.
 *
 * @remarks
 *   `inert` is the whole focus trap for a modal dialog: nothing outside can be
 *   focused, clicked, or read by assistive technology, so Tab cycles inside the
 *   dialog on its own. The prop record's focus-trap sentinels are the fallback
 *   for views that cannot rely on it (a dialog rendered in a portal next to
 *   third-party content, or an older browser).
 *
 *   Each concern is its own effect, so an animated close, a nested dialog
 *   opening, or `modal` being toggled at runtime only redoes the part that
 *   changed. All four restore themselves through `abortVar.subscribe`, which
 *   fires when the effect re-runs and when the model disconnects.
 * @example
 *   const dialog = reatomDialog({ name: 'confirm' }).extend(
 *     withDialogModal(),
 *   )
 *   const unsubscribe = dialog.subscribe(() => {})
 *
 *   dialog.show() // everything outside the dialog element becomes inert
 */
export const withDialogModal = (): GenericExt<DialogModel> => (target) => {
  const { name } = target

  return target.extend(
    withConnectHook(() => {
      effect(() => {
        if (!target.focusTrapped()) return
        const content = target.contentElement()
        if (!content) return

        // A nested dialog and the backdrop are part of the modal context: the
        // parent must not disable them (`dialog.tsx`, `allElements`).
        const nested = target
          .nestedDialogs()
          .map((dialog) => dialog.contentElement())

        abortVar.subscribe(
          disableTreeOutside([content, target.backdropElement(), ...nested]),
        )
      }, `${name}.inertOutside`)

      effect(() => {
        // While an animated dialog closes it is still visible but must not be
        // interactive any more (`dialog.tsx`: "the open state will be false and
        // the mounted state will be true").
        const isOpen = target()
        const isMounted = target.mounted()
        if (isOpen || !isMounted) return
        const content = target.contentElement()
        if (!content) return

        abortVar.subscribe(disableTree(content))
      }, `${name}.inertSelf`)

      effect(() => {
        if (!target.scrollLocked()) return
        const content = target.contentElement()
        if (!content) return

        abortVar.subscribe(lockBodyScroll(content))
      }, `${name}.scrollLock`)

      effect(() => {
        const isModal = target.modal()
        const isMounted = target.mounted()
        if (!isModal || !isMounted) return
        const content = target.contentElement()
        if (!content) return
        // The dialog already has a visible dismiss button.
        if (content.querySelector('[data-dialog-dismiss]')) return

        abortVar.subscribe(
          prependHiddenDismiss(
            content,
            wrap(() => {
              target.dismiss('button')
              notify()
            }),
          ),
        )
      }, `${name}.hiddenDismiss`)
    }),
  )
}

/**
 * Applies every DOM behavior a dialog has: {@link withDialogDismiss},
 * {@link withDialogFocus}, and {@link withDialogModal}.
 *
 * @example
 *   const dialog = reatomDialog({ name: 'confirm' }).extend(withDialogDom())
 */
export const withDialogDom = (): AssignerExt<DialogFocusUnits, DialogModel> => {
  return (target) => {
    target.extend(withDialogDismiss(), withDialogModal())
    return withDialogFocus()(target)
  }
}
