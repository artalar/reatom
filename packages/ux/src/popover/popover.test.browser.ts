import { context, notify } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { reatomPopover } from './reatomPopover'
import {
  applyPopoverPosition,
  roundByDevicePixelRatio,
  withFloating,
} from './reatomPopoverFloating'

/**
 * Bucket B (`PORTING_PLAN.md` §3): the two things about positioning that a fake
 * element cannot prove — a CSS custom property only reaches the cascade through
 * `setProperty` (assigning it on `element.style` silently does nothing, which
 * is why Ariakit writes `--popover-transform-origin` and
 * `--popover-overflow-padding` that way), and a `translate3d` transform has to
 * actually move the element in layout.
 *
 * The geometry itself is asserted without a DOM in `popover.test.ts`.
 */

const cleanups: Array<() => void> = []
let container: HTMLDivElement

beforeEach(() => {
  context.reset()
  container = document.createElement('div')
  container.style.position = 'relative'
  document.body.append(container)
})

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  container.remove()
})

/** An anchor with a real box to position against. */
const createAnchor = (): HTMLButtonElement => {
  const anchor = document.createElement('button')
  anchor.textContent = 'Filters'
  Object.assign(anchor.style, {
    position: 'absolute',
    top: '50px',
    left: '30px',
    width: '80px',
    height: '20px',
  })
  container.append(anchor)
  return anchor
}

/** The wrapper Ariakit positions, with the layout floating-ui expects. */
const createWrapper = (): HTMLDivElement => {
  const wrapper = document.createElement('div')
  Object.assign(wrapper.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: 'max-content',
  })
  const content = document.createElement('div')
  Object.assign(content.style, {
    position: 'relative',
    width: '120px',
    height: '40px',
  })
  wrapper.append(content)
  container.append(wrapper)
  return wrapper
}

const settle = async () => {
  notify()
  await null
  await null
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

test('a measured position moves the popover and its arrow for real', () => {
  const wrapper = createWrapper()
  const arrow = document.createElement('div')
  Object.assign(arrow.style, {
    position: 'absolute',
    width: '20px',
    height: '10px',
  })
  wrapper.append(arrow)

  applyPopoverPosition(wrapper, arrow, {
    x: 30,
    y: 70,
    placement: 'bottom',
    arrow: { x: 12 },
  })

  expect(wrapper.getBoundingClientRect().top).toBeCloseTo(
    container.getBoundingClientRect().top + 70,
    0,
  )
  expect(wrapper.getBoundingClientRect().left).toBeCloseTo(
    container.getBoundingClientRect().left + 30,
    0,
  )

  // the custom property is readable from the cascade, so a CSS animation can
  // use it as its transform origin
  expect(
    getComputedStyle(wrapper).getPropertyValue('--popover-transform-origin'),
  ).toBe('22px -5px')
  // the arrow sits on the popover's bottom edge, pointing back at the anchor
  expect(arrow.style.bottom).toBe('100%')
  expect(arrow.getBoundingClientRect().bottom).toBeCloseTo(
    wrapper.getBoundingClientRect().top,
    0,
  )
})

test('withFloating places a real popover under its anchor', async () => {
  const anchor = createAnchor()
  const wrapper = createWrapper()

  const popover = reatomPopover({ name: 'p' }).extend(
    withFloating({
      // A hand-rolled positioner instead of floating-ui, which is not a
      // dependency of the package: below the anchor, aligned to its left edge.
      computePosition: ({ anchorElement, popoverElement, placement }) => {
        const anchorRect = anchorElement!.getBoundingClientRect()
        const parentRect = popoverElement.offsetParent!.getBoundingClientRect()

        return {
          x: anchorRect.left - parentRect.left,
          y: anchorRect.bottom - parentRect.top,
          placement,
        }
      },
    }),
  )
  cleanups.push(popover.subscribe(() => {}))

  popover.props.anchor().ref(anchor)
  popover.props.wrapper().ref(wrapper)
  popover.show()
  await settle()

  expect(popover.positioned()).toBe(true)
  expect(popover.placing()).toBe(false)
  expect(wrapper.getBoundingClientRect().top).toBeCloseTo(
    anchor.getBoundingClientRect().bottom,
    0,
  )
  expect(wrapper.getBoundingClientRect().left).toBeCloseTo(
    anchor.getBoundingClientRect().left,
    0,
  )
  // the overflow padding reaches the cascade for a popover that sizes itself
  expect(
    getComputedStyle(wrapper).getPropertyValue('--popover-overflow-padding'),
  ).toBe('8px')

  // the anchor moved and nothing observable told the popover, which is what
  // `reposition()` is for
  anchor.style.top = '120px'
  popover.reposition()
  await settle()

  expect(wrapper.getBoundingClientRect().top).toBeCloseTo(
    anchor.getBoundingClientRect().bottom,
    0,
  )
})

test('the transform is snapped to the device pixel grid', () => {
  const wrapper = createWrapper()

  applyPopoverPosition(wrapper, null, { x: 10.3, y: 0.4, placement: 'bottom' })

  // The browser reserializes the value, so the comparison is on its own terms.
  const x = roundByDevicePixelRatio(10.3)
  const y = roundByDevicePixelRatio(0.4)
  expect(wrapper.style.transform).toBe(`translate3d(${x}px, ${y}px, 0px)`)
})
