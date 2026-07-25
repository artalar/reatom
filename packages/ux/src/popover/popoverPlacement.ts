/**
 * Pure placement vocabulary for `popover`.
 *
 * Layer 1 (pure). Ariakit spreads these string operations over three files —
 * the placement union is redeclared in `popover-store.ts` and `popover.tsx`,
 * `popover-arrow.tsx` derives the side with `currentPlacement.split("-")[0]`,
 * and `popover.tsx` validates the `flip` option with a regex. Collecting them
 * here keeps every placement decision node-testable and lets the positioning
 * layer stay a thin adapter.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC).
 */

/** The side of the anchor the popover is placed on. */
export type PopoverBasePlacement = 'top' | 'bottom' | 'left' | 'right'

/** How the popover is aligned along that side. `null` is centered. */
export type PopoverAlignment = 'start' | 'end'

/**
 * A popover placement, in the [floating-ui
 * vocabulary](https://floating-ui.com/docs/computePosition#placement) Ariakit
 * uses: a side, optionally suffixed with an alignment.
 */
export type PopoverPlacement =
  | PopoverBasePlacement
  | `${PopoverBasePlacement}-${PopoverAlignment}`

/** Every side a popover can be placed on, in floating-ui's order. */
export const POPOVER_BASE_PLACEMENTS = [
  'top',
  'right',
  'bottom',
  'left',
] as const satisfies ReadonlyArray<PopoverBasePlacement>

/**
 * Whether a string is a placement.
 *
 * Port of Ariakit's `isValidPlacement` (`popover.tsx`), which guards the
 * spaced-delimited `flip` option.
 *
 * @example
 *   isPopoverPlacement('top-start') // true
 *   isPopoverPlacement('above') // false
 */
export const isPopoverPlacement = (value: string): value is PopoverPlacement =>
  /^(?:top|bottom|left|right)(?:-(?:start|end))?$/.test(value)

/**
 * The side of a placement.
 *
 * Ariakit derives the same value inline wherever it needs the direction —
 * `popover-arrow.tsx` for the arrow rotation and `popover.tsx` for the
 * transform origin.
 *
 * @example
 *   getPopoverSide('bottom-end') // 'bottom'
 */
export const getPopoverSide = (
  placement: PopoverPlacement,
): PopoverBasePlacement => placement.split('-')[0] as PopoverBasePlacement

/**
 * The alignment of a placement, or `null` when it is centered.
 *
 * Ariakit's offset middleware branches on exactly this: without an alignment
 * there is no alignment axis to shift along, so the shift is applied to the
 * cross axis instead (`popover.tsx`, `getOffsetMiddleware`).
 *
 * @example
 *   getPopoverAlignment('bottom-end') // 'end'
 *   getPopoverAlignment('bottom') // null
 */
export const getPopoverAlignment = (
  placement: PopoverPlacement,
): PopoverAlignment | null =>
  (placement.split('-')[1] as PopoverAlignment | undefined) ?? null

/** What the `flip` option asks the positioning layer to do. */
export interface PopoverFlipPolicy {
  /** Whether the popover may flip to another side when it overflows. */
  enabled: boolean
  /**
   * The placements to try, in order, or `null` for the positioner's default
   * (the opposite side).
   */
  fallbackPlacements: Array<PopoverPlacement> | null
}

/**
 * Resolves Ariakit's `flip` option into a placement policy.
 *
 * @remarks
 *   Ariakit accepts three shapes and validates the third with an `invariant`
 *   ("`flip` expects a spaced-delimited list of placements",
 *   `popover.tsx:125-143`): `false` disables flipping, `true` uses the
 *   positioner's default fallbacks, and a spaced-delimited string is the
 *   explicit fallback list.
 * @example
 *   parsePopoverFlip(false) // { enabled: false, fallbackPlacements: null }
 *   parsePopoverFlip('top left')
 *   // { enabled: true, fallbackPlacements: ['top', 'left'] }
 *
 * @throws TypeError When the string contains something that is not a placement.
 *   Ariakit only throws in development; a pure function has no build mode, and
 *   a silently ignored typo is worse than a thrown one.
 */
export const parsePopoverFlip = (
  flip: boolean | string = true,
): PopoverFlipPolicy => {
  if (flip === false) return { enabled: false, fallbackPlacements: null }
  if (flip === true) return { enabled: true, fallbackPlacements: null }

  const fallbackPlacements = flip.split(' ').filter(Boolean)
  const invalid = fallbackPlacements.filter(
    (placement) => !isPopoverPlacement(placement),
  )

  if (invalid.length) {
    throw new TypeError(
      `\`flip\` expects a spaced-delimited list of placements, got ${invalid.join(', ')}`,
    )
  }

  return {
    enabled: true,
    fallbackPlacements: fallbackPlacements as Array<PopoverPlacement>,
  }
}
