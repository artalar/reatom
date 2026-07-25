/**
 * Layer 2 for `popover`: placing the popover next to its anchor.
 *
 * `@reatom/ux` does not depend on a positioning engine — positioning is a view
 * concern (`PORTING_PLAN.md` §3, Bucket C), and pulling
 * [floating-ui](https://floating-ui.com) into every bundle that imports a
 * checkbox would be wrong. So this file is the seam: the reactive wiring, the
 * DOM writes, and the pure geometry Ariakit works out are here, and the
 * measurement itself is injected.
 *
 * TODO: ship a batteries-included `withFloating()` overload that builds the
 * floating-ui middleware chain itself — `offset` from
 * {@link resolvePopoverOffset}, `flip` from `parsePopoverFlip`, plus `shift`,
 * `size`, and `arrow` — once `@floating-ui/dom` is an optional peer dependency
 * of the package. Until then the caller passes `computePosition` / `autoUpdate`
 * in.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/popover/popover.tsx`.
 */

import type { Action, AssignerExt } from '@reatom/core'
import {
  abortVar,
  action,
  effect,
  getCalls,
  notify,
  withAbort,
  withConnectHook,
  wrap,
} from '@reatom/core'

import type { PopoverBasePlacement, PopoverPlacement } from './popoverPlacement'
import { getPopoverAlignment, getPopoverSide } from './popoverPlacement'
import type { PopoverModel } from './reatomPopover'

/** How far the popover is pushed away from its anchor, per axis. */
export interface PopoverOffset {
  /** Along the placement side: the gutter plus half the arrow. */
  mainAxis: number
  /** Across the placement side, for centered placements only. */
  crossAxis: number | undefined
  /** Along the placement side's alignment, for aligned placements. */
  alignmentAxis: number | undefined
}

/** What {@link resolvePopoverOffset} needs to know about the popover. */
export interface PopoverOffsetContext {
  /** The requested placement, which decides where the shift applies. */
  placement: PopoverPlacement
  /**
   * The distance between the popover and its anchor. Defaults to half the
   * arrow's height, so an arrow never overlaps the anchor.
   */
  gutter?: number
  /**
   * The skidding of the popover along the anchor. Negative values shift it to
   * the opposite side.
   *
   * @default 0
   */
  shift?: number
  /**
   * The arrow's height, `0` when the popover has no arrow.
   *
   * @default 0
   */
  arrowHeight?: number
}

/**
 * Resolves the popover's offset from its anchor.
 *
 * @remarks
 *   Port of Ariakit's `getOffsetMiddleware` (`popover.tsx:102-123`), which feeds
 *   [floating-ui's `offset`](https://floating-ui.com/docs/offset). Two details
 *   are easy to get wrong:
 *
 *   - Half the arrow is added to the gutter, so the gutter is measured from the
 *       arrow's tip rather than from the popover's edge — and a `gutter` left
 *       undefined _becomes_ that half arrow instead of `0`.
 *   - A centered placement has no alignment axis, so the shift is applied to the
 *       cross axis instead ("we'll fallback to the crossAxis offset as it also
 *       works for center-aligned placements").
 *
 * @example
 *   resolvePopoverOffset({ placement: 'bottom', arrowHeight: 8, shift: 4 })
 *   // { mainAxis: 4, crossAxis: 4, alignmentAxis: 4 }
 *   resolvePopoverOffset({ placement: 'bottom-end', gutter: 8 })
 *   // { mainAxis: 8, crossAxis: undefined, alignmentAxis: undefined }
 */
export const resolvePopoverOffset = ({
  placement,
  gutter,
  shift,
  arrowHeight = 0,
}: PopoverOffsetContext): PopoverOffset => {
  const arrowOffset = arrowHeight / 2
  const mainAxis =
    typeof gutter === 'number' ? gutter + arrowOffset : (gutter ?? arrowOffset)
  const aligned = getPopoverAlignment(placement) !== null

  return {
    mainAxis,
    crossAxis: aligned ? undefined : shift,
    alignmentAxis: shift,
  }
}

/** Where the arrow sits inside the popover, and how big it is. */
export interface PopoverArrowMetrics {
  /** The arrow's horizontal offset, for a `top` or `bottom` placement. */
  x?: number
  /** The arrow's vertical offset, for a `left` or `right` placement. */
  y?: number
  /** The arrow's width, in pixels. */
  width: number
  /** The arrow's height, in pixels. */
  height: number
}

/**
 * The `transform-origin` a popover animates from: the point its arrow touches
 * the anchor.
 *
 * Port of the `--popover-transform-origin` map Ariakit writes after positioning
 * the arrow (`popover.tsx:326-346`).
 *
 * @example
 *   getPopoverTransformOrigin('bottom', { x: 12, width: 20, height: 10 })
 *   // '22px -5px'
 */
export const getPopoverTransformOrigin = (
  side: PopoverBasePlacement,
  arrow: PopoverArrowMetrics,
): string => {
  const centerX = arrow.width / 2
  const centerY = arrow.height / 2
  const originX = arrow.x != null ? arrow.x + centerX : -centerX
  const originY = arrow.y != null ? arrow.y + centerY : -centerY

  return {
    top: `${originX}px calc(100% + ${centerY}px)`,
    bottom: `${originX}px ${-centerY}px`,
    left: `calc(100% + ${centerX}px) ${originY}px`,
    right: `${-centerX}px ${originY}px`,
  }[side]
}

/**
 * Rounds a coordinate to a physical pixel.
 *
 * Port of Ariakit's `roundByDPR` (`popover.tsx:96-100`), which exists because
 * [subpixel
 * positioning](https://floating-ui.com/docs/misc#subpixel-and-accelerated-positioning)
 * blurs text on fractional device pixel ratios. The ratio is a parameter so the
 * function stays pure and testable; it defaults to the current window's.
 *
 * @example
 *   roundByDevicePixelRatio(10.3, 2) // 10.5
 */
export const roundByDevicePixelRatio = (
  value: number,
  devicePixelRatio: number = globalThis.devicePixelRatio || 1,
): number => Math.round(value * devicePixelRatio) / devicePixelRatio

/** A position the popover can be moved to. */
export interface PopoverPosition {
  /** The offset from the wrapper's origin, in CSS pixels. */
  x: number
  y: number
  /** The placement that was actually used, after flipping. */
  placement: PopoverPlacement
  /**
   * Where the arrow ended up inside the popover, floating-ui's
   * `middlewareData.arrow`. Omit it when the popover has no arrow.
   */
  arrow?: { x?: number; y?: number }
}

/** Everything a positioner needs to measure a popover. */
export interface PopoverPositionRequest {
  /** The element to position against, `null` for a detached popover. */
  anchorElement: HTMLElement | null
  /** The wrapper element the position is written to. */
  popoverElement: HTMLElement
  /** The arrow element, `null` when the popover has none. */
  arrowElement: HTMLElement | null
  /** The requested placement. */
  placement: PopoverPlacement
  /** Floating-ui's `strategy`, derived from the `fixed` option. */
  strategy: 'absolute' | 'fixed'
}

/**
 * Measures where the popover should go.
 *
 * Shaped after [floating-ui's
 * `computePosition`](https://floating-ui.com/docs/computePosition) so an
 * adapter is a few lines, but nothing here is floating-ui specific.
 */
export interface PopoverPositioner {
  (request: PopoverPositionRequest): PopoverPosition | Promise<PopoverPosition>
}

/**
 * Watches everything that can move the popover and calls `update`.
 *
 * Shaped after [floating-ui's
 * `autoUpdate`](https://floating-ui.com/docs/autoUpdate): it must return the
 * function that stops watching.
 */
export interface PopoverAutoUpdate {
  (request: PopoverPositionRequest, update: () => void): () => void
}

/** Options of {@link withFloating}. */
export interface PopoverFloatingOptions {
  /** Measures the position — pass `@floating-ui/dom`'s `computePosition`. */
  computePosition: PopoverPositioner
  /**
   * Keeps the position fresh while the popover is mounted — pass
   * `@floating-ui/dom`'s `autoUpdate`. Without it the popover is placed once
   * per change of its inputs, and scrolling the anchor out from under it is the
   * caller's problem.
   */
  autoUpdate?: PopoverAutoUpdate
  /**
   * Whether the popover is positioned with `fixed` instead of `absolute`. Must
   * match the `fixed` option of the prop records.
   *
   * @default false
   */
  fixed?: boolean
  /**
   * The minimum distance between the popover and the viewport edge, exposed to
   * CSS as `--popover-overflow-padding` for a consumer that sizes itself
   * (`popover.tsx:274-281`). The positioner is expected to honor the same value
   * as its middleware padding.
   *
   * @default 8
   */
  overflowPadding?: number
}

/** Units attached by {@link withFloating}. */
export interface PopoverFloatingUnits {
  /**
   * Measures and applies the position once. Called automatically while the
   * model is connected; call it directly to place a popover you rendered
   * yourself.
   */
  position: Action<[], Promise<void>>
}

/**
 * Writes a measured position to the popover and its arrow.
 *
 * Port of the DOM half of Ariakit's `updatePosition` (`popover.tsx:316-353`):
 * the popover is moved with a `translate3d` from its top left corner, which is
 * what keeps the transform composited, and the arrow is pushed to the popover's
 * edge on the placement side.
 */
export const applyPopoverPosition = (
  popoverElement: HTMLElement,
  arrowElement: HTMLElement | null,
  position: PopoverPosition,
  devicePixelRatio?: number,
): void => {
  const x = roundByDevicePixelRatio(position.x, devicePixelRatio)
  const y = roundByDevicePixelRatio(position.y, devicePixelRatio)

  Object.assign(popoverElement.style, {
    top: '0',
    left: '0',
    transform: `translate3d(${x}px,${y}px,0)`,
  })

  if (!arrowElement || !position.arrow) return

  const side = getPopoverSide(position.placement)
  const { x: arrowX, y: arrowY } = position.arrow

  popoverElement.style.setProperty(
    '--popover-transform-origin',
    getPopoverTransformOrigin(side, {
      x: arrowX,
      y: arrowY,
      width: arrowElement.clientWidth,
      height: arrowElement.clientHeight,
    }),
  )

  Object.assign(arrowElement.style, {
    left: arrowX != null ? `${arrowX}px` : '',
    top: arrowY != null ? `${arrowY}px` : '',
    [side]: '100%',
  })
}

/**
 * Keeps the popover positioned next to its anchor.
 *
 * @remarks
 *   The reactive part of Ariakit's positioning layout effect, with its dependency
 *   array replaced by the dependency graph: the flow re-runs when the popover
 *   mounts, when any of the three element handles changes, when the requested
 *   `placement` changes, and when `reposition()` is called — which is Ariakit's
 *   `rendered` symbol dependency without the symbol.
 *
 *   Everything is lazy: nothing is measured until the model has a subscriber,
 *   `withAbort()` drops a measurement that a newer one superseded, and the
 *   `autoUpdate` teardown plus the `positioned` reset run through
 *   `abortVar.subscribe`, so they fire whenever the flow restarts — including
 *   when the popover leaves the screen, which is when watching the anchor has
 *   to stop.
 * @example
 *   import {
 *     autoUpdate,
 *     computePosition,
 *     flip,
 *     offset,
 *   } from '@floating-ui/dom'
 *
 *   const filters = reatomPopover({ name: 'filters' }).extend(
 *     withFloating({
 *       computePosition: async (request) => {
 *         const { x, y, placement, middlewareData } = await computePosition(
 *           request.anchorElement!,
 *           request.popoverElement,
 *           {
 *             placement: request.placement,
 *             strategy: request.strategy,
 *             middleware: [offset(resolvePopoverOffset(request)), flip()],
 *           },
 *         )
 *         return { x, y, placement, arrow: middlewareData.arrow }
 *       },
 *       autoUpdate: (request, update) =>
 *         autoUpdate(request.anchorElement!, request.popoverElement, update),
 *     }),
 *   )
 */
export const withFloating = (
  options: PopoverFloatingOptions,
): AssignerExt<PopoverFloatingUnits, PopoverModel> => {
  const {
    computePosition,
    autoUpdate,
    fixed = false,
    overflowPadding = 8,
  } = options

  return (target) => {
    const { name } = target

    const request = (popoverElement: HTMLElement): PopoverPositionRequest => ({
      anchorElement: target.anchorElement(),
      popoverElement,
      arrowElement: target.arrowElement(),
      placement: target.placement(),
      strategy: fixed ? 'fixed' : 'absolute',
    })

    const position = action(async () => {
      const popoverElement = target.popoverElement()
      if (!popoverElement) return

      const measured = await wrap(
        Promise.resolve(computePosition(request(popoverElement))),
      )

      // Ariakit reports the resolved placement back to the store, which is what
      // makes the arrow point the right way after a flip.
      target.currentPlacement.set(measured.placement)
      applyPopoverPosition(popoverElement, target.arrowElement(), measured)
      target.positioned.set(true)
    }, `${name}.position`).extend(withAbort())

    target.extend(
      withConnectHook(() => {
        effect(() => {
          // Every read is unconditional: the calls read is the subscription to
          // the reposition event, and the handles are what the flow will need.
          getCalls(target.reposition)
          const isMounted = target.mounted()
          const popoverElement = target.popoverElement()
          const anchorElement = target.anchorElement()
          const arrowElement = target.arrowElement()
          const placement = target.placement()

          if (!isMounted || !popoverElement) return

          popoverElement.style.setProperty(
            '--popover-overflow-padding',
            `${overflowPadding}px`,
          )

          // Ariakit resets `positioned` from this effect's cleanup, so a
          // popover whose anchor or placement changed is "placing" again until
          // the new position lands.
          abortVar.subscribe(() => target.positioned.set(false))

          if (autoUpdate) {
            abortVar.subscribe(
              autoUpdate(
                {
                  anchorElement,
                  popoverElement,
                  arrowElement,
                  placement,
                  strategy: fixed ? 'fixed' : 'absolute',
                },
                wrap(() => {
                  position()
                  notify()
                }),
              ),
            )
          }

          return position()
        }, `${name}.positioning`)
      }),
    )

    return { position }
  }
}
