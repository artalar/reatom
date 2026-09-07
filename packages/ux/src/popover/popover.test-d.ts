import type { Action, Atom, Computed } from '@reatom/core'
import { atom } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type {
  PopoverAlignment,
  PopoverBasePlacement,
  PopoverPlacement,
} from './popoverPlacement'
import { getPopoverSide, isPopoverPlacement } from './popoverPlacement'
import type { PopoverArrowProps, PopoverContentProps } from './props'
import { withPopoverProps } from './props'
import type { Popover, PopoverModel } from './reatomPopover'
import { reatomPopover, withPopover } from './reatomPopover'
import type { PopoverPosition } from './reatomPopoverFloating'
import { withFloating } from './reatomPopoverFloating'

test('the model is a boolean atom, and a dialog', () => {
  const popover = reatomPopover()

  expectTypeOf(popover).toExtend<Atom<boolean>>()
  expectTypeOf(popover()).toEqualTypeOf<boolean>()
  // inherited from the dialog it is built on
  expectTypeOf(popover.mounted).toExtend<Computed<boolean>>()
  expectTypeOf(popover.dismiss()).toEqualTypeOf<false>()
  expectTypeOf(popover.topmost()).toEqualTypeOf<boolean>()
})

test('the placement pair is typed as narrowly as the CSS it produces', () => {
  const popover = reatomPopover()

  expectTypeOf(popover.placement()).toEqualTypeOf<PopoverPlacement>()
  expectTypeOf(popover.currentPlacement()).toEqualTypeOf<PopoverPlacement>()
  expectTypeOf(popover.side()).toEqualTypeOf<PopoverBasePlacement>()
  expectTypeOf(popover.alignment()).toEqualTypeOf<PopoverAlignment | null>()

  popover.placement.set('bottom-end')
  // the positioner reports the placement it resolved
  popover.currentPlacement.set('top')

  // @ts-expect-error a placement is a side with an optional alignment
  popover.placement.set('above')
  // @ts-expect-error `center` is not an alignment
  popover.placement.set('top-center')
})

test('the element handles are nullable', () => {
  const popover = reatomPopover()

  expectTypeOf(popover.anchorElement()).toEqualTypeOf<HTMLElement | null>()
  expectTypeOf(popover.popoverElement()).toEqualTypeOf<HTMLElement | null>()
  expectTypeOf(popover.arrowElement()).toEqualTypeOf<HTMLElement | null>()
})

test('reposition is an event, not a value', () => {
  const popover = reatomPopover()

  expectTypeOf(popover.reposition).toExtend<Action<[], void>>()
  expectTypeOf(popover.reposition()).toEqualTypeOf<void>()

  // @ts-expect-error the event carries no payload
  popover.reposition('now')
})

test('the derived state is read-only', () => {
  const popover = reatomPopover()

  expectTypeOf(popover.side).not.toHaveProperty('set')
  expectTypeOf(popover.alignment).not.toHaveProperty('set')
  expectTypeOf(popover.placing).not.toHaveProperty('set')
  // the positioning layer reports into both of these
  expectTypeOf(popover.positioned.set).toBeFunction()
  expectTypeOf(popover.currentPlacement.set).toBeFunction()
})

test('options are checked', () => {
  const parent = reatomPopover({ name: 'parent' })

  reatomPopover({
    open: true,
    placement: 'left-start',
    modal: true,
    fixed: true,
    arrowSize: 12,
    // the dialog options come along
    role: 'alertdialog',
    hideOnEscape: false,
    autoFocusOnShow: false,
    parent,
    animated: 250,
    alwaysVisible: true,
    name: 'menu',
  })

  // @ts-expect-error the placement union is closed
  reatomPopover({ placement: 'bottom-middle' })
  // @ts-expect-error unknown options are rejected
  reatomPopover({ gutter: 8 })
})

test('prop records are computed plain objects', () => {
  const popover = reatomPopover()

  expectTypeOf(popover.props.content).toExtend<Computed<PopoverContentProps>>()
  expectTypeOf(popover.props.arrow).toExtend<Computed<PopoverArrowProps>>()
  expectTypeOf(
    popover.props.content().style.position,
  ).toEqualTypeOf<'relative'>()
  expectTypeOf(popover.props.content()['data-placing']).toEqualTypeOf<
    true | undefined
  >()
  expectTypeOf(popover.props.wrapper().style.position).toEqualTypeOf<
    'absolute' | 'fixed'
  >()
  expectTypeOf(popover.props.arrow().style.fontSize).toEqualTypeOf<number>()
  // the dialog records are inherited unchanged
  expectTypeOf(popover.props.heading().id).toEqualTypeOf<string>()

  popover.props.anchor().ref(null)
  popover.props.disclosure().onClick()
  popover.props.disclosure().onClick({} as MouseEvent)
  popover.props.content().onKeyDown({ key: 'Escape' })
})

test('withPopover adopts a boolean atom only', () => {
  const model = atom(false, 'flag').extend(withPopover())
  expectTypeOf(model).toExtend<PopoverModel>()
  expectTypeOf(model.placing()).toEqualTypeOf<boolean>()

  // @ts-expect-error a popover is a boolean
  atom('', 'text').extend(withPopover())
})

test('the extensions compose into the full model', () => {
  const model = atom(false, 'flag')
    .extend(withPopover())
    .extend(withPopoverProps({ fixed: true }))

  expectTypeOf(model).toExtend<Popover>()

  const positioned = reatomPopover().extend(
    withFloating({
      computePosition: () => ({ x: 0, y: 0, placement: 'bottom' }),
    }),
  )
  expectTypeOf(positioned).toExtend<Popover>()
  expectTypeOf(positioned.position()).toEqualTypeOf<Promise<void>>()
})

test('a positioner may be synchronous or asynchronous', () => {
  const sync = (): PopoverPosition => ({ x: 0, y: 0, placement: 'top' })
  const async = async (): Promise<PopoverPosition> => sync()

  withFloating({ computePosition: sync })
  withFloating({ computePosition: async, autoUpdate: () => () => {} })

  // @ts-expect-error the positioner is required
  withFloating({})
  // @ts-expect-error a position needs both coordinates and a placement
  withFloating({ computePosition: () => ({ x: 0, y: 0 }) })
  // @ts-expect-error `autoUpdate` must return a teardown
  withFloating({ computePosition: sync, autoUpdate: () => undefined })
})

test('the placement helpers narrow a string', () => {
  const value: string = 'top-start'

  if (isPopoverPlacement(value)) {
    expectTypeOf(value).toEqualTypeOf<PopoverPlacement>()
    expectTypeOf(getPopoverSide(value)).toEqualTypeOf<PopoverBasePlacement>()
  }

  // @ts-expect-error a side is not a whole placement input by accident
  getPopoverSide('above')
})
