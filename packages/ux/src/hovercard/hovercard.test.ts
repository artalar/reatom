import { atom, context, isAbort } from '@reatom/core'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { HovercardMoveContext } from './hovercardIntent'
import {
  getPointerMovement,
  mapHovercardMoveIntent,
  mapHovercardShowIntent,
  nextHovercardEnterPoint,
} from './hovercardIntent'
import { hovercardProps, withHovercardProps } from './props'
import { reatomHovercard, withHovercard } from './reatomHovercard'
import { pointerMoving, reatomPointerMoving } from './reatomPointerMoving'
import type { Polygon, PolygonRect } from './safePolygon'
import { getEventPoint, getSafePolygon, isPointInPolygon } from './safePolygon'

beforeEach(() => context.reset())
afterEach(() => vi.useRealTimers())

/**
 * A stand-in for a DOM node. The model only stores element handles and the prop
 * records only read `isConnected`, so a plain object is enough — no browser
 * needed. The safe polygon is fed a plain rect for the same reason.
 */
const element = (id = '', isConnected = false): HTMLElement =>
  ({ id, isConnected, style: {} }) as unknown as HTMLElement

/** Swallows the rejection an aborted delay produces, and reports it happened. */
const aborted = async (promise: Promise<void>): Promise<boolean> => {
  try {
    await promise
    return false
  } catch (error) {
    if (!isAbort(error)) throw error
    return true
  }
}

// --- safe polygon -----------------------------------------------------------

test('getEventPoint reads the viewport position of a mouse event', () => {
  expect(getEventPoint({ clientX: 12, clientY: 34 })).toEqual([12, 34])
})

test('isPointInPolygon answers for the inside, the outside, and the border', () => {
  // ariakit-react-components/src/hovercard/utils/__tests__/polygon.test.ts
  const box: Polygon = [
    [2, 2],
    [2, 4],
    [4, 4],
    [4, 2],
  ]

  expect(isPointInPolygon([3, 3], box)).toBe(true)
  // the border counts as inside, so a pointer resting exactly on the card's
  // edge cannot fall through the polygon
  expect(isPointInPolygon([2, 3], box)).toBe(true)
  expect(isPointInPolygon([3, 2], box)).toBe(true)
  expect(isPointInPolygon([2, 2], box)).toBe(true)
  expect(isPointInPolygon([4, 4], box)).toBe(true)

  expect(isPointInPolygon([1, 3], box)).toBe(false)
  expect(isPointInPolygon([5, 3], box)).toBe(false)
  expect(isPointInPolygon([3, 1], box)).toBe(false)
  expect(isPointInPolygon([3, 5], box)).toBe(false)
})

test('isPointInPolygon counts a ray through a vertex once', () => {
  // A concave polygon is the case the vertex look-back exists for: the ray from
  // [1, 3] crosses the notch's tip, and counting it twice would report the
  // point as outside.
  const arrow: Polygon = [
    [2, 1],
    [2, 5],
    [6, 3],
  ]

  expect(isPointInPolygon([3, 3], arrow)).toBe(true)
  expect(isPointInPolygon([1, 3], arrow)).toBe(false)
  expect(isPointInPolygon([7, 3], arrow)).toBe(false)
})

test('isPointInPolygon reports a hole in the vertex list as outside', () => {
  // An unfinished polygon is normal while the pointer is still being tracked,
  // so it must not throw.
  expect(isPointInPolygon([3, 3], [[2, 2], undefined, [4, 2]])).toBe(false)
})

/** A card 20 wide and 20 tall, 10 below the top of the viewport. */
const card: PolygonRect = { top: 10, right: 20, bottom: 30, left: 0 }

test('getSafePolygon fans out from a pointer above the card', () => {
  expect(getSafePolygon(card, [10, 0])).toEqual([
    [10, 0],
    [0, 10],
    [0, 30],
    [20, 30],
    [20, 10],
  ])
})

test('getSafePolygon fans out from a pointer below the card', () => {
  // The vertex order is reversed, so the polygon stays convex and the
  // ray-casting test keeps reporting its inside as inside.
  const polygon = getSafePolygon(card, [10, 40])

  expect(polygon).toEqual([
    [10, 40],
    [0, 30],
    [0, 10],
    [20, 10],
    [20, 30],
  ])
  expect(isPointInPolygon([10, 32], polygon)).toBe(true)
})

test('getSafePolygon drops the corner the pointer is already aligned with', () => {
  // Diagonally above and to the left: the card's top-left corner is behind the
  // pointer, and including it would fold the polygon over itself.
  expect(getSafePolygon(card, [-5, 5])).toEqual([
    [-5, 5],
    [20, 10],
    [20, 30],
    [0, 30],
  ])
  // Straight to the left, so both left corners are needed.
  expect(getSafePolygon(card, [-5, 20])).toEqual([
    [-5, 20],
    [0, 10],
    [20, 10],
    [20, 30],
    [0, 30],
  ])
})

test('the polygon covers the path to the card and nothing behind it', () => {
  const polygon = getSafePolygon(card, [10, 0])

  // heading straight down at the card
  expect(isPointInPolygon([10, 5], polygon)).toBe(true)
  // drifting, but still narrowing in
  expect(isPointInPolygon([6, 6], polygon)).toBe(true)
  // and on the card itself
  expect(isPointInPolygon([10, 20], polygon)).toBe(true)

  // wandering off sideways is not hover intent
  expect(isPointInPolygon([25, 5], polygon)).toBe(false)
  expect(isPointInPolygon([-5, 5], polygon)).toBe(false)
  // nor is going back up past the anchor
  expect(isPointInPolygon([10, -5], polygon)).toBe(false)
})

// --- pure intent mappers ----------------------------------------------------

/** The context of a pointer that left both elements and is heading nowhere. */
const leaving: HovercardMoveContext = {
  moving: true,
  focusWithin: false,
  onCard: false,
  onAnchor: false,
  hidePending: false,
  inPolygon: false,
  hideOnHoverOutside: true,
}

test('mapHovercardMoveIntent maps a pointer position to one of four intents', () => {
  expect(mapHovercardMoveIntent(leaving)).toBe('hide')

  // Ariakit's `if (!isMouseMoving()) return`: a `mousemove` fired by a scroll
  // under a still pointer says nothing about intent
  expect(mapHovercardMoveIntent({ ...leaving, moving: false })).toBe('ignore')

  // `isMovingOnHovercard`: focus inside the card pins it open, and so does a
  // pointer on the card, the anchor, or a nested card
  expect(mapHovercardMoveIntent({ ...leaving, focusWithin: true })).toBe('keep')
  expect(mapHovercardMoveIntent({ ...leaving, onCard: true })).toBe('keep')
  expect(mapHovercardMoveIntent({ ...leaving, onAnchor: true })).toBe('keep')

  // travelling toward the card
  expect(mapHovercardMoveIntent({ ...leaving, inPolygon: true })).toBe(
    'approach',
  )

  // `if (hideTimeoutRef.current) return`: the delay is measured from the moment
  // the pointer left, not from the last move
  expect(
    mapHovercardMoveIntent({ ...leaving, hidePending: true, inPolygon: true }),
  ).toBe('ignore')

  expect(
    mapHovercardMoveIntent({ ...leaving, hideOnHoverOutside: false }),
  ).toBe('ignore')
})

test('keeping the card open wins over a scheduled hide', () => {
  // The order matters: Ariakit clears the timeout inside the
  // `isMovingOnHovercard` branch, before the `hideTimeoutRef` bail-out, so
  // moving back onto the card cancels the hide instead of being ignored.
  expect(
    mapHovercardMoveIntent({ ...leaving, onCard: true, hidePending: true }),
  ).toBe('keep')
})

test('the enter point is remembered over the anchor and cleared over the card', () => {
  expect(nextHovercardEnterPoint(true, [4, 8])).toEqual([4, 8])
  // "Enter point will be null when the user hovers over the hovercard element"
  expect(nextHovercardEnterPoint(false, [4, 8])).toBe(null)
})

test('mapHovercardShowIntent guards the delayed show', () => {
  const move = {
    defaultPrevented: false,
    showPending: false,
    moving: true,
    showOnHover: true,
  }

  expect(mapHovercardShowIntent(move)).toBe('show')
  expect(mapHovercardShowIntent({ ...move, defaultPrevented: true })).toBe(
    'ignore',
  )
  // `if (showTimeoutRef.current) return`
  expect(mapHovercardShowIntent({ ...move, showPending: true })).toBe('ignore')
  expect(mapHovercardShowIntent({ ...move, moving: false })).toBe('ignore')
  expect(mapHovercardShowIntent({ ...move, showOnHover: false })).toBe('ignore')
})

test('getPointerMovement prefers movementX over a screen diff', () => {
  // ariakit-react-utils/src/hooks.ts, `hasMouseMovement`
  expect(getPointerMovement({ movementX: 4, movementY: 0 }, [0, 0])).toEqual({
    moving: true,
    point: [0, 0],
  })
  expect(getPointerMovement({ movementX: 0, movementY: -2 }, [0, 0])).toEqual({
    moving: true,
    point: [0, 0],
  })
  // a scroll under a still pointer: the browser reports no movement, and the
  // screen position has not changed either
  expect(
    getPointerMovement(
      { movementX: 0, movementY: 0, screenX: 8, screenY: 9 },
      [8, 9],
    ),
  ).toEqual({ moving: false, point: [8, 9] })
  // the fallback for browsers and synthetic events without `movementX`
  expect(getPointerMovement({ screenX: 10, screenY: 0 }, [0, 0])).toEqual({
    moving: true,
    point: [10, 0],
  })
  // an event with nothing at all says nothing, which is what makes a test state
  // its intent explicitly
  expect(getPointerMovement({}, [0, 0])).toEqual({
    moving: false,
    point: [0, 0],
  })
})

// --- the pointer-movement model ---------------------------------------------

test('a pointer-movement model starts still and becomes sticky', () => {
  const moving = reatomPointerMoving({ name: 'm' })

  expect(moving()).toBe(false)
  expect(moving.screenPoint()).toEqual([0, 0])
  expect(moving.screenPoint.name).toBe('m.screenPoint')

  expect(moving.move({ movementX: 4, screenX: 4, screenY: 0 })).toBe(true)
  expect(moving()).toBe(true)
  expect(moving.screenPoint()).toEqual([4, 0])

  // a following event without movement does not undo it: the flag stays true
  // until something declares the pointer still, which is what lets the first
  // move over an anchor open the card
  expect(moving.move({ screenX: 4, screenY: 0 })).toBe(false)
  expect(moving()).toBe(true)

  // a press, a key, or a scroll — https://github.com/ariakit/ariakit/issues/1137
  expect(moving.stop()).toBe(false)
  expect(moving()).toBe(false)
})

test('the screen position is diffed against the previous event', () => {
  const moving = reatomPointerMoving({ name: 'm' })

  expect(moving.move({ screenX: 10, screenY: 10 })).toBe(true)
  expect(moving.stop()).toBe(false)
  // same position: a touch tap's compatibility `mousemove`
  expect(moving.move({ screenX: 10, screenY: 10 })).toBe(false)
  expect(moving()).toBe(false)
  expect(moving.move({ screenX: 10, screenY: 11 })).toBe(true)
})

test('every hovercard shares one pointer-movement model by default', () => {
  const first = reatomHovercard({ name: 'first' })
  const second = reatomHovercard({ name: 'second' })
  const own = reatomPointerMoving({ name: 'own' })
  const scoped = reatomHovercard({ moving: own, name: 'scoped' })

  expect(first.moving).toBe(pointerMoving)
  expect(second.moving).toBe(pointerMoving)
  expect(scoped.moving).toBe(own)

  first.moving.move({ movementX: 4 })
  expect(second.moving()).toBe(true)
  expect(scoped.moving()).toBe(false)
})

// --- the model --------------------------------------------------------------

test('defaults match the Ariakit hovercard props', () => {
  const hovercard = reatomHovercard({ name: 'h' })

  // ariakit-components/src/hovercard/hovercard-store.ts: `timeout = 500`
  expect(hovercard.timeout()).toBe(500)
  expect(hovercard.showTimeout()).toBe(null)
  expect(hovercard.hideTimeout()).toBe(null)
  expect(hovercard.showDelay()).toBe(500)
  expect(hovercard.hideDelay()).toBe(500)

  // hovercard-anchor.tsx: `showOnHover = true`; hovercard.tsx:
  // `hideOnHoverOutside = true`
  expect(hovercard.showOnHover()).toBe(true)
  expect(hovercard.hideOnHoverOutside()).toBe(true)
  expect(hovercard.disablePointerEventsOnApproach()).toBe(true)

  // a card that opens on hover must not move focus, in either direction
  expect(hovercard.autoFocusOnShow()).toBe(false)
  expect(hovercard.autoFocusOnHide()).toBe(false)

  expect(hovercard.enterPoint()).toBe(null)
  expect(hovercard.disclosureVisible()).toBe(false)
  expect(hovercard.nestedCards()).toEqual([])
  expect(hovercard.showPending()).toBe(false)
  expect(hovercard.hidePending()).toBe(false)

  // the popover half is untouched
  expect(hovercard()).toBe(false)
  expect(hovercard.placement()).toBe('bottom')
  expect(hovercard.modal()).toBe(false)
  expect(hovercard.role()).toBe('dialog')
  expect(hovercard.contentId()).toBe('h-content')
})

test('every unit is named after the model', () => {
  const hovercard = reatomHovercard({ name: 'h' })

  expect(hovercard.timeout.name).toBe('h.timeout')
  expect(hovercard.showTimeout.name).toBe('h.showTimeout')
  expect(hovercard.hideTimeout.name).toBe('h.hideTimeout')
  expect(hovercard.showDelay.name).toBe('h.showDelay')
  expect(hovercard.hideDelay.name).toBe('h.hideDelay')
  expect(hovercard.showOnHover.name).toBe('h.showOnHover')
  expect(hovercard.hideOnHoverOutside.name).toBe('h.hideOnHoverOutside')
  expect(hovercard.disablePointerEventsOnApproach.name).toBe(
    'h.disablePointerEventsOnApproach',
  )
  expect(hovercard.enterPoint.name).toBe('h.enterPoint')
  expect(hovercard.disclosureVisible.name).toBe('h.disclosureVisible')
  expect(hovercard.nestedCards.name).toBe('h.nestedCards')
  expect(hovercard.showDelayed.name).toBe('h.showDelayed')
  expect(hovercard.hideDelayed.name).toBe('h.hideDelayed')
  expect(hovercard.showPending.name).toBe('h.showPending')
  expect(hovercard.hidePending.name).toBe('h.hidePending')
  // inherited from the popover it is built on
  expect(hovercard.currentPlacement.name).toBe('h.currentPlacement')
})

test('each delay falls back to the shared timeout', () => {
  const hovercard = reatomHovercard({ showTimeout: 0, timeout: 300, name: 'h' })

  expect(hovercard.showDelay()).toBe(0)
  expect(hovercard.hideDelay()).toBe(300)

  // the fallback stays live, so changing `timeout` moves the side that has none
  hovercard.timeout.set(80)
  expect(hovercard.hideDelay()).toBe(80)
  expect(hovercard.showDelay()).toBe(0)

  hovercard.showTimeout.set(null)
  expect(hovercard.showDelay()).toBe(80)
})

test('disablePointerEventsOnApproach follows hideOnHoverOutside until it is set', () => {
  // hovercard.tsx: `disablePointerEventsOnApproach = !!hideOnHoverOutside`
  const following = reatomHovercard({ name: 'following' })

  following.hideOnHoverOutside.set(false)
  expect(following.disablePointerEventsOnApproach()).toBe(false)
  following.hideOnHoverOutside.set(true)
  expect(following.disablePointerEventsOnApproach()).toBe(true)

  const explicit = reatomHovercard({
    hideOnHoverOutside: false,
    disablePointerEventsOnApproach: true,
    name: 'explicit',
  })

  expect(explicit.disablePointerEventsOnApproach()).toBe(true)
  explicit.hideOnHoverOutside.set(true)
  expect(explicit.disablePointerEventsOnApproach()).toBe(true)
})

test('a modal hovercard takes focus on show', () => {
  // hovercard.tsx: `(state) => modal || state.autoFocusOnShow`
  const hovercard = reatomHovercard({ modal: true, name: 'h' })

  expect(hovercard.autoFocusOnShow()).toBe(true)

  // A write wins until the next transition, like every writable derivation
  // here — and the flag is only ever read at a transition, which forces it back.
  hovercard.autoFocusOnShow.set(false)
  hovercard.show()
  expect(hovercard.autoFocusOnShow()).toBe(true)
  hovercard.hide()
  expect(hovercard.autoFocusOnShow()).toBe(true)
})

test('autoFocusOnShow is reset when the card closes', () => {
  const hovercard = reatomHovercard({ name: 'h' })

  hovercard.autoFocusOnShow.set(true)
  hovercard.show()
  expect(hovercard.autoFocusOnShow()).toBe(true)

  // "We have to reset it to false when the hovercard element gets hidden."
  hovercard.hide()
  expect(hovercard.autoFocusOnShow()).toBe(false)
  hovercard.show()
  expect(hovercard.autoFocusOnShow()).toBe(false)
})

test('autoFocusOnHide is armed by focus and reset on unmount', () => {
  const hovercard = reatomHovercard({ name: 'h' })

  hovercard.show()
  hovercard.autoFocusOnHide.set(true)
  expect(hovercard.autoFocusOnHide()).toBe(true)

  // `useAutoFocusOnHide` resets the flag whenever the card is not mounted, so
  // focus goes back to the anchor only when it was inside the card
  hovercard.hide()
  expect(hovercard.autoFocusOnHide()).toBe(false)
})

test('finalFocus follows the anchor and stays writable', () => {
  const hovercard = reatomHovercard({ name: 'h' })
  const anchor = element('anchor')
  const other = element('other')

  expect(hovercard.finalFocus()).toBe(null)

  hovercard.anchorElement.set(anchor)
  expect(hovercard.finalFocus()).toBe(anchor)

  // a consumer may still redirect the restore
  hovercard.finalFocus.set(other)
  expect(hovercard.finalFocus()).toBe(other)

  // …until the anchor changes again
  const next = element('next')
  hovercard.anchorElement.set(next)
  expect(hovercard.finalFocus()).toBe(next)
})

test('the enter point is dropped when the card leaves the screen', () => {
  const hovercard = reatomHovercard({ name: 'h' })

  hovercard.show()
  hovercard.enterPoint.set([4, 8])
  expect(hovercard.enterPoint()).toEqual([4, 8])

  // Ariakit keeps the point in a component ref, so it survives a close but not
  // an unmount; deriving it makes both cases the same
  hovercard.hide()
  expect(hovercard.enterPoint()).toBe(null)
})

test('nestedCards derives the crossable cards from the dialog stack', () => {
  // No `NestedHovercardContext` and no registration: nesting is declared once,
  // through `parent`.
  const menu = reatomHovercard({ name: 'menu' })
  const submenu = reatomHovercard({ parent: menu, name: 'menu.submenu' })
  const deep = reatomHovercard({ parent: submenu, name: 'menu.submenu.deep' })
  const submenuElement = element('submenu')
  const deepElement = element('deep')

  submenu.contentElement.set(submenuElement)
  deep.contentElement.set(deepElement)

  // a card that is not on screen cannot be crossed by a pointer
  expect(menu.nestedCards()).toEqual([])

  submenu.show()
  expect(menu.nestedCards()).toEqual([submenuElement])

  // a grandchild counts too, and the parent needs no knowledge of it
  deep.show()
  expect(menu.nestedCards()).toEqual([submenuElement, deepElement])
  expect(submenu.nestedCards()).toEqual([deepElement])

  submenu.hide()
  expect(menu.nestedCards()).toEqual([deepElement])
})

test('withHovercard adopts a caller-owned atom', () => {
  const open = atom(false, 'profile.open')
  const profile = open.extend(withHovercard({ timeout: 200 }))

  expect(profile).toBe(open)
  expect(profile.showDelay()).toBe(200)
  expect(profile.showDelayed.name).toBe('profile.open.showDelayed')
  // the popover half comes along
  expect(profile.placement()).toBe('bottom')

  open.set(true)
  expect(profile.mounted()).toBe(true)
})

test('anonymous hovercards get unique names', () => {
  expect(reatomHovercard().name).not.toBe(reatomHovercard().name)
})

// --- the delayed transitions ------------------------------------------------

test('a zero delay shows the card in the same tick, with no await at all', () => {
  // hovercard-anchor.tsx: `if (timeoutMs === 0) showHovercard()`
  const hovercard = reatomHovercard({ timeout: 0, name: 'h' })
  hovercard.moving.move({ movementX: 4 })

  hovercard.showDelayed()

  expect(hovercard()).toBe(true)
  // nothing was pending, so nothing has to be cleared
  expect(hovercard.showPending()).toBe(false)
})

test('showDelayed waits, marks itself pending, and then shows', async () => {
  vi.useFakeTimers()
  const hovercard = reatomHovercard({ timeout: 500, name: 'h' })
  hovercard.moving.move({ movementX: 4 })

  const shown = hovercard.showDelayed()

  expect(hovercard.showPending()).toBe(true)
  expect(hovercard()).toBe(false)

  await vi.advanceTimersByTimeAsync(499)
  expect(hovercard()).toBe(false)

  await vi.advanceTimersByTimeAsync(1)
  await shown

  expect(hovercard()).toBe(true)
  expect(hovercard.showPending()).toBe(false)
})

test('aborting a delay is the clearTimeout, and it clears the pending flag', async () => {
  vi.useFakeTimers()
  const hovercard = reatomHovercard({ timeout: 500, name: 'h' })
  hovercard.moving.move({ movementX: 4 })

  const shown = hovercard.showDelayed()
  expect(hovercard.showPending()).toBe(true)

  hovercard.showDelayed.abort('mouseleave')

  expect(hovercard.showPending()).toBe(false)
  expect(await aborted(shown)).toBe(true)

  // the wait never reaches its write, however long the test lets it run
  await vi.advanceTimersByTimeAsync(1000)
  expect(hovercard()).toBe(false)
})

test('a second call supersedes the pending one instead of racing it', async () => {
  vi.useFakeTimers()
  const hovercard = reatomHovercard({ timeout: 500, name: 'h' })
  hovercard.moving.move({ movementX: 4 })

  const first = hovercard.showDelayed()
  await vi.advanceTimersByTimeAsync(400)
  const second = hovercard.showDelayed()

  // `withAbort()`'s last-in-win: the first wait is dropped, so the card opens
  // 500ms after the *second* call
  expect(await aborted(first)).toBe(true)
  expect(hovercard.showPending()).toBe(true)

  await vi.advanceTimersByTimeAsync(400)
  expect(hovercard()).toBe(false)

  await vi.advanceTimersByTimeAsync(100)
  await second
  expect(hovercard()).toBe(true)
})

test('a delay that outlives the movement does not show the card', async () => {
  vi.useFakeTimers()
  const hovercard = reatomHovercard({ timeout: 500, name: 'h' })
  hovercard.moving.move({ movementX: 4 })

  const shown = hovercard.showDelayed()
  // "Let's check again if the mouse is moving. This is to avoid showing the
  // hovercard on mobile clicks or after clicking on the anchor."
  hovercard.moving.stop()

  await vi.advanceTimersByTimeAsync(500)
  await shown

  expect(hovercard()).toBe(false)
  expect(hovercard.showPending()).toBe(false)
})

test('hideDelayed closes the card after its own delay', async () => {
  vi.useFakeTimers()
  const hovercard = reatomHovercard({
    hideTimeout: 100,
    timeout: 500,
    name: 'h',
  })
  hovercard.show()

  const hidden = hovercard.hideDelayed()
  expect(hovercard.hidePending()).toBe(true)

  await vi.advanceTimersByTimeAsync(100)
  await hidden

  expect(hovercard()).toBe(false)
  expect(hovercard.hidePending()).toBe(false)
  // a hide is not conditioned on movement: the pointer already left
  expect(hovercard.moving()).toBe(false)
})

test('moving back onto the card cancels the pending hide', async () => {
  vi.useFakeTimers()
  const hovercard = reatomHovercard({ timeout: 500, name: 'h' })
  hovercard.show()

  const hidden = hovercard.hideDelayed()
  await vi.advanceTimersByTimeAsync(300)
  hovercard.hideDelayed.abort('hover')

  expect(await aborted(hidden)).toBe(true)
  await vi.advanceTimersByTimeAsync(500)
  expect(hovercard()).toBe(true)
})

// --- prop records -----------------------------------------------------------

test('the anchor record opens the card and adopts the hovered element', () => {
  const hovercard = reatomHovercard({ timeout: 0, name: 'h' })
  const anchor = element('anchor')

  hovercard.props.anchor().onMouseMove({ currentTarget: anchor, movementX: 4 })

  expect(hovercard()).toBe(true)
  expect(hovercard.anchorElement()).toBe(anchor)
  // Ariakit assigns it here so the dialog layer cannot pick an arbitrary
  // element to restore focus to
  expect(hovercard.disclosureElement()).toBe(anchor)
})

test('the anchor record ignores everything that is not hover intent', () => {
  const hovercard = reatomHovercard({ timeout: 0, name: 'h' })
  const anchor = element('anchor')

  // a `mousemove` without movement: a scroll under a still pointer, or a tap
  hovercard.props.anchor().onMouseMove({ currentTarget: anchor })
  expect(hovercard()).toBe(false)

  // another handler already dealt with the event
  hovercard.props.anchor().onMouseMove({
    currentTarget: anchor,
    movementX: 4,
    defaultPrevented: true,
  })
  expect(hovercard()).toBe(false)

  // hovering is turned off, e.g. for a menu that opens on click
  hovercard.showOnHover.set(false)
  hovercard.props.anchor().onMouseMove({ currentTarget: anchor, movementX: 4 })
  expect(hovercard()).toBe(false)

  hovercard.showOnHover.set(true)
  hovercard.props.anchor().onMouseMove({ currentTarget: anchor, movementX: 4 })
  expect(hovercard()).toBe(true)
})

test('the delay is measured from the first move over the anchor', async () => {
  vi.useFakeTimers()
  const hovercard = reatomHovercard({ timeout: 500, name: 'h' })
  const anchor = element('anchor')
  const move = () =>
    hovercard.props
      .anchor()
      .onMouseMove({ currentTarget: anchor, movementX: 4 })

  move()
  await vi.advanceTimersByTimeAsync(300)

  // `if (showTimeoutRef.current) return` — without the guard, a pointer resting
  // on the anchor would restart the delay with every jitter and never open
  move()
  await vi.advanceTimersByTimeAsync(200)

  expect(hovercard()).toBe(true)
})

test('leaving the anchor cancels the pending show', async () => {
  vi.useFakeTimers()
  const hovercard = reatomHovercard({ timeout: 500, name: 'h' })
  const anchor = element('anchor')

  hovercard.props.anchor().onMouseMove({ currentTarget: anchor, movementX: 4 })
  expect(hovercard.showPending()).toBe(true)

  hovercard.props.anchor().onMouseLeave()
  expect(hovercard.showPending()).toBe(false)

  await vi.advanceTimersByTimeAsync(1000)
  expect(hovercard()).toBe(false)
})

test('clicking the anchor cancels the show and declares the pointer still', async () => {
  vi.useFakeTimers()
  const hovercard = reatomHovercard({ timeout: 500, name: 'h' })
  const anchor = element('anchor')

  hovercard.props.anchor().onMouseMove({ currentTarget: anchor, movementX: 4 })
  hovercard.props.anchor().onClick()

  // https://github.com/ariakit/ariakit/issues/1137 — a click is not hover
  // intent, so the card the user just dismissed does not reopen under the
  // pointer resting on the anchor
  expect(hovercard.moving()).toBe(false)
  expect(hovercard.showPending()).toBe(false)

  await vi.advanceTimersByTimeAsync(1000)
  expect(hovercard()).toBe(false)
})

test('the anchor ref does not steal a connected anchor', () => {
  const hovercard = reatomHovercard({ name: 'h' })
  const first = element('first', true)
  const second = element('second')

  hovercard.props.anchor().ref(first)
  expect(hovercard.anchorElement()).toBe(first)

  // "This helps prevent the anchor element from being reassigned to a different
  // element when using multiple anchors and new anchors are added to the DOM."
  hovercard.props.anchor().ref(second)
  expect(hovercard.anchorElement()).toBe(first)

  // a detached anchor is fair game again
  hovercard.anchorElement.set(element('detached'))
  hovercard.props.anchor().ref(second)
  expect(hovercard.anchorElement()).toBe(second)
})

test('the disclosure record is a visually hidden button until the anchor is focused', () => {
  const hovercard = reatomHovercard({ name: 'h' })

  expect(hovercard.props.disclosure()).toMatchObject({
    type: 'button',
    'aria-haspopup': 'dialog',
    'aria-expanded': false,
    'aria-controls': 'h-content',
  })
  // hidden from sight, never from assistive technology: it is the only keyboard
  // route into the card
  expect(hovercard.props.disclosure().style).toMatchObject({
    position: 'absolute',
    width: '1px',
    height: '1px',
    clip: 'rect(0 0 0 0)',
  })

  hovercard.disclosureVisible.set(true)
  expect(hovercard.props.disclosure().style).toBe(undefined)
})

test('clicking the disclosure makes the card behave like a popover', () => {
  const hovercard = reatomHovercard({ name: 'h' })
  const button = element('button')

  hovercard.props.disclosure().onClick({ currentTarget: button })

  expect(hovercard()).toBe(true)
  // "By default, hovercards don't receive focus when they are shown. When the
  // disclosure element is clicked, though, we want it to behave like a popover"
  expect(hovercard.autoFocusOnShow()).toBe(true)
  expect(hovercard.disclosureElement()).toBe(button)
  expect(hovercard.props.disclosure()['aria-expanded']).toBe(true)

  // the button is not the anchor: a hovercard belongs to the text it describes,
  // not to a 1×1 hidden button
  expect(hovercard.anchorElement()).toBe(null)

  hovercard.props.disclosure().onClick({ currentTarget: button })
  expect(hovercard()).toBe(false)
  expect(hovercard.autoFocusOnShow()).toBe(false)
})

test('a prevented disclosure click neither opens nor arms the focus', () => {
  const hovercard = reatomHovercard({ name: 'h' })

  hovercard.props.disclosure().onClick({ defaultPrevented: true })

  expect(hovercard()).toBe(false)
  expect(hovercard.autoFocusOnShow()).toBe(false)
})

test('focusing the disclosure reveals it, for a user who tabbed straight to it', () => {
  const hovercard = reatomHovercard({ name: 'h' })

  hovercard.props.disclosure().onFocus()
  expect(hovercard.disclosureVisible()).toBe(true)
  expect(hovercard.props.disclosure().style).toBe(undefined)
})

test('focusing the card arms the focus restore', () => {
  const hovercard = reatomHovercard({ name: 'h' })
  const anchor = element('anchor')

  hovercard.anchorElement.set(anchor)
  hovercard.show()
  expect(hovercard.autoFocusOnHide()).toBe(false)

  hovercard.props.content().onFocus()
  expect(hovercard.autoFocusOnHide()).toBe(true)
  expect(hovercard.finalFocus()).toBe(anchor)

  hovercard.props.content().onFocus({ defaultPrevented: true })
  expect(hovercard.autoFocusOnHide()).toBe(true)
})

test('the content record is the popover one plus the focus hook', () => {
  const hovercard = reatomHovercard({ name: 'h' })

  expect(hovercard.props.content()).toMatchObject({
    'data-dialog': '',
    id: 'h-content',
    role: 'dialog',
    tabIndex: -1,
    hidden: true,
    style: { position: 'relative', display: 'none' },
  })

  hovercard.show()
  expect(hovercard.props.content()).toMatchObject({
    hidden: false,
    'data-open': true,
    'data-placing': true,
  })
})

test('the popover records come along unchanged', () => {
  const hovercard = reatomHovercard({ name: 'h' })
  const wrapper = element('wrapper')

  // HovercardArrow, HovercardHeading, HovercardDescription, and
  // HovercardDismiss add nothing to their popover counterparts
  expect(hovercard.props.wrapper().style.position).toBe('absolute')
  expect(hovercard.props.arrow()['aria-hidden']).toBe(true)
  expect(hovercard.props.heading().id).toBe('h-heading')
  expect(hovercard.props.description().id).toBe('h-description')
  expect(hovercard.props.dismiss()).toMatchObject({ type: 'button' })
  expect(hovercard.props.backdrop().role).toBe('presentation')

  hovercard.props.wrapper().ref(wrapper)
  expect(hovercard.popoverElement()).toBe(wrapper)
})

test('the prop-record options reach the popover records', () => {
  const hovercard = reatomHovercard({ name: 'h' })
  const props = hovercardProps(hovercard, { alwaysVisible: true, fixed: true })

  expect(props.content().hidden).toBe(false)
  expect(props.wrapper().style.position).toBe('fixed')
  expect(
    reatomHovercard({ arrowSize: 12, name: 'sized' }).props.arrow().style
      .fontSize,
  ).toBe(12)
})

test('withHovercardProps names the records after the model', () => {
  const hovercard = atom(false, 'my.card')
    .extend(withHovercard())
    .extend(withHovercardProps())

  expect(hovercard.props.anchor.name).toBe('my.card.props.anchor')
  expect(hovercard.props.disclosure.name).toBe('my.card.props.disclosure')
  expect(hovercard.props.content.name).toBe('my.card.props.content')
  expect(hovercard.props.wrapper.name).toBe('my.card.props.wrapper')
})
