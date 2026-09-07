/**
 * Layer 2 for `composite-overflow`: the reactive prop records that turn a
 * popover into the overflow container of a composite widget.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/composite/composite-overflow.tsx` and
 * `packages/ariakit-react-components/src/composite/composite-overflow-disclosure.ts`,
 * which are the only place the overflow behavior exists — its store is a
 * popover store verbatim.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed, notify, wrap } from '@reatom/core'

import type { CompositeNavigationKeyEvent } from '../composite/navigationIntent'
import { mapNavigationIntent } from '../composite/navigationIntent'
import { isSelfTarget } from '../interactions/element'
import type {
  PopoverContentProps,
  PopoverDisclosureProps,
  PopoverPropRecords,
  PopoverPropsOptions,
  PopoverWrapperProps,
  PopoverWrapperStyle,
} from '../popover/props'
import { popoverProps } from '../popover/props'
import type { CompositeOverflowModel } from './reatomCompositeOverflow'

/**
 * The style Ariakit gives the wrapper of a closed overflow popover.
 *
 * "Hiding the popover with `display: none` would prevent the hidden items to be
 * focused, so we just make it transparent and disable pointer events"
 * (`composite-overflow.tsx`) — which is the whole trick of the pattern: the
 * overflowing items stay in the composite, and navigating into one is what
 * opens the popover.
 */
export const COMPOSITE_OVERFLOW_HIDDEN_STYLE = {
  opacity: 0,
  pointerEvents: 'none',
} as const

/**
 * The minimal shape of a focus event the overflow records need.
 *
 * Structural on purpose: a DOM `FocusEvent`, a React synthetic event, and a
 * plain object from a unit test all satisfy it.
 */
export interface CompositeOverflowFocusEvent {
  /** When another handler already handled the event, the record skips it. */
  defaultPrevented?: boolean
  /** The element focus reached, which may be a child of the handling one. */
  target?: EventTarget | null
  /** The element the handler is attached to. */
  currentTarget?: EventTarget | null
}

/** The minimal shape of a key event the disclosure navigates from. */
export interface CompositeOverflowKeyEvent extends CompositeNavigationKeyEvent {
  defaultPrevented?: boolean
  target?: EventTarget | null
  currentTarget?: EventTarget | null
  preventDefault?: () => void
}

/** Props to spread on the button that opens the overflow popover. */
export interface CompositeOverflowDisclosureProps extends PopoverDisclosureProps {
  /** The `id` of the element, which is also its composite item id. */
  id: string
  /**
   * Hides the button from assistive technology while it belongs to a composite
   * and does not have focus.
   *
   * The items it stands for are composite items themselves, so a screen reader
   * reaches them without it; announcing a "+2 items" button as well would
   * duplicate them (`composite-overflow-disclosure.ts`: `aria-hidden:
   * !shouldRegisterItem`).
   */
  'aria-hidden': boolean
  /** Ariakit's styling hook, set while the disclosure is the active item. */
  'data-active-item': true | undefined
  /**
   * `-1` while the single tab stop of the composite belongs to another item —
   * the roving tabindex. `undefined` means "no attribute", so the button keeps
   * its native tab behavior: while it holds focus, and when there is no
   * composite or no rendered item to hold the tab stop.
   */
  tabIndex: number | undefined
  /** Joins the composite, and makes the disclosure its active item. */
  onFocus: (event?: CompositeOverflowFocusEvent) => void
  /** Leaves the composite again. */
  onBlur: (event?: CompositeOverflowFocusEvent) => void
  /** Arrow, Home / End, and PageUp / PageDown navigation of the composite. */
  onKeyDown: (event: CompositeOverflowKeyEvent) => void
}

/**
 * The positioning style of the wrapper, plus the transparency that replaces
 * `display: none` while the popover is closed.
 */
export interface CompositeOverflowWrapperStyle extends PopoverWrapperStyle {
  opacity?: 0
  pointerEvents?: 'none'
}

/** Props to spread on the wrapper element that carries the position. */
export interface CompositeOverflowWrapperProps extends Omit<
  PopoverWrapperProps,
  'style'
> {
  style: CompositeOverflowWrapperStyle
}

/** Props to spread on the overflow popover element. */
export interface CompositeOverflowContentProps extends Omit<
  PopoverContentProps,
  'role' | 'tabIndex'
> {
  /**
   * The popover is a container for items that carry their own roles, so it
   * claims none itself (`composite-overflow.tsx`: `role: 'presentation'`, which
   * wins over the `role: 'dialog'` `useDialog` would set).
   */
  role: 'presentation'
  /**
   * No tab stop of its own: Ariakit applies `usePopover({ focusable: false })`,
   * and `useDialog` then drops the `tabIndex: -1` a focusable dialog gets.
   */
  tabIndex: undefined
  /**
   * Shows the popover when focus reaches it, including from an overflowing item
   * inside it — the event is deliberately not checked for `isSelfTarget`.
   *
   * @remarks
   *   Ariakit relies on React's `onFocus`, which is delegated and therefore
   *   behaves like `focusin`. A native listener must use `focusin` too, because
   *   `focus` does not bubble.
   */
  onFocus: (event?: CompositeOverflowFocusEvent) => void
}

/** Reactive prop records of a composite overflow model. */
export interface CompositeOverflowPropRecords extends Omit<
  PopoverPropRecords,
  'disclosure' | 'wrapper' | 'content'
> {
  /** The button that opens the popover, and stands for the items inside it. */
  disclosure: Computed<CompositeOverflowDisclosureProps>
  /** The wrapper element the position is written to. */
  wrapper: Computed<CompositeOverflowWrapperProps>
  /** The popover element itself. */
  content: Computed<CompositeOverflowContentProps>
}

/**
 * Options of {@link compositeOverflowProps} and
 * {@link withCompositeOverflowProps}.
 */
export interface CompositeOverflowPropsOptions extends PopoverPropsOptions {
  /**
   * Keeps the popover element visible while it is not mounted.
   *
   * Defaults to `true` here, unlike for a plain popover: an overflow popover
   * that is hidden with `display: none` cannot hand focus to the items it
   * holds. Set it to `false` only if you take over that job — the popover then
   * behaves like any other, and the overflowing items are unreachable while it
   * is closed.
   *
   * @default true
   */
  alwaysVisible?: boolean
  /**
   * The popover records the overflow behavior is layered onto. Defaults to
   * fresh ones built from the model.
   *
   * @remarks
   *   Pass it to reuse records the caller already built — a model extended with
   *   `withPopoverProps`, or a wrapper widget that renames them. The
   *   `alwaysVisible`, `hidden`, `fixed`, and `arrowSize` options are then the
   *   ones those records were built with.
   */
  popover?: PopoverPropRecords
}

/** Whether the event was fired on a child of the element handling it. */
const isBubbled = (event?: CompositeOverflowFocusEvent): boolean =>
  !!event &&
  event.target != null &&
  event.currentTarget != null &&
  !isSelfTarget({ target: event.target, currentTarget: event.currentTarget })

/**
 * Builds the reactive prop records of a composite overflow model by layering
 * the overflow behavior onto the popover ones.
 *
 * @remarks
 *   Everything about positioning, dismissal, and the popover's own a11y comes
 *   from the popover records unchanged — the overflow adds three things Ariakit
 *   spends two components on: the popover element becomes a presentational,
 *   never-hidden container; its wrapper turns transparent instead of
 *   disappearing; and the disclosure becomes a composite item that exists only
 *   while it has focus.
 *
 *   The two handlers of `compositeItemProps` are re-implemented here rather than
 *   wrapped, for the same reason the tag records re-implement them: they need
 *   the item node, which does not exist while the disclosure is unfocused. Both
 *   are a few lines over the same {@link mapNavigationIntent}.
 *
 *   Ariakit additionally re-asserts its own element as the popover's
 *   `disclosureElement` from a `sync` listener, because several components may
 *   write that state. Here the `disclosure` record is the only writer, so the
 *   atom needs no guard.
 * @example
 *   const overflow = reatomCompositeOverflow({
 *     composite: toolbar,
 *     name: 'more',
 *   })
 *
 *   overflow.props.content().role // 'presentation'
 *   overflow.props.wrapper().style.opacity // 0 — closed, but focusable
 *   overflow.props.disclosure()['aria-hidden'] // true — until it has focus
 */
export const compositeOverflowProps = (
  model: CompositeOverflowModel,
  options: CompositeOverflowPropsOptions = {},
): CompositeOverflowPropRecords => {
  const {
    // Ariakit passes `alwaysVisible: true` into `usePopover`, so the popover
    // element is never `display: none` and the items inside it stay focusable.
    alwaysVisible = true,
    hidden,
    fixed,
    arrowSize,
    name = model.name,
  } = options
  const {
    disclosure: popoverDisclosure,
    wrapper: popoverWrapper,
    content: popoverContent,
    ...rest
  } = options.popover ??
  popoverProps(model, { alwaysVisible, hidden, fixed, arrowSize, name })
  const composite = model.composite

  const ref = wrap((element: HTMLElement | null) => {
    popoverDisclosure().ref(element)

    if (element) {
      model.disclosureItem()?.element.set(element)
      return
    }
    // The button left the DOM, so it is neither focused nor an item anymore.
    // Ariakit gets the same cleanup from the effect that registered the item.
    if (!model.disclosureFocused()) return
    model.disclosureFocused.set(false)
    model.unrenderDisclosure()
  })

  const onFocus = wrap((event?: CompositeOverflowFocusEvent) => {
    if (event?.defaultPrevented) return
    // Focus bubbling up from a child — an icon inside the button — is not the
    // button being focused.
    if (isBubbled(event)) return

    const element = (event?.currentTarget as HTMLElement | null) ?? null
    model.disclosureFocused.set(true)
    model.renderDisclosure(element ? { element } : {})
    // A focused composite item is the active one, as `compositeItemProps` does
    // for an ordinary item.
    composite?.set(model.disclosureId())
    notify()
  })

  const onBlur = wrap((event?: CompositeOverflowFocusEvent) => {
    if (event?.defaultPrevented) return
    if (isBubbled(event)) return

    model.disclosureFocused.set(false)
    model.unrenderDisclosure()
    notify()
  })

  const onKeyDown = wrap((event: CompositeOverflowKeyEvent) => {
    if (event.defaultPrevented) return
    if (!composite) return
    if (isBubbled(event)) return

    const intent = mapNavigationIntent(event, {
      orientation: composite.orientation(),
      grid: model.disclosureItem()?.rowId() !== undefined,
    })
    if (!intent) return

    // `undefined` means the navigation found nowhere to go, so the key keeps its
    // default behavior.
    if (composite.navigate(intent) !== undefined) event.preventDefault?.()
    notify()
  })

  const onPopoverFocus = wrap((event?: CompositeOverflowFocusEvent) => {
    if (event?.defaultPrevented) return
    model.show()
    notify()
  })

  return {
    ...rest,

    disclosure: computed((): CompositeOverflowDisclosureProps => {
      const id = model.disclosureId()
      const item = model.disclosureItem()

      return {
        ...popoverDisclosure(),
        id,
        'aria-hidden': composite ? !model.disclosureFocused() : false,
        'data-active-item': composite?.() === id || undefined,
        // A registered disclosure reuses the composite's derivation. Otherwise,
        // it can hold the tab stop only when no rendered item can hold it.
        tabIndex: !composite
          ? undefined
          : item
            ? item.tabbable()
              ? undefined
              : -1
            : composite.items.renderedItems().length
              ? -1
              : undefined,
        ref,
        onFocus,
        onBlur,
        onKeyDown,
      }
    }, `${name}.props.disclosure`),

    wrapper: computed((): CompositeOverflowWrapperProps => {
      const base = popoverWrapper()
      if (model.mounted()) return base

      return {
        ...base,
        style: { ...base.style, ...COMPOSITE_OVERFLOW_HIDDEN_STYLE },
      }
    }, `${name}.props.wrapper`),

    content: computed(
      (): CompositeOverflowContentProps => ({
        ...popoverContent(),
        role: 'presentation',
        tabIndex: undefined,
        onFocus: onPopoverFocus,
      }),
      `${name}.props.content`,
    ),
  }
}

/**
 * Attaches {@link compositeOverflowProps} to a composite overflow model as
 * `model.props`.
 *
 * {@link reatomCompositeOverflow} applies it already; use it explicitly for
 * models built from an adopted atom with {@link withCompositeOverflow}.
 *
 * @example
 *   const open = atom(false, 'more')
 *   const overflow = open
 *     .extend(withCompositeOverflow({ composite: toolbar }))
 *     .extend(withCompositeOverflowProps({ fixed: true }))
 */
export const withCompositeOverflowProps = (
  options: CompositeOverflowPropsOptions = {},
): AssignerExt<
  { props: CompositeOverflowPropRecords },
  CompositeOverflowModel
> => {
  return (target) => ({ props: compositeOverflowProps(target, options) })
}
