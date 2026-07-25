import { atom, context, effect, getCalls, notify } from '@reatom/core'
import { beforeEach, expect, test, vi } from 'vitest'

import {
  getPopoverAlignment,
  getPopoverSide,
  isPopoverPlacement,
  parsePopoverFlip,
  POPOVER_BASE_PLACEMENTS,
} from './popoverPlacement'
import { popoverProps, withPopoverProps } from './props'
import { reatomPopover, withPopover } from './reatomPopover'
import type {
  PopoverPosition,
  PopoverPositionRequest,
} from './reatomPopoverFloating'
import {
  applyPopoverPosition,
  getPopoverTransformOrigin,
  resolvePopoverOffset,
  roundByDevicePixelRatio,
  withFloating,
} from './reatomPopoverFloating'

beforeEach(() => context.reset())

/**
 * A stand-in for a DOM node. The model only stores element handles, and the
 * positioning layer only writes styles, so a plain object with a `style` record
 * and a box is enough — no browser needed.
 */
const element = (id = '', box = { width: 20, height: 10 }): HTMLElement => {
  const style: Record<string, unknown> = {
    setProperty(property: string, value: string) {
      style[property] = value
    },
  }

  return {
    id,
    style,
    clientWidth: box.width,
    clientHeight: box.height,
  } as unknown as HTMLElement
}

/** Runs the effect phase and lets the async positioning flow settle. */
const flush = async () => {
  notify()
  for (let index = 0; index < 4; index++) await null
}

// --- model ------------------------------------------------------------------

test('defaults match the Ariakit popover props', () => {
  const popover = reatomPopover({ name: 'p' })

  // the placement pair
  expect(popover.placement()).toBe('bottom')
  expect(popover.currentPlacement()).toBe('bottom')
  expect(popover.side()).toBe('bottom')
  expect(popover.alignment()).toBe(null)

  // the element handles
  expect(popover.anchorElement()).toBe(null)
  expect(popover.popoverElement()).toBe(null)
  expect(popover.arrowElement()).toBe(null)

  // positioning state
  expect(popover.positioned()).toBe(false)
  expect(popover.placing()).toBe(false)

  // ariakit-react-components/src/popover/popover.tsx: `modal = false` — a
  // popover leaves the rest of the page interactive, unlike a plain dialog
  expect(popover.modal()).toBe(false)
  expect(popover.backdrop()).toBe(false)
  expect(popover.preventBodyScroll()).toBe(false)

  // the dialog half is untouched
  expect(popover()).toBe(false)
  expect(popover.role()).toBe('dialog')
  expect(popover.hideOnEscape()).toBe(true)
  expect(popover.hideOnInteractOutside()).toBe(true)
  expect(popover.contentId()).toBe('p-content')
})

test('a popover can be modal, and then locks like a dialog', () => {
  const popover = reatomPopover({ modal: true, name: 'p' })

  expect(popover.backdrop()).toBe(true)
  expect(popover.preventBodyScroll()).toBe(true)

  popover.show()
  expect(popover.focusTrapped()).toBe(true)
  expect(popover.scrollLocked()).toBe(true)
})

test('every unit is named after the model', () => {
  const popover = reatomPopover({ name: 'p' })

  expect(popover.placement.name).toBe('p.placement')
  expect(popover.currentPlacement.name).toBe('p.currentPlacement')
  expect(popover.side.name).toBe('p.side')
  expect(popover.alignment.name).toBe('p.alignment')
  expect(popover.anchorElement.name).toBe('p.anchorElement')
  expect(popover.popoverElement.name).toBe('p.popoverElement')
  expect(popover.arrowElement.name).toBe('p.arrowElement')
  expect(popover.positioned.name).toBe('p.positioned')
  expect(popover.placing.name).toBe('p.placing')
  expect(popover.reposition.name).toBe('p.reposition')
  // inherited from the dialog it is built on
  expect(popover.dismiss.name).toBe('p.dismiss')
  expect(popover.mounted.name).toBe('p.mounted')
})

test('currentPlacement follows placement and accepts the positioner result', () => {
  const popover = reatomPopover({ placement: 'top-start', name: 'p' })

  expect(popover.currentPlacement()).toBe('top-start')
  expect(popover.side()).toBe('top')
  expect(popover.alignment()).toBe('start')

  // ariakit-react-components/src/popover/popover.tsx:313 — the positioner
  // reports where the popover really ended up after flipping
  popover.currentPlacement.set('bottom-start')
  expect(popover.currentPlacement()).toBe('bottom-start')
  expect(popover.side()).toBe('bottom')

  // a new request wins over the stale result
  popover.placement.set('right')
  expect(popover.currentPlacement()).toBe('right')
  expect(popover.side()).toBe('right')
  expect(popover.alignment()).toBe(null)
})

test('the resolved placement survives a recompute of the unobserved model', () => {
  // The reset is a `withComputed` over the *changes* of `placement`, anchored
  // with `peek`, so an unsubscribed model does not recompute the positioner's
  // result away on the next read — the same trap `withDisclosure` documents for
  // `animating`.
  const popover = reatomPopover({ name: 'p' })

  popover.currentPlacement.set('left-end')

  expect(popover.currentPlacement()).toBe('left-end')
  expect(popover.currentPlacement()).toBe('left-end')
  expect(popover.side()).toBe('left')
  expect(popover.alignment()).toBe('end')
})

test('placing is true while a mounted popover has no position yet', () => {
  const popover = reatomPopover({ name: 'p' })

  popover.show()
  expect(popover.placing()).toBe(true)

  popover.positioned.set(true)
  expect(popover.placing()).toBe(false)

  // ariakit-react-components/src/popover/popover.tsx:371-374 — the flag is
  // reset when the popover stops being on screen
  popover.hide()
  expect(popover.positioned()).toBe(false)
  expect(popover.placing()).toBe(false)

  popover.show()
  expect(popover.placing()).toBe(true)
})

test('reposition is observable as an event, unlike a rendered symbol', async () => {
  // ariakit-components/src/popover/popover-store.ts:61,71 — `rendered:
  // Symbol('rendered')` exists only so that a consumer can diff it
  const popover = reatomPopover({ name: 'p' })
  const seen: Array<number> = []

  const stop = effect(() => {
    seen.push(getCalls(popover.reposition).length)
  }, 'p.observer')
  notify()

  expect(seen).toEqual([0])

  popover.reposition()
  notify()
  await null
  expect(seen).toEqual([0, 1])

  // the event fires again even though no state changed, which is the whole
  // point of Ariakit's symbol
  popover.reposition()
  notify()
  await null
  expect(seen).toEqual([0, 1, 1])

  stop()
})

test('the popover is a dialog: dismissal and the nested stack still work', () => {
  const parent = reatomPopover({ name: 'parent' })
  const child = reatomPopover({ parent, name: 'parent.child' })

  parent.show()
  child.show()

  expect(parent.nestedDialogs()).toEqual([child])
  expect(parent.topmost()).toBe(false)
  expect(child.topmost()).toBe(true)

  expect(child.dismiss('escape')).toBe(false)
  expect(child.dismissIntent()).toBe('escape')
  expect(parent.topmost()).toBe(true)
})

test('withPopover adopts a caller-owned atom', () => {
  const open = atom(false, 'filters.open')
  const filters = open.extend(withPopover({ placement: 'bottom-end' }))

  expect(filters).toBe(open)
  expect(filters.placement()).toBe('bottom-end')
  expect(filters.alignment()).toBe('end')
  expect(filters.placing.name).toBe('filters.open.placing')

  open.set(true)
  expect(filters.mounted()).toBe(true)
  expect(filters.placing()).toBe(true)
})

test('anonymous popovers get unique names and DOM-safe ids', () => {
  const first = reatomPopover()
  const second = reatomPopover()

  expect(first.name).not.toBe(second.name)
  expect(first.contentId()).not.toContain('#')
})

// --- pure placement helpers -------------------------------------------------

test('isPopoverPlacement accepts a side with an optional alignment', () => {
  // ariakit-react-components/src/popover/popover.tsx:92-94
  for (const side of POPOVER_BASE_PLACEMENTS) {
    expect(isPopoverPlacement(side)).toBe(true)
    expect(isPopoverPlacement(`${side}-start`)).toBe(true)
    expect(isPopoverPlacement(`${side}-end`)).toBe(true)
  }

  expect(isPopoverPlacement('above')).toBe(false)
  expect(isPopoverPlacement('top-center')).toBe(false)
  expect(isPopoverPlacement('top-')).toBe(false)
  expect(isPopoverPlacement('')).toBe(false)
})

test('a placement splits into a side and an alignment', () => {
  expect(getPopoverSide('bottom-end')).toBe('bottom')
  expect(getPopoverSide('left')).toBe('left')
  expect(getPopoverAlignment('bottom-end')).toBe('end')
  expect(getPopoverAlignment('bottom-start')).toBe('start')
  expect(getPopoverAlignment('bottom')).toBe(null)
})

test('parsePopoverFlip resolves the three shapes of the flip option', () => {
  // ariakit-react-components/src/popover/popover.tsx:125-143
  expect(parsePopoverFlip(false)).toEqual({
    enabled: false,
    fallbackPlacements: null,
  })
  expect(parsePopoverFlip(true)).toEqual({
    enabled: true,
    fallbackPlacements: null,
  })
  expect(parsePopoverFlip()).toEqual({
    enabled: true,
    fallbackPlacements: null,
  })
  expect(parsePopoverFlip('top left')).toEqual({
    enabled: true,
    fallbackPlacements: ['top', 'left'],
  })
  expect(parsePopoverFlip('top-start  bottom-end')).toEqual({
    enabled: true,
    fallbackPlacements: ['top-start', 'bottom-end'],
  })

  expect(() => parsePopoverFlip('top above')).toThrow(
    /spaced-delimited list of placements/,
  )
})

// --- pure positioning geometry ----------------------------------------------

test('resolvePopoverOffset keeps the gutter measured from the arrow tip', () => {
  // ariakit-react-components/src/popover/popover.tsx:102-123
  expect(resolvePopoverOffset({ placement: 'bottom', arrowHeight: 8 })).toEqual(
    {
      mainAxis: 4,
      crossAxis: undefined,
      alignmentAxis: undefined,
    },
  )
  expect(
    resolvePopoverOffset({ placement: 'bottom', gutter: 8, arrowHeight: 8 }),
  ).toEqual({ mainAxis: 12, crossAxis: undefined, alignmentAxis: undefined })
  // no arrow, no gutter: the popover touches its anchor
  expect(resolvePopoverOffset({ placement: 'bottom' })).toEqual({
    mainAxis: 0,
    crossAxis: undefined,
    alignmentAxis: undefined,
  })
})

test('resolvePopoverOffset shifts a centered placement across the side', () => {
  // "If there's no placement alignment (*-start or *-end), we'll fallback to
  // the crossAxis offset as it also works for center-aligned placements."
  expect(resolvePopoverOffset({ placement: 'bottom', shift: 4 })).toEqual({
    mainAxis: 0,
    crossAxis: 4,
    alignmentAxis: 4,
  })
  expect(resolvePopoverOffset({ placement: 'bottom-end', shift: 4 })).toEqual({
    mainAxis: 0,
    crossAxis: undefined,
    alignmentAxis: 4,
  })
})

test('getPopoverTransformOrigin points at the arrow on every side', () => {
  // ariakit-react-components/src/popover/popover.tsx:326-346
  const horizontal = { x: 12, width: 20, height: 10 }
  const vertical = { y: 12, width: 20, height: 10 }

  expect(getPopoverTransformOrigin('top', horizontal)).toBe(
    '22px calc(100% + 5px)',
  )
  expect(getPopoverTransformOrigin('bottom', horizontal)).toBe('22px -5px')
  expect(getPopoverTransformOrigin('left', vertical)).toBe(
    'calc(100% + 10px) 17px',
  )
  expect(getPopoverTransformOrigin('right', vertical)).toBe('-10px 17px')

  // a missing offset means the arrow is centered, so the origin is the negated
  // half arrow
  expect(getPopoverTransformOrigin('bottom', { width: 20, height: 10 })).toBe(
    '-10px -5px',
  )
})

test('roundByDevicePixelRatio snaps to a physical pixel', () => {
  // ariakit-react-components/src/popover/popover.tsx:96-100
  expect(roundByDevicePixelRatio(10.3, 1)).toBe(10)
  expect(roundByDevicePixelRatio(10.3, 2)).toBe(10.5)
  expect(roundByDevicePixelRatio(10.3, 3)).toBeCloseTo(10.333, 3)
  // no ratio available in Node: the value is rounded to whole pixels
  expect(roundByDevicePixelRatio(10.3)).toBe(10)
})

test('applyPopoverPosition moves the popover and its arrow', () => {
  const wrapper = element('wrapper')
  const arrow = element('arrow')

  applyPopoverPosition(
    wrapper,
    arrow,
    { x: 10.3, y: 4, placement: 'bottom', arrow: { x: 12 } },
    1,
  )

  expect(wrapper.style).toMatchObject({
    top: '0',
    left: '0',
    transform: 'translate3d(10px,4px,0)',
    '--popover-transform-origin': '22px -5px',
  })
  expect(arrow.style).toMatchObject({ left: '12px', top: '', bottom: '100%' })
})

test('applyPopoverPosition leaves the arrow alone when it was not measured', () => {
  const wrapper = element('wrapper')
  const arrow = element('arrow')

  applyPopoverPosition(wrapper, arrow, { x: 0, y: 0, placement: 'top' }, 1)

  expect(wrapper.style).not.toHaveProperty('--popover-transform-origin')
  expect(arrow.style).not.toHaveProperty('left')
})

// --- prop records -----------------------------------------------------------

test('the anchor record assigns the element the popover points at', () => {
  const popover = reatomPopover({ name: 'p' })
  const anchor = element('anchor')

  popover.props.anchor().ref(anchor)
  expect(popover.anchorElement()).toBe(anchor)
  popover.props.anchor().ref(null)
  expect(popover.anchorElement()).toBe(null)
})

test('the disclosure record toggles the popover and anchors it', () => {
  const popover = reatomPopover({ name: 'p' })
  const button = element('button')

  expect(popover.props.disclosure()).toMatchObject({
    type: 'button',
    'aria-haspopup': 'dialog',
    'aria-expanded': false,
    'aria-controls': 'p-content',
  })

  // ariakit-react-components/src/popover/popover-disclosure.tsx:50-53 — the
  // button becomes the anchor, so a popover next to its button needs no
  // separate anchor element
  popover.props.disclosure().onClick({ currentTarget: button })

  expect(popover()).toBe(true)
  expect(popover.anchorElement()).toBe(button)
  expect(popover.disclosureElement()).toBe(button)
  expect(popover.props.disclosure()['aria-expanded']).toBe(true)
})

test('the disclosure ref anchors the popover before it is ever clicked', () => {
  const popover = reatomPopover({ name: 'p' })
  const button = element('button')

  popover.props.disclosure().ref(button)
  expect(popover.anchorElement()).toBe(button)
  expect(popover.disclosureElement()).toBe(button)

  popover.props.disclosure().ref(null)
  expect(popover.anchorElement()).toBe(null)
  expect(popover.disclosureElement()).toBe(null)
})

test('a prevented click still anchors the popover, but does not open it', () => {
  const popover = reatomPopover({ name: 'p' })
  const button = element('button')

  popover.props
    .disclosure()
    .onClick({ currentTarget: button, defaultPrevented: true })

  expect(popover()).toBe(false)
  expect(popover.anchorElement()).toBe(button)
})

test('the wrapper record is the positioning box', () => {
  const popover = reatomPopover({ name: 'p' })
  const wrapper = element('wrapper')

  expect(popover.props.wrapper().style).toEqual({
    position: 'absolute',
    top: 0,
    left: 0,
    width: 'max-content',
  })

  popover.props.wrapper().ref(wrapper)
  expect(popover.popoverElement()).toBe(wrapper)
})

test('the fixed option switches the wrapper strategy', () => {
  const popover = reatomPopover({ fixed: true, name: 'p' })

  expect(popover.props.wrapper().style.position).toBe('fixed')
})

test('the content record is the dialog contract plus the positioning context', () => {
  const popover = reatomPopover({ name: 'p' })

  expect(popover.props.content()).toMatchObject({
    'data-dialog': '',
    id: 'p-content',
    role: 'dialog',
    tabIndex: -1,
    hidden: true,
    // a popover is not modal by default
    'aria-modal': undefined,
    style: { position: 'relative', display: 'none' },
    'data-placing': undefined,
  })

  popover.show()
  expect(popover.props.content()).toMatchObject({
    hidden: false,
    'data-open': true,
    // ariakit-react-components/src/popover/popover.tsx:456-467
    style: { position: 'relative' },
    'data-placing': true,
  })
  expect(popover.props.content().style).not.toHaveProperty('display')

  popover.positioned.set(true)
  expect(popover.props.content()['data-placing']).toBe(undefined)
})

test('the content record is memoized per state', () => {
  const popover = reatomPopover({ name: 'p' })
  const first = popover.props.content()

  expect(popover.props.content()).toBe(first)
  popover.show()
  expect(popover.props.content()).not.toBe(first)
})

test('the arrow record reserves a square box and registers the element', () => {
  const popover = reatomPopover({ name: 'p' })
  const arrow = element('arrow')

  expect(popover.props.arrow()).toMatchObject({
    'aria-hidden': true,
    style: {
      position: 'absolute',
      fontSize: 30,
      width: '1em',
      height: '1em',
      pointerEvents: 'none',
    },
  })

  popover.props.arrow().ref(arrow)
  expect(popover.arrowElement()).toBe(arrow)

  const sized = reatomPopover({ arrowSize: 12, name: 'sized' })
  expect(sized.props.arrow().style.fontSize).toBe(12)
})

test('the dialog records come along unchanged', () => {
  const popover = reatomPopover({ name: 'p' })
  popover.show()

  // ariakit-react-components/src/popover/popover-dismiss.tsx,
  // popover-heading.tsx, and popover-description.tsx add nothing to their
  // dialog counterparts
  expect(popover.props.heading().id).toBe('p-heading')
  expect(popover.props.description().id).toBe('p-description')
  expect(popover.props.dismiss()).toMatchObject({ type: 'button' })
  expect(popover.props.backdrop().role).toBe('presentation')
  expect(popover.props.focusTrap().tabIndex).toBe(0)

  popover.props.content().onKeyDown({ key: 'Escape' })
  expect(popover()).toBe(false)
  expect(popover.dismissIntent()).toBe('escape')
})

test('withPopoverProps names the records after the model', () => {
  const popover = atom(false, 'my.flag')
    .extend(withPopover())
    .extend(withPopoverProps())

  expect(popover.props.anchor.name).toBe('my.flag.props.anchor')
  expect(popover.props.disclosure.name).toBe('my.flag.props.disclosure')
  expect(popover.props.wrapper.name).toBe('my.flag.props.wrapper')
  expect(popover.props.content.name).toBe('my.flag.props.content')
  expect(popover.props.arrow.name).toBe('my.flag.props.arrow')
  expect(popover.props.heading.name).toBe('my.flag.props.heading')
})

test('alwaysVisible keeps the popover rendered for exit animations', () => {
  const popover = reatomPopover({ name: 'p' })
  const props = popoverProps(popover, { alwaysVisible: true })

  expect(props.content()).toMatchObject({
    hidden: false,
    style: { position: 'relative' },
  })
})

// --- positioning ------------------------------------------------------------

/** Mounts a popover with an injected positioner, as `withFloating` expects. */
const mount = (
  position: PopoverPosition,
  options: { autoUpdate?: boolean } = {},
) => {
  const requests: Array<PopoverPositionRequest> = []
  const stopAutoUpdate = vi.fn()
  const updates: Array<() => void> = []

  const popover = reatomPopover({ name: 'p' }).extend(
    withFloating({
      computePosition: (request) => {
        requests.push(request)
        return position
      },
      autoUpdate: options.autoUpdate
        ? (_request, update) => {
            updates.push(update)
            return stopAutoUpdate
          }
        : undefined,
    }),
  )

  const unsubscribe = popover.subscribe(() => {})
  const wrapper = element('wrapper')
  const arrow = element('arrow')

  popover.props.anchor().ref(element('anchor'))
  popover.props.wrapper().ref(wrapper)
  popover.props.arrow().ref(arrow)

  return {
    popover,
    requests,
    wrapper,
    arrow,
    stopAutoUpdate,
    updates,
    unsubscribe,
  }
}

test('withFloating places a mounted popover and reports the placement', async () => {
  const { popover, requests, wrapper, unsubscribe } = mount({
    x: 12,
    y: 4,
    placement: 'top',
    arrow: { x: 6 },
  })

  // nothing is measured while the popover is closed
  await flush()
  expect(requests).toEqual([])

  popover.show()
  await flush()

  expect(requests.length).toBe(1)
  expect(requests[0]).toMatchObject({
    placement: 'bottom',
    strategy: 'absolute',
  })
  expect(requests[0]!.anchorElement!.id).toBe('anchor')
  // the popover had to flip, so the arrow must point the other way
  expect(popover.currentPlacement()).toBe('top')
  expect(popover.side()).toBe('top')
  expect(popover.positioned()).toBe(true)
  expect(popover.placing()).toBe(false)
  expect(wrapper.style).toMatchObject({
    transform: 'translate3d(12px,4px,0)',
    '--popover-overflow-padding': '8px',
  })

  unsubscribe()
})

test('withFloating replaces the rendered symbol: reposition places again', async () => {
  const { popover, requests, unsubscribe } = mount({
    x: 0,
    y: 0,
    placement: 'bottom',
  })
  popover.show()
  await flush()
  expect(requests.length).toBe(1)

  popover.reposition()
  await flush()
  expect(requests.length).toBe(2)

  // …and so does a new placement request, which also makes it "placing" again
  popover.placement.set('right')
  notify()
  expect(popover.positioned()).toBe(false)
  await flush()
  expect(requests.length).toBe(3)
  expect(requests[2]).toMatchObject({ placement: 'right' })
  expect(popover.positioned()).toBe(true)

  unsubscribe()
})

test('withFloating watches the anchor while the popover is mounted', async () => {
  const { popover, requests, stopAutoUpdate, updates, unsubscribe } = mount(
    { x: 0, y: 0, placement: 'bottom' },
    { autoUpdate: true },
  )

  popover.show()
  await flush()
  expect(updates.length).toBe(1)
  expect(stopAutoUpdate).not.toHaveBeenCalled()

  updates[0]!()
  await flush()
  expect(requests.length).toBe(2)

  // the watcher is dropped when the popover leaves the screen
  popover.hide()
  await flush()
  expect(stopAutoUpdate).toHaveBeenCalled()

  unsubscribe()
})

test('an animated popover keeps its position until it is really gone', async () => {
  const { popover, requests, stopAutoUpdate, unsubscribe } = mount(
    { x: 0, y: 0, placement: 'bottom' },
    { autoUpdate: true },
  )
  popover.animated.set(true)

  popover.show()
  await flush()
  expect(requests.length).toBe(1)

  // `mounted`, not `open`: the popover is still on screen while it animates out,
  // and it must not jump back to its unpositioned corner
  popover.hide()
  await flush()
  expect(popover.positioned()).toBe(true)
  expect(stopAutoUpdate).not.toHaveBeenCalled()

  popover.animating.set(false)
  await flush()
  expect(popover.positioned()).toBe(false)
  expect(stopAutoUpdate).toHaveBeenCalled()

  unsubscribe()
})

test('position is a no-op without a wrapper element to move', async () => {
  const requests: Array<PopoverPositionRequest> = []
  const popover = reatomPopover({ name: 'p' }).extend(
    withFloating({
      computePosition: (request) => {
        requests.push(request)
        return { x: 0, y: 0, placement: 'bottom' }
      },
    }),
  )

  popover.show()
  await popover.position()

  expect(requests).toEqual([])
  expect(popover.positioned()).toBe(false)
})
