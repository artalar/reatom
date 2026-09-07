/**
 * Layer 1 for `composite-overflow`: the model.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/composite/composite-overflow-store.ts`, plus
 * the policy Ariakit keeps in
 * `packages/ariakit-react-components/src/composite/composite-overflow.tsx` and
 * `packages/ariakit-react-components/src/composite/composite-overflow-disclosure.ts`.
 */

import type { Action, AssignerExt, Atom, Computed } from '@reatom/core'
import { action, atom, computed, named } from '@reatom/core'

import type {
  CompositeItemInit,
  CompositeItemNode,
  CompositeModel,
} from '../composite/reatomComposite'
import type { PopoverExtOptions, PopoverUnits } from '../popover/reatomPopover'
import { withPopover } from '../popover/reatomPopover'
import type {
  CompositeOverflowPropRecords,
  CompositeOverflowPropsOptions,
} from './props'
import { withCompositeOverflowProps } from './props'

/**
 * Default `id` of the disclosure element of an overflow popover, which is also
 * the `id` of its item inside the composite.
 *
 * Reatom names are hierarchical (`editor.toolbar.overflow`), which makes a poor
 * HTML id, so every non-word character collapses into a dash. Ariakit generates
 * `id-${random}` through `useId` instead, which differs between the server and
 * the client; a name-derived id keeps SSR markup stable.
 */
export const compositeOverflowDisclosureId = (name: string): string =>
  `${name.replace(/[^\w-]+/g, '-')}-disclosure`

/**
 * Options accepted by both {@link reatomCompositeOverflow} and
 * {@link withCompositeOverflow}.
 */
export interface CompositeOverflowExtOptions extends PopoverExtOptions {
  /**
   * The composite whose overflowing items this popover holds.
   *
   * @remarks
   *   Ariakit reaches the composite through React context —
   *   `CompositeOverflowDisclosure` is documented as "should be used in a
   *   component that's wrapped with a composite component" — and this is the
   *   same edge as an explicit option, the way `PORTING_PLAN.md` §7 prescribes
   *   for cross-store references.
   *
   *   It is only needed by the disclosure: the overflowing items register
   *   themselves in the composite directly, since they are ordinary composite
   *   items that happen to be rendered inside the popover.
   */
  composite?: CompositeModel
  /**
   * The `id` of the disclosure element, and of its item inside `composite`.
   * Defaults to a DOM-safe derivation of the model name, see
   * {@link compositeOverflowDisclosureId}.
   */
  disclosureId?: string
}

/** Options of the {@link reatomCompositeOverflow} factory. */
export interface CompositeOverflowOptions
  extends CompositeOverflowExtOptions, CompositeOverflowPropsOptions {
  /**
   * Initial `open` state. To adopt a caller-owned atom instead, extend it with
   * {@link withCompositeOverflow}.
   *
   * @default false
   */
  open?: boolean
}

/** Units attached by {@link withCompositeOverflow}, on top of the popover ones. */
export interface CompositeOverflowUnits extends PopoverUnits {
  /** The composite the disclosure belongs to, or `null` for a lone popover. */
  composite: CompositeModel | null
  /** The `id` of the disclosure element, and of its composite item. */
  disclosureId: Atom<string>
  /**
   * The disclosure's item inside {@link CompositeOverflowUnits.composite},
   * `null` while it is not registered — which is most of the time, see
   * {@link CompositeOverflowUnits.disclosureFocused}.
   */
  disclosureItem: Computed<CompositeItemNode | null>
  /**
   * Whether the disclosure element currently has focus — Ariakit's
   * `shouldRegisterItem` state.
   *
   * @remarks
   *   It drives two things: `aria-hidden` on the disclosure, and whether the
   *   disclosure takes part in the composite at all. A "+2 items" button is a
   *   pointer affordance for items that are _themselves_ in the composite, so
   *   announcing and navigating to it would duplicate them; it joins the widget
   *   only while it holds focus, so that the composite still has a valid active
   *   item then.
   *
   *   The `disclosure` prop record maintains it from the element's focus and
   *   blur, together with the matching
   *   {@link CompositeOverflowUnits.renderDisclosure} /
   *   {@link CompositeOverflowUnits.unrenderDisclosure} call. Write it directly
   *   only to change what is announced.
   */
  disclosureFocused: Atom<boolean>
  /**
   * Registers the disclosure as a rendered item of
   * {@link CompositeOverflowUnits.composite} and returns its node, or `null`
   * when there is no composite. The element defaults to `disclosureElement`.
   *
   * @remarks
   *   Rendered rather than merely registered, because a composite navigates its
   *   rendered items. Note that the item is appended to the collection, while
   *   in the DOM the disclosure usually sits before the popover it opens —
   *   extend `composite.items` with `withDomOrder()` to have the order
   *   corrected, exactly as Ariakit's `sortBasedOnDOMPosition` does.
   */
  renderDisclosure: Action<[init?: CompositeItemInit], CompositeItemNode | null>
  /**
   * Undoes one {@link CompositeOverflowUnits.renderDisclosure}, returning
   * whether the item left the composite.
   */
  unrenderDisclosure: Action<[], boolean>
}

/** A boolean atom extended with the composite overflow behavior. */
export interface CompositeOverflowModel
  extends Atom<boolean>, CompositeOverflowUnits {}

/**
 * The model returned by {@link reatomCompositeOverflow}:
 * {@link CompositeOverflowModel} plus prop records.
 */
export interface CompositeOverflow extends CompositeOverflowModel {
  /** Reactive prop records for the overflow popover's elements. */
  props: CompositeOverflowPropRecords
}

/**
 * Adds the composite overflow behavior to an existing boolean atom.
 *
 * @remarks
 *   The extension applies {@link withPopover} itself — Ariakit's
 *   `createCompositeOverflowStore` _is_ `createPopoverStore` — and adds the
 *   disclosure's composite membership on top: its id, its item, the focus flag
 *   that governs both, and the two actions that join and leave the composite.
 *   Do not extend the same atom with `withPopover`, `withDialog`, or
 *   `withDisclosure` first; `extend` refuses to overwrite existing members.
 * @example
 *   // an overflow popover driven by a caller-owned atom
 *   const open = atom(false, 'more')
 *   const overflow = open.extend(
 *     withCompositeOverflow({ composite: toolbar }),
 *   )
 *
 * @see {@link reatomCompositeOverflow} for the batteries-included factory.
 */
export const withCompositeOverflow = (
  options: CompositeOverflowExtOptions = {},
): AssignerExt<CompositeOverflowUnits, Atom<boolean>> => {
  const {
    composite = null,
    disclosureId: initDisclosureId,
    ...popoverOptions
  } = options

  return (target) => {
    const { name } = target
    const popover = withPopover(popoverOptions)(target)

    const disclosureId = atom(
      initDisclosureId ?? compositeOverflowDisclosureId(name),
      `${name}.disclosureId`,
    )

    const renderDisclosure = action(
      (init: CompositeItemInit = {}): CompositeItemNode | null =>
        composite
          ? composite.items.renderItem({
              element: popover.disclosureElement(),
              ...init,
              id: disclosureId(),
            })
          : null,
      `${name}.renderDisclosure`,
    )

    return {
      ...popover,
      composite,
      disclosureId,
      disclosureItem: computed(
        () => composite?.items.item(disclosureId()) ?? null,
        `${name}.disclosureItem`,
      ),
      disclosureFocused: atom(false, `${name}.disclosureFocused`),
      renderDisclosure,
      unrenderDisclosure: action(
        (): boolean => composite?.items.unrenderItem(disclosureId()) ?? false,
        `${name}.unrenderDisclosure`,
      ),
    }
  }
}

/**
 * Creates a composite overflow model: the popover that holds the items a
 * composite widget has no room for, plus the button that opens it.
 *
 * @remarks
 *   Ariakit's store is a one-liner (`createCompositeOverflowStore` returns
 *   `createPopoverStore(props)`), so everything that makes this pattern work
 *   lives in the two components around it, and that is what this port models:
 *
 *   - The popover is **never** `display: none`. It is `alwaysVisible` and merely
 *       transparent while closed, because hiding it would make the overflowing
 *       items unfocusable — and they must stay focusable, since they are
 *       ordinary composite items that arrow-key navigation walks into.
 *   - Focus arriving in the popover shows it, which is how navigating into an
 *       overflowing item opens the popover.
 *   - The popover element is `role="presentation"` and takes no tab stop: it is a
 *       container for items that carry their own roles.
 *   - The disclosure joins the composite only while it has focus, and is
 *       `aria-hidden` otherwise, so the items it stands for are announced
 *       once.
 *
 *   Positioning stays injected, exactly as for a plain popover: apply
 *   `withFloating()` to place the popover against
 *   {@link PopoverUnits.anchorElement}.
 * @example
 *   const toolbar = reatomToolbar({ name: 'editor.toolbar' })
 *   const overflow = reatomCompositeOverflow({
 *     composite: toolbar,
 *     name: 'editor.toolbar.overflow',
 *   })
 *
 *   // the items that fit, and the ones that do not — all of them composite items
 *   toolbar.items.renderItem({ id: 'bold' })
 *   toolbar.items.renderItem({ id: 'italic' })
 *   const link = toolbar.items.renderItem({ id: 'link' })
 *
 *   overflow.props.disclosure().onClick({ currentTarget: button })
 *   overflow() // true
 *   toolbar.move(link.id) // navigating into an overflowing item keeps it open
 *
 * @example
 *   // @reatom/jsx
 *   ;<div $spread={toolbar.props.base}>
 *   <button $spread={toolbar.props.item(bold)}>Bold</button>
 *   <button $spread={overflow.props.disclosure}>+2 items</button>
 *   <div $spread={overflow.props.wrapper}>
 *   <div $spread={overflow.props.content}>
 *   <button $spread={toolbar.props.item(link)}>Link</button>
 *   </div>
 *   </div>
 *   </div>
 *
 * @see https://ariakit.com/components/composite
 */
export const reatomCompositeOverflow = (
  options: CompositeOverflowOptions = {},
): CompositeOverflow => {
  const {
    open: initOpen = false,
    name = named('compositeOverflow'),
    alwaysVisible,
    hidden,
    fixed,
    arrowSize,
    popover,
    ...ext
  } = options

  return atom(initOpen, name).extend(
    withCompositeOverflow(ext),
    withCompositeOverflowProps({
      alwaysVisible,
      hidden,
      fixed,
      arrowSize,
      popover,
    }),
  )
}
