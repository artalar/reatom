/**
 * Layer 1 for `popover`: the model.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/popover/popover-store.ts` and the policy
 * Ariakit keeps in `packages/ariakit-react-components/src/popover/*`.
 */

import type { Action, AssignerExt, Atom, Computed } from '@reatom/core'
import {
  action,
  atom,
  computed,
  ifChanged,
  named,
  peek,
  withComputed,
} from '@reatom/core'

import type { DialogExtOptions, DialogUnits } from '../dialog/reatomDialog'
import { withDialog } from '../dialog/reatomDialog'
import type {
  PopoverAlignment,
  PopoverBasePlacement,
  PopoverPlacement,
} from './popoverPlacement'
import { getPopoverAlignment, getPopoverSide } from './popoverPlacement'
import type { PopoverPropRecords, PopoverPropsOptions } from './props'
import { withPopoverProps } from './props'

/** Options accepted by both {@link reatomPopover} and {@link withPopover}. */
export interface PopoverExtOptions extends DialogExtOptions {
  /**
   * Where the popover is placed relative to its anchor.
   *
   * @default 'bottom'
   */
  placement?: PopoverPlacement
  /**
   * Whether the popover is modal. A popover is **not** modal by default, unlike
   * a plain dialog — Ariakit sets `modal = false` in `PopoverOptions`
   * (`popover.tsx`), because a popover is expected to leave the page
   * interactive.
   *
   * @default false
   */
  modal?: boolean
}

/** Options of the {@link reatomPopover} factory. */
export interface PopoverOptions extends PopoverExtOptions, PopoverPropsOptions {
  /**
   * Initial `open` state. To adopt a caller-owned atom instead, extend it with
   * {@link withPopover}.
   *
   * @default false
   */
  open?: boolean
}

/** Units attached by {@link withPopover}, on top of the dialog ones. */
export interface PopoverUnits extends DialogUnits {
  /**
   * The requested placement. Writing it asks the positioning layer to place the
   * popover again, which is why {@link PopoverUnits.currentPlacement} follows
   * it.
   */
  placement: Atom<PopoverPlacement>
  /**
   * Where the popover actually ended up. It differs from `placement` when the
   * popover had to flip or slide to stay in the viewport.
   *
   * @remarks
   *   Writable: the positioning layer reports the resolved placement here, the
   *   way Ariakit's `Popover` does with `store.setState('currentPlacement',
   *   pos.placement)`. Between those writes it derives from `placement`, so a
   *   new request is never read as a stale result — Ariakit gets the same
   *   effect by initializing `currentPlacement` to `placement` and recomputing
   *   the position whenever `placement` changes.
   */
  currentPlacement: Atom<PopoverPlacement>
  /**
   * The side of `currentPlacement`, which is the direction the arrow points in
   * (`popover-arrow.tsx`: `state.currentPlacement.split('-')[0]`).
   */
  side: Computed<PopoverBasePlacement>
  /** The alignment of `currentPlacement`; `null` while it is centered. */
  alignment: Computed<PopoverAlignment | null>
  /**
   * The element the popover is positioned against. Assigned by the `anchor`
   * prop record, or written directly for a virtual anchor (a text selection, a
   * pointer position).
   *
   * @remarks
   *   Writable, and a write wins over {@link PopoverUnits.anchorFallbackElement}:
   *   a popover whose anchor is not its button keeps the anchor it was given,
   *   even when the disclosure element is assigned afterwards. Ariakit reaches
   *   the same precedence with a `syncedAnchorElement` variable and a `sync`
   *   listener over `anchorElement` and `disclosureElement`
   *   (`popover-store.ts:66-80`).
   *
   *   Writing `null` hands the popover back to the fallback, which is what an
   *   anchor element that unmounts does through `props.anchor().ref(null)`.
   */
  anchorElement: Atom<HTMLElement | null>
  /**
   * The element {@link PopoverUnits.anchorElement} falls back to while no
   * explicit anchor is set: the disclosure element, so a popover whose anchor
   * _is_ its button needs no `anchor` record.
   *
   * @remarks
   *   Derived from `disclosureElement` and writable, so a widget whose anchor
   *   fallback is another element can override it — `reatomCombobox` prefers
   *   the input element the way Ariakit's combobox store syncs the anchor from
   *   `baseElement || disclosureElement` (`combobox-store.ts:133-157`).
   */
  anchorFallbackElement: Atom<HTMLElement | null>
  /**
   * The wrapper element that carries the position. Ariakit renders it around
   * the dialog element so a consumer can animate the dialog without fighting
   * the transform the positioner writes (`popover.tsx`, `wrapperProps`).
   */
  popoverElement: Atom<HTMLElement | null>
  /** The arrow element, whose size feeds the anchor gutter. */
  arrowElement: Atom<HTMLElement | null>
  /**
   * Whether the popover has been placed at least once since it mounted.
   *
   * @remarks
   *   Ariakit keeps the same flag in component state and resets it in the
   *   positioning effect's cleanup, for two consumers: the internal
   *   `data-placing` attribute, and delaying `autoFocusOnShow` until the
   *   popover stopped moving, "otherwise there may be scroll jumps"
   *   (`popover.tsx:263-266`).
   *
   *   The focus delay is **not** applied by this port: `withDialogFocus` reads
   *   `autoFocusOnShow` alone. Hold `autoFocusOnShow` at `false` and call
   *   `focusOnShow()` once `positioned()` turns `true` if the delay matters for
   *   your popover.
   */
  positioned: Atom<boolean>
  /**
   * `true` while the popover is on screen but has not been placed yet — the
   * state Ariakit exposes as the private `data-placing` attribute so other
   * components (the autoselecting combobox) can wait for the position.
   */
  placing: Computed<boolean>
  /**
   * Asks the positioning layer to place the popover again, for anchor changes
   * no observer can see: a text selection, a caret position, a resized virtual
   * anchor.
   *
   * @remarks
   *   Ariakit has no way to express an event in its store, so its `render()`
   *   method writes a fresh `Symbol` into a `rendered` state key and the
   *   `Popover` component's layout effect diffs it (`popover-store.ts:61,71`,
   *   `popover.tsx:259,375-398`). Here the action _is_ the event: observe it
   *   with `getCalls(popover.reposition)` inside an `effect`, with
   *   `withCallHook(popover.reposition)`, or with `await
   *   wrap(take(popover.reposition))`. The symbol, and with it the "the popover
   *   re-rendered but nothing moved" state, is gone.
   * @example
   *   effect(() => {
   *     if (getCalls(popover.reposition).length) place()
   *   }, 'popover.place')
   */
  reposition: Action<[], void>
}

/** A boolean atom extended with the popover behavior. */
export interface PopoverModel extends Atom<boolean>, PopoverUnits {}

/**
 * The model returned by {@link reatomPopover}: {@link PopoverModel} plus prop
 * records.
 */
export interface Popover extends PopoverModel {
  /** Reactive prop records for the popover's elements. */
  props: PopoverPropRecords
}

/**
 * Adds the popover behavior to an existing boolean atom.
 *
 * @remarks
 *   The extension applies {@link withDialog} itself — Ariakit's
 *   `createPopoverStore` merges `createDialogStore` into its own state, so a
 *   popover _is_ a dialog — and adds what positioning needs: the placement
 *   pair, the three element handles, and the {@link PopoverUnits.reposition}
 *   event. Do not extend the same atom with `withDialog` or `withDisclosure`
 *   first; `extend` refuses to overwrite existing members.
 *
 *   Nothing here touches the DOM or measures anything. The actual positioning is
 *   `withFloating` in [`reatomPopoverFloating.ts`](./reatomPopoverFloating.ts),
 *   which is opt-in so the model carries no positioning dependency.
 * @example
 *   // a route search param that drives a popover
 *   const open = atom(false, 'filters.open')
 *   const filters = open.extend(withPopover({ placement: 'bottom-end' }))
 *
 * @see {@link reatomPopover} for the batteries-included factory.
 */
export const withPopover = (
  options: PopoverExtOptions = {},
): AssignerExt<PopoverUnits, Atom<boolean>> => {
  const {
    placement: initPlacement = 'bottom',
    // Ariakit's `PopoverOptions` default, which differs from the dialog's:
    // a popover leaves the rest of the page interactive (`popover.tsx`).
    modal = false,
    ...dialogOptions
  } = options

  return (target) => {
    const { name } = target
    const dialog = withDialog({ modal, ...dialogOptions })(target)

    const placement = atom(initPlacement, `${name}.placement`)
    // A writable derivation: a new request resets it, and the positioning layer
    // overrides it with the placement it resolved. The reset is written with
    // `ifChanged` rather than by returning `placement()`, because the latter
    // would also undo the positioner's write every time the atom is recomputed.
    const currentPlacement = atom(
      initPlacement,
      `${name}.currentPlacement`,
    ).extend(
      withComputed((state) => {
        let requested = state
        ifChanged(placement, (value) => {
          requested = value
        })
        return requested
      }),
    )
    // Anchor the first frame, like `withDisclosure` does for `animating`: until
    // the atom has been computed once there is no previous `placement` to diff
    // against, so the positioner's first result would be recomputed away.
    peek(currentPlacement)

    // The disclosure element is only a _fallback_ anchor: Ariakit writes it into
    // `anchorElement` from a `sync` listener and remembers what it wrote in a
    // `syncedAnchorElement` variable, so that an explicitly set anchor is left
    // alone (`popover-store.ts:66-80`). Here the fallback is its own writable
    // derivation and the precedence is the anchor's own derivation below.
    const anchorFallbackElement = atom<HTMLElement | null>(
      null,
      `${name}.anchorFallbackElement`,
    ).extend(withComputed(() => dialog.disclosureElement()))

    const anchorElement = atom<HTMLElement | null>(
      null,
      `${name}.anchorElement`,
    ).extend(
      withComputed((state) => {
        let next = state
        ifChanged(anchorFallbackElement, (element, previous) => {
          // `state` is an explicit anchor exactly when it is set and is not the
          // fallback this atom adopted before — Ariakit's comparison against
          // `syncedAnchorElement`, without the mutable variable.
          if (!state || state === previous) next = element
        })
        return next
      }),
    )

    // Ariakit resets its `positioned` state from the positioning effect's
    // cleanup, which runs when the popover unmounts (`popover.tsx:371-374`).
    // Here that is a derivation of `mounted` that the positioner may override.
    const positioned = atom(false, `${name}.positioned`).extend(
      withComputed((state) => (dialog.mounted() ? state : false)),
    )

    return {
      ...dialog,
      placement,
      currentPlacement,
      side: computed(() => getPopoverSide(currentPlacement()), `${name}.side`),
      alignment: computed(
        () => getPopoverAlignment(currentPlacement()),
        `${name}.alignment`,
      ),
      anchorElement,
      anchorFallbackElement,
      popoverElement: atom<HTMLElement | null>(null, `${name}.popoverElement`),
      arrowElement: atom<HTMLElement | null>(null, `${name}.arrowElement`),
      positioned,
      placing: computed(() => {
        // Both reads are unconditional so neither dependency can be dropped.
        const isMounted = dialog.mounted()
        const isPositioned = positioned()
        return isMounted && !isPositioned
      }, `${name}.placing`),
      reposition: action(() => {}, `${name}.reposition`),
    }
  }
}

/**
 * Creates a popover model: a dialog that is positioned relative to an anchor
 * element instead of the viewport.
 *
 * @remarks
 *   Ported from Ariakit's framework-agnostic `createPopoverStore`. Three of its
 *   four peculiarities disappear: the `setAnchorElement` / `setPopoverElement`
 *   / `setArrowElement` identity setters (write the atoms), the
 *   `omit(otherPopover, ['arrowElement', ...])` list that keeps two merged
 *   stores from sharing element handles (share the atoms you mean to share),
 *   and the `rendered: Symbol('rendered')` counter behind `render()` (the
 *   {@link PopoverUnits.reposition} action is the event).
 *
 *   Everything a dialog knows is still here — `dismiss`, the nested stack,
 *   `topmost`, the modal flags — because the model composes {@link withDialog}.
 *   What is new is the placement pair and the element handles a positioner
 *   needs.
 * @example
 *   const filters = reatomPopover({
 *     placement: 'bottom-end',
 *     name: 'filters',
 *   })
 *
 *   filters.show()
 *   filters.placing() // true — nothing has placed it yet
 *   filters.currentPlacement() // 'bottom-end'
 *   filters.side() // 'bottom'
 *
 * @example
 *   // @reatom/jsx
 *   ;<>
 *   <button $spread={filters.props.disclosure}>Filters</button>
 *   <div $spread={filters.props.wrapper}>
 *   <div $spread={filters.props.content}>
 *   <div $spread={filters.props.arrow} />
 *   ...
 *   </div>
 *   </div>
 *   </>
 *
 * @example
 *   // a popover anchored to something other than its button
 *   const menu = reatomPopover({ name: 'menu' })
 *
 *   menu.props.anchor().ref(selectionElement)
 *   menu.show()
 *   menu.reposition() // the selection moved
 *
 * @see https://ariakit.com/components/popover
 */
export const reatomPopover = (options: PopoverOptions = {}): Popover => {
  const {
    open: initOpen = false,
    name = named('popover'),
    alwaysVisible,
    hidden,
    fixed,
    arrowSize,
    ...ext
  } = options

  return atom(initOpen, name).extend(
    withPopover(ext),
    withPopoverProps({ alwaysVisible, hidden, fixed, arrowSize }),
  )
}
