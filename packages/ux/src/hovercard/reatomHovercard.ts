/**
 * Layer 1 for `hovercard`: the model.
 *
 * A hovercard is a popover that opens and closes by pointer intent rather than
 * by a click, which makes its whole story about _time_: it waits before
 * opening, waits before closing, and keeps itself open while the pointer is
 * travelling toward it. Ariakit stores that time as `timeout` / `showTimeout` /
 * `hideTimeout` state and turns it into `setTimeout` chains with a
 * `clearTimeout` for every branch; here the delay lives inside the flow as
 * `await wrap(sleep(ms))` and `withAbort()` replaces the timer bookkeeping
 * (`PORTING_PLAN.md` §2.4).
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/hovercard/hovercard-store.ts` and the policy
 * Ariakit keeps in `packages/ariakit-react-components/src/hovercard/*`.
 */

import type {
  AbortExt,
  Action,
  AssignerExt,
  Atom,
  Computed,
} from '@reatom/core'
import {
  abortVar,
  action,
  atom,
  computed,
  ifChanged,
  isAbort,
  named,
  peek,
  sleep,
  withAbort,
  withComputed,
  wrap,
} from '@reatom/core'

import type { DialogModel } from '../dialog/reatomDialog'
import type { PopoverExtOptions, PopoverUnits } from '../popover/reatomPopover'
import { withPopover } from '../popover/reatomPopover'
import type { HovercardPropRecords, HovercardPropsOptions } from './props'
import { withHovercardProps } from './props'
import type { PointerMovingModel } from './reatomPointerMoving'
import { pointerMoving } from './reatomPointerMoving'
import type { Point } from './safePolygon'

/** The default delay of both transitions, in milliseconds. */
export const HOVERCARD_TIMEOUT = 500

/**
 * A delayed hovercard transition: an async action that waits, then applies.
 *
 * `.abort(reason?)` _is_ the `clearTimeout` — nothing stores a timer handle,
 * and a cancelled wait simply never reaches its write.
 */
export interface HovercardDelay extends Action<[], Promise<void>>, AbortExt {}

/**
 * Starts a delayed transition and ignores the rejection an abort produces.
 *
 * A pointer handler is not an `await` site: it starts the wait and returns, so
 * the promise `withAbort()` rejects on cancellation would otherwise surface as
 * an unhandled rejection — and being cancelled is the _normal_ outcome for a
 * hovercard delay. Awaiting {@link HovercardDelay} directly still observes it.
 *
 * @example
 *   // in a view's own handler, next to the prop record
 *   scheduleHovercardDelay(profile.hideDelayed)
 */
export const scheduleHovercardDelay = (delay: HovercardDelay): void =>
  void delay().catch((error: unknown) => {
    if (!isAbort(error)) throw error
  })

/** Options accepted by both {@link reatomHovercard} and {@link withHovercard}. */
export interface HovercardExtOptions extends PopoverExtOptions {
  /**
   * How long to wait before showing and before hiding the card, in
   * milliseconds. Override one side with {@link HovercardExtOptions.showTimeout}
   * or {@link HovercardExtOptions.hideTimeout}.
   *
   * @default 500
   */
  timeout?: number
  /** How long to wait before showing. Defaults to `timeout`. */
  showTimeout?: number
  /** How long to wait before hiding. Defaults to `timeout`. */
  hideTimeout?: number
  /**
   * Whether hovering the anchor opens the card. Turning it off leaves the
   * keyboard disclosure button and programmatic `show()` as the ways in, which
   * is what a menu built on a hovercard wants.
   *
   * @default true
   */
  showOnHover?: boolean
  /**
   * Whether the card closes when the pointer leaves it and its anchor without
   * hover intent — that is, without moving toward the card.
   *
   * The card never closes this way while it or a descendant has focus.
   *
   * @default true
   */
  hideOnHoverOutside?: boolean
  /**
   * Whether pointer events outside the card and its anchor are suppressed while
   * the pointer travels toward the card. Necessary because those events can
   * focus other elements and close the card mid-approach.
   *
   * Defaults to `hideOnHoverOutside`, and keeps following it unless it is set
   * explicitly.
   */
  disablePointerEventsOnApproach?: boolean
  /**
   * The pointer-movement flag hover intent is read from. Defaults to the shared
   * {@link pointerMoving} instance; pass your own to isolate a test or a
   * document.
   */
  moving?: PointerMovingModel
}

/** Options of the {@link reatomHovercard} factory. */
export interface HovercardOptions
  extends HovercardExtOptions, HovercardPropsOptions {
  /**
   * Initial `open` state. To adopt a caller-owned atom instead, extend it with
   * {@link withHovercard}.
   *
   * @default false
   */
  open?: boolean
}

/** Units attached by {@link withHovercard}, on top of the popover ones. */
export interface HovercardUnits extends PopoverUnits {
  /** The delay both transitions fall back to. */
  timeout: Atom<number>
  /** The show delay, or `null` to use {@link HovercardUnits.timeout}. */
  showTimeout: Atom<number | null>
  /** The hide delay, or `null` to use {@link HovercardUnits.timeout}. */
  hideTimeout: Atom<number | null>
  /** The resolved show delay, in milliseconds. */
  showDelay: Computed<number>
  /** The resolved hide delay, in milliseconds. */
  hideDelay: Computed<number>
  /** Whether hovering the anchor opens the card. */
  showOnHover: Atom<boolean>
  /** Whether leaving the card without hover intent closes it. */
  hideOnHoverOutside: Atom<boolean>
  /** Whether outside pointer events are suppressed during an approach. */
  disablePointerEventsOnApproach: Atom<boolean>
  /** The pointer-movement flag hover intent is read from. */
  moving: PointerMovingModel
  /**
   * Where the pointer last was over the anchor, which is the point the safe
   * polygon fans out from once it leaves.
   *
   * @remarks
   *   `null` means there is nothing to travel from, so an approach cannot be
   *   detected: the pointer is on the card itself, or the card is not on
   *   screen. Ariakit keeps the same value in a ref and never clears it on
   *   unmount, which can leave a stale polygon behind for the next open; here
   *   it is derived to `null` whenever the card is unmounted.
   */
  enterPoint: Atom<Point | null>
  /**
   * Whether the keyboard disclosure button is visible.
   *
   * @remarks
   *   A hovercard is unreachable by keyboard on its own, so Ariakit renders a
   *   visually hidden button next to the anchor and reveals it once the anchor
   *   is focus-visible (`hovercard-disclosure.tsx`). The reveal is component
   *   state there; it is model state here, because both the prop record and the
   *   DOM layer need it.
   */
  disclosureVisible: Atom<boolean>
  /**
   * The content elements of every mounted card nested in this one — the cards a
   * pointer may cross without this one closing.
   *
   * @remarks
   *   Ariakit threads a `NestedHovercardContext` down the tree so a portalled
   *   submenu can register its element with its parent, keeping a list in React
   *   state (`hovercard.tsx`, `registerNestedHovercard`). Here nesting is
   *   already declared — a nested card passes `parent` to {@link withHovercard}
   *   — so the list is a derivation of the dialog stack and needs no context,
   *   no registration, and no lifecycle.
   */
  nestedCards: Computed<ReadonlyArray<HTMLElement>>
  /**
   * Shows the card after {@link HovercardUnits.showDelay}, unless cancelled.
   *
   * @remarks
   *   The pointer is re-checked after the delay, which is Ariakit's guard against
   *   "showing the hovercard on mobile clicks or after clicking on the anchor"
   *   (`hovercard-anchor.tsx`): the delay may well outlive the movement that
   *   started it.
   *
   *   A delay of `0` shows the card synchronously, with no `await` at all —
   *   Ariakit special-cases the same value to skip its `setTimeout`.
   */
  showDelayed: HovercardDelay
  /** Hides the card after {@link HovercardUnits.hideDelay}, unless cancelled. */
  hideDelayed: HovercardDelay
  /**
   * Whether a delayed show is running.
   *
   * @remarks
   *   Written by {@link HovercardUnits.showDelayed} — including from its abort
   *   scope, so a cancelled wait clears the flag — and read as a guard:
   *   Ariakit's `if (showTimeoutRef.current) return` keeps every following
   *   `mousemove` over the anchor from restarting the delay. It is the
   *   observable half of what a timer handle used to be.
   */
  showPending: Atom<boolean>
  /** Whether a delayed hide is running. Guards the same way as `showPending`. */
  hidePending: Atom<boolean>
}

/** A boolean atom extended with the hovercard behavior. */
export interface HovercardModel extends Atom<boolean>, HovercardUnits {}

/**
 * The model returned by {@link reatomHovercard}: {@link HovercardModel} plus prop
 * records.
 */
export interface Hovercard extends HovercardModel {
  /** Reactive prop records for the hovercard's elements. */
  props: HovercardPropRecords
}

/**
 * Adds the hovercard behavior to an existing boolean atom.
 *
 * @remarks
 *   The extension applies {@link withPopover} itself — Ariakit's
 *   `createHovercardStore` merges `createPopoverStore` into its own state — and
 *   adds the delays, the pointer-intent flags, and the two focus rules a
 *   hovercard differs from a popover by:
 *
 *   - `autoFocusOnShow` defaults to `false`, because a card that opens on hover
 *       must not steal focus; it is turned on for the click that comes from the
 *       keyboard disclosure button, forced on for a modal card, and reset when
 *       the card closes.
 *   - `autoFocusOnHide` defaults to `false` for the same reason and is turned on
 *       once the card actually receives focus, so focus returns to the anchor
 *       only when it was inside the card. `finalFocus` follows
 *       `anchorElement`.
 *
 *   Nothing here listens to anything. The pointer tracking is
 *   {@link withHovercardDom} in
 *   [`reatomHovercardDom.ts`](./reatomHovercardDom.ts).
 * @example
 *   // a route search param that drives a hovercard
 *   const open = atom(false, 'profile.open')
 *   const profile = open.extend(withHovercard({ timeout: 200 }))
 *
 * @see {@link reatomHovercard} for the batteries-included factory.
 */
export const withHovercard = (
  options: HovercardExtOptions = {},
): AssignerExt<HovercardUnits, Atom<boolean>> => {
  const {
    timeout: initTimeout = HOVERCARD_TIMEOUT,
    showTimeout: initShowTimeout,
    hideTimeout: initHideTimeout,
    showOnHover: initShowOnHover = true,
    hideOnHoverOutside: initHideOnHoverOutside = true,
    disablePointerEventsOnApproach: initDisablePointerEvents,
    moving = pointerMoving,
    // Both differ from the dialog defaults: a card that opens on hover must not
    // move focus, in either direction.
    autoFocusOnShow: initAutoFocusOnShow = false,
    autoFocusOnHide: initAutoFocusOnHide = false,
    ...popoverOptions
  } = options

  return (target) => {
    const { name } = target
    const popover = withPopover({
      autoFocusOnShow: initAutoFocusOnShow,
      autoFocusOnHide: initAutoFocusOnHide,
      ...popoverOptions,
    })(target)

    const timeout = atom(initTimeout, `${name}.timeout`)
    const showTimeout = atom(initShowTimeout ?? null, `${name}.showTimeout`)
    const hideTimeout = atom(initHideTimeout ?? null, `${name}.hideTimeout`)

    const delay = (specific: Atom<number | null>, key: string) =>
      computed(() => {
        // Both reads are unconditional so the fallback stays connected.
        const own = specific()
        const shared = timeout()
        return own ?? shared
      }, `${name}.${key}`)

    const showDelay = delay(showTimeout, 'showDelay')
    const hideDelay = delay(hideTimeout, 'hideDelay')

    const hideOnHoverOutside = atom(
      initHideOnHoverOutside,
      `${name}.hideOnHoverOutside`,
    )
    // Ariakit's `disablePointerEventsOnApproach = !!hideOnHoverOutside` prop
    // default, as a writable derivation: it follows the flag it defaults to
    // until the caller passes a value of its own.
    const disablePointerEventsOnApproach = atom(
      initDisablePointerEvents ?? peek(hideOnHoverOutside),
      `${name}.disablePointerEventsOnApproach`,
    )
    if (initDisablePointerEvents === undefined) {
      disablePointerEventsOnApproach.extend(
        withComputed(() => hideOnHoverOutside()),
      )
    }

    const showPending = atom(false, `${name}.showPending`)
    const hidePending = atom(false, `${name}.hidePending`)

    /**
     * A delay in the flow instead of a timer in state (`PORTING_PLAN.md` §2.4).
     *
     * `withAbort()` is the whole cancellation story: a newer call supersedes
     * the pending one, and `.abort()` drops it. The pending flag is cleared
     * from the abort scope as well as after the wait, so an aborted delay
     * cannot leave the guard stuck.
     */
    const delayed = (
      pending: Atom<boolean>,
      ms: Computed<number>,
      apply: () => void,
      key: string,
    ) =>
      action(async () => {
        const timeout = ms()

        // Ariakit skips its `setTimeout` for a zero delay, so the transition
        // happens in the same tick as the pointer event; skipping the `await`
        // keeps that, and nothing is pending in that case.
        if (timeout > 0) {
          const cancellation = abortVar.subscribe(() => pending.set(false))
          pending.set(true)
          try {
            await wrap(sleep(timeout))
          } finally {
            cancellation.unsubscribe()
          }
          pending.set(false)
        }

        apply()
      }, `${name}.${key}`).extend(withAbort())

    const showDelayed = delayed(
      showPending,
      showDelay,
      () => {
        if (!moving()) return
        const anchor = popover.anchorElement()
        popover.show()
        // Showing recomputes the disclosure prop record. A renderer may
        // reattach its callback ref and temporarily restore the hidden button;
        // reassert the hovered anchor after that render, as Ariakit does.
        if (anchor) {
          queueMicrotask(
            wrap(() => {
              popover.disclosureElement.set(anchor)
            }),
          )
        }
      },
      'showDelayed',
    )

    const hideDelayed = delayed(
      hidePending,
      hideDelay,
      () => void popover.hide(),
      'hideDelayed',
    )

    // Ariakit resets `autoFocusOnShow` from two effects — one on every close,
    // one on unmount — and overrides it per render with `modal ||
    // state.autoFocusOnShow` (`hovercard.tsx`). All three are one derivation
    // that stays writable, so the disclosure button can still turn it on.
    //
    // A write wins until the next transition, like every writable derivation in
    // the package (`currentPlacement` is the precedent). That is enough for both
    // rules: the flag is only ever read at the moment the card opens or closes,
    // and both recompute it.
    popover.autoFocusOnShow.extend(
      withComputed((state) => {
        const isModal = popover.modal()
        const isOpen = target()
        return isModal || (isOpen && state)
      }),
    )
    // Ariakit's `useAutoFocusOnHide` resets its flag whenever the card is not
    // mounted, so focus is restored only when it was inside the card.
    popover.autoFocusOnHide.extend(
      withComputed((state) => popover.mounted() && state),
    )
    // Anchor both first frames: an atom extended with `withComputed` that has
    // never been computed drops a write made before its first read, and the
    // disclosure button writes `autoFocusOnShow` before anything reads it.
    peek(popover.autoFocusOnShow)
    peek(popover.autoFocusOnHide)
    // "TODO: Maybe use state.anchorElement directly?" — yes: Ariakit syncs the
    // anchor into a `finalFocusRef`, which is a derivation that must stay
    // writable so a consumer can still redirect the restore.
    popover.finalFocus.extend(
      withComputed((state) => {
        let requested = state
        ifChanged(popover.anchorElement, (element) => {
          requested = element
        })
        return requested
      }),
    )
    // Anchor the first frame here too, and for a second reason: until the atom
    // has been computed once there is no previous `anchorElement` to diff
    // against, so the first change would be missed.
    peek(popover.finalFocus)

    const enterPoint = atom<Point | null>(null, `${name}.enterPoint`).extend(
      withComputed((state) => (popover.mounted() ? state : null)),
    )
    peek(enterPoint)

    const nestedCards = computed(() => {
      const elements: Array<HTMLElement> = []

      const walk = (dialogs: ReadonlyArray<DialogModel>) => {
        for (const dialog of dialogs) {
          // A card that is not on screen cannot be crossed by a pointer.
          if (dialog.mounted()) {
            const element = dialog.contentElement()
            if (element) elements.push(element)
          }
          walk(dialog.children())
        }
      }

      walk(popover.children())

      return elements
    }, `${name}.nestedCards`)

    return {
      ...popover,
      timeout,
      showTimeout,
      hideTimeout,
      showDelay,
      hideDelay,
      showOnHover: atom(initShowOnHover, `${name}.showOnHover`),
      hideOnHoverOutside,
      disablePointerEventsOnApproach,
      moving,
      enterPoint,
      disclosureVisible: atom(false, `${name}.disclosureVisible`),
      nestedCards,
      showDelayed,
      hideDelayed,
      showPending,
      hidePending,
    }
  }
}

/**
 * Creates a hovercard model: a popover that opens when the pointer rests on its
 * anchor and closes when the pointer leaves without heading for the card.
 *
 * @remarks
 *   Ariakit's `createHovercardStore` adds four state keys to the popover store
 *   (`timeout`, `showTimeout`, `hideTimeout`, `autoFocusOnShow`) and one
 *   setter. Everything that makes a hovercard feel like one lives in its
 *   components, so this port pulls that policy into the model — the delays as
 *   flows, the pointer flags as atoms, the nested-card list as a derivation —
 *   and leaves only the listeners to `reatomHovercardDom.ts`.
 * @example
 *   const profile = reatomHovercard({ timeout: 250, name: 'profile' })
 *
 *   profile.showDelayed() // resolves in 250ms, unless aborted
 *   profile.showDelayed.abort() // the pointer left: no timer to clear
 *
 * @example
 *   // @reatom/jsx
 *   ;<>
 *   <a $spread={profile.props.anchor}>@username</a>
 *   <button $spread={profile.props.disclosure}>Details</button>
 *   <div $spread={profile.props.wrapper}>
 *   <div $spread={profile.props.content}>...</div>
 *   </div>
 *   </>
 *
 * @example
 *   // a submenu: nesting is declared once, and both the Escape stack and the
 *   // safe-polygon list follow from it
 *   const menu = reatomHovercard({ name: 'menu' }).extend(withHovercardDom())
 *   const submenu = reatomHovercard({
 *     parent: menu,
 *     placement: 'right-start',
 *     name: 'menu.submenu',
 *   }).extend(withHovercardDom())
 *
 * @see https://ariakit.com/components/hovercard
 */
export const reatomHovercard = (options: HovercardOptions = {}): Hovercard => {
  const {
    open: initOpen = false,
    name = named('hovercard'),
    alwaysVisible,
    hidden,
    fixed,
    arrowSize,
    ...ext
  } = options

  return atom(initOpen, name).extend(
    withHovercard(ext),
    withHovercardProps({ alwaysVisible, hidden, fixed, arrowSize }),
  )
}
