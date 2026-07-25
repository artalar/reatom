/**
 * Layer 2 for `composite`: moving real DOM focus when the model moves.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): the `moves`-driven effects of
 * `packages/ariakit-react-components/src/composite/composite.tsx`.
 */

import type { Ext } from '@reatom/core'
import { effect, getCalls, withConnectHook, wrap } from '@reatom/core'

import type { CompositeModel } from './reatomComposite'

/** Options of {@link withCompositeFocus}. */
export interface CompositeFocusOptions {
  /**
   * Scrolls the focused item into view, for widgets whose list overflows.
   *
   * @default true
   */
  scrollIntoView?: boolean
}

/**
 * Focuses the element the model just moved to.
 *
 * @remarks
 *   This is the DOM half of the roving tabindex: the model decides which item is
 *   active, and focus has to follow — but only for a _move_, never for a plain
 *   `activeId` write, which Ariakit documents as "set the active item without
 *   moving focus".
 *
 *   Ariakit can not express that distinction in its store, so it keeps a `moves`
 *   counter next to `activeId` and its `Composite` component diffs the counter
 *   inside `useEffect`. Here the `move` action _is_ the event: an `effect`
 *   reads `getCalls(model.move)` and does nothing when the batch contains no
 *   call. The counter is gone, and so is the "moves increments but nothing
 *   moved" state.
 *
 *   With `virtualFocus`, DOM focus stays on the base element and the item is only
 *   marked with `aria-activedescendant`, so a move focuses the base element
 *   instead. A move to `null` focuses the base element too — that is what "the
 *   composite element itself is active" means.
 *
 *   The lifetime is the model's: nothing is observed until something subscribes,
 *   and the effect is aborted on disconnect. The focus call itself is deferred
 *   by one microtask, so it lands after the view has applied the props of the
 *   same move — wait for a microtask before asserting on
 *   `document.activeElement`.
 * @example
 *   const toolbar = reatomComposite({ name: 'toolbar' }).extend(
 *     withCompositeFocus(),
 *   )
 *
 *   toolbar.move('italic') // focuses the italic item element
 *   toolbar.set('bold') // activates without moving focus
 */
export const withCompositeFocus = <T extends CompositeModel>({
  scrollIntoView = true,
}: CompositeFocusOptions = {}): Ext<T, T> => {
  return (target) =>
    target.extend(
      withConnectHook(() => {
        effect(() => {
          // Both reads are unconditional: the calls read is the subscription to
          // the event, and the element reads keep the effect connected to the
          // handles it will need.
          const moves = getCalls(target.move)
          const activeElement = target.activeItem()?.element() ?? null
          const base = target.baseElement()
          const virtual = target.virtualFocus()

          if (!moves.length) return

          const element =
            virtual || target() === null ? base : (activeElement ?? base)
          if (!element) return

          // Deferred by one microtask, like Ariakit's `queueMicrotask(scheduleFocus)`:
          // the same move can also change whether the element is focusable at
          // all (the base element only gets `tabIndex=0` while it is active), and
          // the view applies that prop in this very notification.
          queueMicrotask(
            wrap(() => {
              // `preventScroll` plus an explicit `scrollIntoView` is Ariakit's
              // `focusIntoView`: the browser's own focus scrolling can not be
              // told to keep the item nearest to the viewport edge.
              element.focus({ preventScroll: scrollIntoView })
              if (scrollIntoView) {
                element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
              }
            }),
          )
        }, `${target.name}.focusOnMove`)
      }),
    )
}
