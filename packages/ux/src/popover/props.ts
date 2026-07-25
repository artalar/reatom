/**
 * Layer 2 for `popover`: the reactive prop records.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/popover/popover.tsx`,
 * `popover-anchor.tsx`, `popover-disclosure.tsx`, and `popover-arrow.tsx`.
 * `popover-dismiss.tsx`, `popover-heading.tsx`, and `popover-description.tsx`
 * add nothing to their dialog counterparts, so those records are inherited
 * unchanged.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed, wrap } from '@reatom/core'

import type {
  DialogClickEvent,
  DialogContentProps,
  DialogDisclosureProps,
  DialogPropRecords,
  DialogPropsOptions,
} from '../dialog/props'
import { dialogProps } from '../dialog/props'
import type { PopoverModel } from './reatomPopover'

/** The size Ariakit's `PopoverArrow` defaults to, in pixels. */
export const POPOVER_ARROW_SIZE = 30

/** Props to spread on the element the popover is positioned against. */
export interface PopoverAnchorProps {
  /** Assigns the model's `anchorElement`; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
}

/** Props to spread on the button that opens the popover. */
export interface PopoverDisclosureProps extends DialogDisclosureProps {
  /**
   * Toggles the popover and adopts the button as the anchor, so a popover whose
   * anchor _is_ its button needs no `anchor` record (`popover-disclosure.tsx`:
   * the component applies `usePopoverAnchor` and sets `anchorElement` from the
   * click as well).
   */
  onClick: (event?: DialogClickEvent) => void
  /** Assigns both `disclosureElement` and `anchorElement`. */
  ref: (element: HTMLElement | null) => void
}

/**
 * The layout Ariakit gives the positioning wrapper: the popover is placed with
 * a transform from the top left corner, and `max-content` keeps the wrapper
 * from being squeezed by its parent (`popover.tsx`, `wrapperProps`, and
 * [floating-ui's initial
 * layout](https://floating-ui.com/docs/computeposition#initial-layout)).
 */
export interface PopoverWrapperStyle {
  position: 'absolute' | 'fixed'
  top: 0
  left: 0
  width: 'max-content'
}

/** Props to spread on the wrapper element that carries the position. */
export interface PopoverWrapperProps {
  style: PopoverWrapperStyle
  /** Assigns the model's `popoverElement`; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
}

/**
 * The popover element is the positioning context of its arrow, which is why
 * Ariakit forces `position: relative` on it (`popover.tsx:462-467`).
 */
export interface PopoverContentStyle {
  position: 'relative'
  /** Set while hidden, so a `display` rule cannot win over the attribute. */
  display?: 'none'
}

/** Props to spread on the popover element — the dialog element of a popover. */
export interface PopoverContentProps extends Omit<DialogContentProps, 'style'> {
  style: PopoverContentStyle
  /**
   * `true` while the popover is mounted but not placed yet.
   *
   * @remarks
   *   Ariakit documents this attribute as private ("data-placing is not part of
   *   the public API"), but it is the only way a component that renders
   *   _inside_ a popover can wait for the position — the autoselecting combobox
   *   observes it. It is kept because the model owns the same state as
   *   `placing`, and a view has no other way to expose it to CSS.
   */
  'data-placing': true | undefined
}

/** Props to spread on the arrow element inside the popover. */
export interface PopoverArrowProps {
  'aria-hidden': true
  style: PopoverArrowStyle
  /** Assigns the model's `arrowElement`; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
}

/**
 * The box Ariakit reserves for the arrow: a square whose side is `size`, placed
 * by the positioning layer and never itself a pointer target
 * (`popover-arrow.tsx:154-170`). The arrow's own shape — Ariakit renders an SVG
 * path and infers its colors from the popover's computed style — is a view
 * concern.
 */
export interface PopoverArrowStyle {
  position: 'absolute'
  /** `width` and `height` are `1em`, so the font size is the arrow size. */
  fontSize: number
  width: '1em'
  height: '1em'
  pointerEvents: 'none'
}

/** Reactive prop records of a popover model. */
export interface PopoverPropRecords extends Omit<
  DialogPropRecords,
  'disclosure' | 'content'
> {
  /** The element the popover is positioned against. */
  anchor: Computed<PopoverAnchorProps>
  /** The button that opens the popover, and anchors it by default. */
  disclosure: Computed<PopoverDisclosureProps>
  /** The wrapper element the position is written to. */
  wrapper: Computed<PopoverWrapperProps>
  /** The popover element itself. */
  content: Computed<PopoverContentProps>
  /** The arrow that points at the anchor. */
  arrow: Computed<PopoverArrowProps>
}

/** Options of {@link popoverProps} and {@link withPopoverProps}. */
export interface PopoverPropsOptions extends DialogPropsOptions {
  /**
   * Whether the wrapper is positioned with `fixed` instead of `absolute`, for a
   * popover inside a clipping or transformed ancestor.
   *
   * @default false
   */
  fixed?: boolean
  /**
   * The size of the arrow's box, in pixels.
   *
   * @default 30
   */
  arrowSize?: number
}

/**
 * Builds the reactive prop records of a popover model.
 *
 * @remarks
 *   The dialog records are composed, not reimplemented: `backdrop`, `dismiss`,
 *   `heading`, `description`, and `focusTrap` are the dialog's own, `content`
 *   is the dialog's plus what positioning needs, and `disclosure` is the
 *   dialog's plus the anchor bookkeeping. The base records are built under the
 *   same name — a popover's `content` record _is_ its dialog's `content`
 *   record, one layer down — so the element ids stay the ones a dialog would
 *   render.
 *
 *   Three elements are new, and they nest: the `wrapper` carries the position,
 *   the `content` inside it is the dialog element, and the `arrow` inside that
 *   points back at the anchor. Rendering the wrapper is what lets a consumer
 *   animate the popover without overriding the transform the positioner
 *   writes.
 * @example
 *   const popover = reatomPopover({ name: 'filters' })
 *
 *   popover.props.disclosure().onClick({ currentTarget: button })
 *   popover.anchorElement() // button
 *   popover.props.content()['data-placing'] // true — not placed yet
 */
export const popoverProps = (
  model: PopoverModel,
  options: PopoverPropsOptions = {},
): PopoverPropRecords => {
  const {
    fixed = false,
    arrowSize = POPOVER_ARROW_SIZE,
    alwaysVisible,
    hidden,
    name = model.name,
  } = options
  const dialog = dialogProps(model, { alwaysVisible, hidden, name })

  return {
    ...dialog,

    anchor: computed(
      (): PopoverAnchorProps => ({
        ref: wrap((element: HTMLElement | null) => {
          model.anchorElement.set(element)
        }),
      }),
      `${name}.props.anchor`,
    ),

    disclosure: computed((): PopoverDisclosureProps => {
      const base = dialog.disclosure()

      return {
        ...base,
        // The anchor is adopted even when the click was prevented, matching
        // Ariakit's order: `usePopoverDisclosure` sets the anchor element first
        // and only then runs the handler that may have prevented the toggle.
        onClick: wrap((event?: DialogClickEvent) => {
          const element = event?.currentTarget
          if (element) model.anchorElement.set(element as HTMLElement)
          base.onClick(event)
        }),
        ref: wrap((element: HTMLElement | null) => {
          model.anchorElement.set(element)
          base.ref(element)
        }),
      }
    }, `${name}.props.disclosure`),

    wrapper: computed(
      (): PopoverWrapperProps => ({
        style: {
          position: fixed ? 'fixed' : 'absolute',
          top: 0,
          left: 0,
          width: 'max-content',
        },
        ref: wrap((element: HTMLElement | null) => {
          model.popoverElement.set(element)
        }),
      }),
      `${name}.props.wrapper`,
    ),

    content: computed((): PopoverContentProps => {
      const base = dialog.content()

      return {
        ...base,
        style: { position: 'relative', ...base.style },
        'data-placing': model.placing() || undefined,
      }
    }, `${name}.props.content`),

    arrow: computed(
      (): PopoverArrowProps => ({
        'aria-hidden': true,
        style: {
          position: 'absolute',
          fontSize: arrowSize,
          width: '1em',
          height: '1em',
          pointerEvents: 'none',
        },
        ref: wrap((element: HTMLElement | null) => {
          model.arrowElement.set(element)
        }),
      }),
      `${name}.props.arrow`,
    ),
  }
}

/**
 * Attaches {@link popoverProps} to a popover model as `model.props`.
 *
 * {@link reatomPopover} applies it already; use it explicitly for models built
 * from an adopted atom with `withPopover`.
 *
 * @example
 *   const open = atom(false, 'filters.open')
 *   const filters = open
 *     .extend(withPopover())
 *     .extend(withPopoverProps({ fixed: true }))
 */
export const withPopoverProps = (
  options: PopoverPropsOptions = {},
): AssignerExt<{ props: PopoverPropRecords }, PopoverModel> => {
  return (target) => ({ props: popoverProps(target, options) })
}
