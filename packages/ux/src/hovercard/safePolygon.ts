/**
 * Layer 1 for `hovercard`: the safe-polygon geometry.
 *
 * A hovercard must not close while the pointer is travelling from the anchor to
 * the card, even though the pointer is over neither of them for a few frames.
 * The rule is geometric: build the polygon spanned by the point where the
 * pointer left the anchor and the card's own box, and treat every position
 * inside it as _hover intent_.
 *
 * Everything here is a pure function of numbers, so the whole policy is
 * asserted in Node — only the two `getBoundingClientRect` calls that feed it
 * need a browser.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/hovercard/utils/polygon.ts`.
 */

/** A viewport position, in CSS pixels. */
export type Point = [x: number, y: number]

/** A closed polygon, as the list of its vertices. */
export type Polygon = Array<Point>

/** The part of a `DOMRect` the polygon is built from. */
export interface PolygonRect {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * The pointer coordinates of a mouse event.
 *
 * Structural on purpose: a DOM `MouseEvent`, a React synthetic event, and a
 * plain object from a unit test all satisfy it.
 */
export interface PointerPosition {
  clientX: number
  clientY: number
}

/** The viewport position a mouse event happened at. */
export const getEventPoint = (event: PointerPosition): Point => [
  event.clientX,
  event.clientY,
]

/**
 * Whether a point lies inside a polygon, edges and vertices included.
 *
 * @remarks
 *   A ray-casting test, ported verbatim from Ariakit's `isPointInPolygon`, which
 *   is itself based on [pointinpoly](https://github.com/metafloor/pointinpoly).
 *   The vertex look-back (`vertexPoint`) is what keeps a ray that passes
 *   exactly through a vertex from counting the crossing twice.
 *
 *   A malformed polygon — a hole in the vertex list — is reported as "outside"
 *   rather than throwing, because an unfinished polygon is normal while the
 *   pointer is still being tracked.
 * @example
 *   const box: Polygon = [
 *     [2, 2],
 *     [2, 4],
 *     [4, 4],
 *     [4, 2],
 *   ]
 *
 *   isPointInPolygon([3, 3], box) // true
 *   isPointInPolygon([2, 3], box) // true — on the edge
 *   isPointInPolygon([5, 3], box) // false
 */
export const isPointInPolygon = (
  point: Point,
  polygon: ReadonlyArray<Point | undefined>,
): boolean => {
  const [x, y] = point
  let inside = false
  const length = polygon.length

  for (let l = length, i = 0, j = l - 1; i < l; j = i++) {
    const currentPoint = polygon[i]
    const previousPoint = polygon[j]
    const vertexPoint = polygon[j === 0 ? l - 1 : j - 1]
    if (currentPoint == null) return false
    if (previousPoint == null) return false
    if (vertexPoint == null) return false

    const [xi, yi] = currentPoint
    const [xj, yj] = previousPoint
    const [, vy] = vertexPoint
    const where = (yi - yj) * (x - xi) - (xi - xj) * (y - yi)

    if (yj < yi) {
      if (y >= yj && y < yi) {
        // The point sits on the edge.
        if (where === 0) return true
        if (where > 0) {
          if (y === yj) {
            // The ray goes through a vertex, so only one of the two edges
            // meeting there may count.
            if (y > vy) inside = !inside
          } else {
            inside = !inside
          }
        }
      }
    } else if (yi < yj) {
      if (y > yi && y <= yj) {
        if (where === 0) return true
        if (where < 0) {
          if (y === yj) {
            if (y < vy) inside = !inside
          } else {
            inside = !inside
          }
        }
      }
    } else if (y === yi && ((x >= xj && x <= xi) || (x >= xi && x <= xj))) {
      // The point sits on a horizontal edge.
      return true
    }
  }

  return inside
}

/** Which sides of the rect the enter point is outside of. */
const getEnterPointPlacement = (
  enterPoint: Point,
  rect: PolygonRect,
): readonly ['left' | 'right' | null, 'top' | 'bottom' | null] => {
  const { top, right, bottom, left } = rect
  const [x, y] = enterPoint

  return [
    x < left ? 'left' : x > right ? 'right' : null,
    y < top ? 'top' : y > bottom ? 'bottom' : null,
  ] as const
}

/**
 * The polygon the pointer may travel through without the card closing: the
 * point it left the anchor at, plus the card's box.
 *
 * @remarks
 *   Port of Ariakit's `getElementPolygon`, with the card's
 *   `getBoundingClientRect` result passed in so the function stays pure.
 *
 *   The vertices are ordered so the polygon stays convex whichever side the enter
 *   point is on: the two card corners nearest the pointer come first, the two
 *   far ones last, and a corner is dropped when the pointer is already aligned
 *   with that edge — otherwise the polygon would fold over itself and the
 *   ray-casting test would report the inside as outside.
 * @example
 *   // the pointer is above a card, so the polygon is a quadrilateral fanning
 *   // out from the pointer down to the card's top edge and around its box
 *   getSafePolygon({ top: 10, right: 20, bottom: 30, left: 0 }, [10, 0])
 *   // [[10, 0], [0, 10], [0, 30], [20, 30], [20, 10]]
 *
 * @param rect - The card's viewport box.
 * @param enterPoint - Where the pointer left the anchor.
 */
export const getSafePolygon = (
  rect: PolygonRect,
  enterPoint: Point,
): Polygon => {
  const { top, right, bottom, left } = rect
  const [x, y] = getEnterPointPlacement(enterPoint, rect)
  const polygon: Polygon = [enterPoint]

  if (x) {
    if (y !== 'top') polygon.push([x === 'left' ? left : right, top])
    polygon.push([x === 'left' ? right : left, top])
    polygon.push([x === 'left' ? right : left, bottom])
    if (y !== 'bottom') polygon.push([x === 'left' ? left : right, bottom])
  } else if (y === 'top') {
    polygon.push([left, top])
    polygon.push([left, bottom])
    polygon.push([right, bottom])
    polygon.push([right, top])
  } else {
    polygon.push([left, bottom])
    polygon.push([left, top])
    polygon.push([right, top])
    polygon.push([right, bottom])
  }

  return polygon
}
