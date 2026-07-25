import type { Action, Atom, Computed } from '@reatom/core'
import { atom } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { HovercardMoveIntent } from './hovercardIntent'
import { mapHovercardMoveIntent } from './hovercardIntent'
import type {
  HovercardAnchorProps,
  HovercardContentProps,
  HovercardDisclosureProps,
} from './props'
import { withHovercardProps } from './props'
import type { Hovercard, HovercardModel } from './reatomHovercard'
import { reatomHovercard, withHovercard } from './reatomHovercard'
import { withHovercardDom, withHovercardHover } from './reatomHovercardDom'
import type { PointerMovingModel } from './reatomPointerMoving'
import { reatomPointerMoving } from './reatomPointerMoving'
import type { Point, Polygon } from './safePolygon'
import { getSafePolygon, isPointInPolygon } from './safePolygon'

test('the model is a boolean atom, and a popover', () => {
  const hovercard = reatomHovercard()

  expectTypeOf(hovercard).toExtend<Atom<boolean>>()
  expectTypeOf(hovercard()).toEqualTypeOf<boolean>()
  // inherited from the popover, and through it from the dialog
  expectTypeOf(hovercard.currentPlacement()).toExtend<string>()
  expectTypeOf(hovercard.mounted).toExtend<Computed<boolean>>()
  expectTypeOf(hovercard.topmost()).toEqualTypeOf<boolean>()
})

test('the delays are numbers, with a per-side override', () => {
  const hovercard = reatomHovercard()

  expectTypeOf(hovercard.timeout()).toEqualTypeOf<number>()
  expectTypeOf(hovercard.showTimeout()).toEqualTypeOf<number | null>()
  expectTypeOf(hovercard.hideTimeout()).toEqualTypeOf<number | null>()
  // resolved, so never null
  expectTypeOf(hovercard.showDelay()).toEqualTypeOf<number>()
  expectTypeOf(hovercard.hideDelay()).toEqualTypeOf<number>()

  hovercard.showTimeout.set(null)
  // a resolved delay is read-only
  expectTypeOf(hovercard.showDelay).not.toHaveProperty('set')
})

test('a delayed transition is an awaitable action that can be aborted', () => {
  const hovercard = reatomHovercard()

  expectTypeOf(hovercard.showDelayed).toExtend<Action<[], Promise<void>>>()
  expectTypeOf(hovercard.showDelayed()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(hovercard.hideDelayed()).toEqualTypeOf<Promise<void>>()

  // `.abort()` is the whole cancellation story: nothing stores a timer handle
  hovercard.showDelayed.abort()
  hovercard.hideDelayed.abort('mouseleave')

  // @ts-expect-error the transitions carry no payload
  hovercard.showDelayed(200)
})

test('the pointer state is typed as narrowly as the geometry it feeds', () => {
  const hovercard = reatomHovercard()

  expectTypeOf(hovercard.enterPoint()).toEqualTypeOf<Point | null>()
  expectTypeOf(hovercard.moving).toExtend<PointerMovingModel>()
  expectTypeOf(hovercard.moving()).toEqualTypeOf<boolean>()
  expectTypeOf(hovercard.moving.move({ movementX: 1 })).toEqualTypeOf<boolean>()
  expectTypeOf(hovercard.moving.stop()).toEqualTypeOf<false>()
  expectTypeOf(hovercard.moving.screenPoint()).toEqualTypeOf<Point>()

  hovercard.enterPoint.set([1, 2])
  // @ts-expect-error a point is exactly two numbers
  hovercard.enterPoint.set([1, 2, 3])
  // @ts-expect-error the movement fields are numbers
  hovercard.moving.move({ movementX: '1' })
})

test('the derived state is read-only', () => {
  const hovercard = reatomHovercard()

  expectTypeOf(hovercard.showDelay).not.toHaveProperty('set')
  expectTypeOf(hovercard.hideDelay).not.toHaveProperty('set')
  expectTypeOf(hovercard.nestedCards).not.toHaveProperty('set')
  expectTypeOf(hovercard.nestedCards()).toEqualTypeOf<
    ReadonlyArray<HTMLElement>
  >()

  // the pointer layers report into these
  expectTypeOf(hovercard.showPending.set).toBeFunction()
  expectTypeOf(hovercard.disclosureVisible.set).toBeFunction()
})

test('options are checked', () => {
  const parent = reatomHovercard({ name: 'parent' })

  reatomHovercard({
    open: true,
    timeout: 200,
    showTimeout: 0,
    hideTimeout: 1000,
    showOnHover: false,
    hideOnHoverOutside: false,
    disablePointerEventsOnApproach: true,
    moving: reatomPointerMoving({ name: 'own' }),
    // the popover options come along
    placement: 'right-start',
    modal: true,
    fixed: true,
    arrowSize: 12,
    // …and the dialog ones through them
    parent,
    animated: 250,
    alwaysVisible: true,
    name: 'submenu',
  })

  // @ts-expect-error a delay is a number of milliseconds
  reatomHovercard({ timeout: '200ms' })
  // @ts-expect-error the placement union is closed
  reatomHovercard({ placement: 'bottom-middle' })
  // @ts-expect-error unknown options are rejected
  reatomHovercard({ hideOnHover: true })
})

test('prop records are computed plain objects', () => {
  const hovercard = reatomHovercard()

  expectTypeOf(hovercard.props.anchor).toExtend<
    Computed<HovercardAnchorProps>
  >()
  expectTypeOf(hovercard.props.disclosure).toExtend<
    Computed<HovercardDisclosureProps>
  >()
  expectTypeOf(hovercard.props.content).toExtend<
    Computed<HovercardContentProps>
  >()
  expectTypeOf(
    hovercard.props.disclosure()['aria-haspopup'],
  ).toEqualTypeOf<'dialog'>()
  // the popover records are inherited unchanged
  expectTypeOf(hovercard.props.wrapper().style.position).toEqualTypeOf<
    'absolute' | 'fixed'
  >()
  expectTypeOf(hovercard.props.arrow().style.fontSize).toEqualTypeOf<number>()

  // every handler works with a real DOM event, a synthetic one, or nothing
  hovercard.props.anchor().onMouseMove()
  hovercard.props.anchor().onMouseMove({} as MouseEvent)
  hovercard.props.anchor().onMouseMove({ currentTarget: null, movementX: 4 })
  hovercard.props.anchor().onMouseLeave()
  hovercard.props.anchor().onClick()
  hovercard.props.anchor().ref(null)
  hovercard.props.disclosure().onFocus({} as FocusEvent)
  hovercard.props.content().onFocus()
  // and the dialog contract is still there
  hovercard.props.content().onKeyDown({ key: 'Escape' })
})

test('the extensions compose into the full model', () => {
  const adopted = atom(false, 'flag')
    .extend(withHovercard())
    .extend(withHovercardProps({ fixed: true }))

  expectTypeOf(adopted).toExtend<Hovercard>()
  expectTypeOf(adopted).toExtend<HovercardModel>()
  expectTypeOf(adopted.showDelay()).toEqualTypeOf<number>()

  const wired = reatomHovercard().extend(withHovercardDom())
  expectTypeOf(wired).toExtend<Hovercard>()
  expectTypeOf(
    reatomHovercard().extend(withHovercardHover()),
  ).toExtend<Hovercard>()

  // @ts-expect-error a hovercard is a boolean
  atom('', 'text').extend(withHovercard())
  // @ts-expect-error the DOM layer needs the model, not a bare atom
  atom(false, 'flag').extend(withHovercardDom())
})

test('the geometry is plain numbers, so Layer 1 stays DOM-free', () => {
  const polygon: Polygon = getSafePolygon(
    { top: 0, right: 10, bottom: 10, left: 0 },
    [5, -5],
  )

  expectTypeOf(polygon).toEqualTypeOf<Array<Point>>()
  expectTypeOf(isPointInPolygon([1, 1], polygon)).toEqualTypeOf<boolean>()
  // a partially built polygon is still a valid input
  isPointInPolygon([1, 1], [[0, 0], undefined])

  // @ts-expect-error a rect needs all four sides
  getSafePolygon({ top: 0, right: 10 }, [0, 0])
})

test('the intent mappers return closed unions', () => {
  const intent = mapHovercardMoveIntent({
    moving: true,
    focusWithin: false,
    onCard: false,
    onAnchor: false,
    hidePending: false,
    inPolygon: true,
    hideOnHoverOutside: true,
  })

  expectTypeOf(intent).toEqualTypeOf<HovercardMoveIntent>()
  if (intent === 'approach') expectTypeOf(intent).toEqualTypeOf<'approach'>()

  // @ts-expect-error every fact is required, so a new one cannot be forgotten
  mapHovercardMoveIntent({ moving: true })
})
