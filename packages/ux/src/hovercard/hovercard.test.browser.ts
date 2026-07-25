import { context, notify, sleep } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { withDialogDismiss } from '../dialog/reatomDialogDom'
import type { Hovercard } from './reatomHovercard'
import { reatomHovercard } from './reatomHovercard'
import { withHovercardDom } from './reatomHovercardDom'
import { reatomPointerMoving } from './reatomPointerMoving'

/**
 * Bucket B (`PORTING_PLAN.md` §3): everything about a hovercard that a fake
 * element cannot prove.
 *
 * The safe-polygon geometry is asserted without a DOM in `hovercard.test.ts`;
 * what needs a browser is that it is fed the card's real
 * `getBoundingClientRect()`, that the document-level capture listeners see the
 * events they are supposed to see, that `preventDefault()` on a `mousemove`
 * really stops the elements underneath from reacting, that focus inside the
 * card is detected through `hasFocusWithin`, and that the disclosure reveal
 * observes an attribute written imperatively by the focusable layer.
 */

/** The hide delay used throughout, short enough to await for real. */
const HIDE_MS = 30

const cleanups: Array<() => void> = []
let container: HTMLDivElement

beforeEach(() => {
  context.reset()
  container = document.createElement('div')
  Object.assign(container.style, {
    position: 'fixed',
    top: '0px',
    left: '0px',
    width: '400px',
    height: '400px',
  })
  document.body.append(container)
})

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  container.remove()
})

const box = (style: Partial<CSSStyleDeclaration>, tag = 'div'): HTMLElement => {
  const element = document.createElement(tag)
  Object.assign(element.style, { position: 'absolute' }, style)
  container.append(element)
  return element
}

/** Lets the connect hook, its effects, and a `MutationObserver` catch up. */
const settle = async () => {
  notify()
  await null
  await null
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

/**
 * An anchor at the top of the viewport and a card below it, with a 40px gap
 * between them — the strip the pointer has to cross, and the reason the safe
 * polygon exists.
 */
const mount = async (options: { hideTimeout?: number } = {}) => {
  const moving = reatomPointerMoving({ name: 'test.moving' })
  const hovercard = reatomHovercard({
    hideTimeout: options.hideTimeout ?? HIDE_MS,
    showTimeout: 0,
    moving,
    name: 'h',
  }).extend(withHovercardDom())

  const anchor = box(
    { top: '0px', left: '100px', width: '100px', height: '20px' },
    'a',
  )
  const card = box({
    top: '60px',
    left: '100px',
    width: '100px',
    height: '100px',
  })
  const outside = box({
    top: '300px',
    left: '0px',
    width: '400px',
    height: '100px',
  })

  cleanups.push(hovercard.subscribe(() => {}))
  hovercard.props.anchor().ref(anchor)
  hovercard.props.content().ref(card)
  await settle()

  return { hovercard, moving, anchor, card, outside }
}

/** Dispatches a real mouse event, with the movement fields a real one carries. */
const dispatch = (
  target: EventTarget,
  type: string,
  init: MouseEventInit = {},
): MouseEvent => {
  const event = new MouseEvent(type, {
    bubbles: type !== 'mouseleave' && type !== 'mouseenter',
    cancelable: true,
    composed: true,
    movementX: 1,
    movementY: 1,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

/** The centre of an element, in viewport coordinates. */
const centre = (element: Element): MouseEventInit => {
  const rect = element.getBoundingClientRect()
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }
}

/** Opens the card and leaves the pointer on the anchor, as a hover would. */
const open = async (hovercard: Hovercard, anchor: HTMLElement) => {
  hovercard.show()
  await settle()
  dispatch(anchor, 'mousemove', centre(anchor))
}

// --- the pointer-movement listeners -----------------------------------------

test('the document tells the model whether the pointer is moving', async () => {
  const { moving } = await mount()

  expect(moving()).toBe(false)

  dispatch(document, 'mousemove', { movementX: 4, movementY: 0 })
  expect(moving()).toBe(true)

  // https://github.com/ariakit/ariakit/issues/1137 — a press is not hover intent
  dispatch(document, 'mousedown')
  expect(moving()).toBe(false)

  dispatch(document, 'mousemove', { movementX: 4 })
  dispatch(document, 'mouseup')
  expect(moving()).toBe(false)

  dispatch(document, 'mousemove', { movementX: 4 })
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
  expect(moving()).toBe(false)

  // a scroll fires a `mousemove` under a still pointer, and that is not intent
  dispatch(document, 'mousemove', { movementX: 4 })
  document.dispatchEvent(new Event('scroll'))
  expect(moving()).toBe(false)
})

test('the listeners disappear with the widget that asked for them', async () => {
  const { moving } = await mount()

  cleanups.pop()!()
  await settle()
  await sleep(10)

  dispatch(document, 'mousemove', { movementX: 4 })
  expect(moving()).toBe(false)
})

// --- the safe polygon -------------------------------------------------------

test('the enter point follows the pointer while it is over the anchor', async () => {
  const { hovercard, anchor } = await mount()
  const rect = anchor.getBoundingClientRect()

  hovercard.show()
  await settle()

  dispatch(anchor, 'mousemove', {
    clientX: rect.left + 10,
    clientY: rect.top + 5,
  })
  expect(hovercard.enterPoint()).toEqual([rect.left + 10, rect.top + 5])

  dispatch(anchor, 'mousemove', {
    clientX: rect.left + 60,
    clientY: rect.top + 15,
  })
  expect(hovercard.enterPoint()).toEqual([rect.left + 60, rect.top + 15])
})

test('a pointer heading for the card keeps it open and is swallowed', async () => {
  const { hovercard, anchor, card } = await mount()
  await open(hovercard, anchor)

  const anchorRect = anchor.getBoundingClientRect()
  const cardRect = card.getBoundingClientRect()
  // in the gap between the two, narrowing in on the card
  const event = dispatch(container, 'mousemove', {
    clientX: cardRect.left + cardRect.width / 2,
    clientY: (anchorRect.bottom + cardRect.top) / 2,
  })

  expect(hovercard()).toBe(true)
  expect(hovercard.hidePending()).toBe(false)
  // "This is necessary because the mousemove event may trigger focus on other
  // elements and close the hovercard while the user is moving the mouse toward
  // it."
  expect(event.defaultPrevented).toBe(true)
  // the polygon narrows as the pointer gets closer, instead of allowing a detour
  expect(hovercard.enterPoint()).toEqual([
    cardRect.left + cardRect.width / 2,
    (anchorRect.bottom + cardRect.top) / 2,
  ])

  await sleep(HIDE_MS * 2)
  expect(hovercard()).toBe(true)
})

test('a pointer wandering away closes the card after the hide delay', async () => {
  const { hovercard, anchor, outside } = await mount()
  await open(hovercard, anchor)

  const event = dispatch(outside, 'mousemove', centre(outside))

  expect(hovercard.hidePending()).toBe(true)
  expect(hovercard()).toBe(true)
  // nothing was swallowed: the pointer is not on its way to the card
  expect(event.defaultPrevented).toBe(false)

  await sleep(HIDE_MS * 2)
  expect(hovercard()).toBe(false)
})

test('the pointer reaching the card cancels the scheduled hide', async () => {
  const { hovercard, anchor, card, outside } = await mount()
  await open(hovercard, anchor)

  dispatch(outside, 'mousemove', centre(outside))
  expect(hovercard.hidePending()).toBe(true)

  // Ariakit clears the timeout inside the `isMovingOnHovercard` branch, so
  // arriving keeps the card even though a hide was already scheduled
  dispatch(card, 'mousemove', centre(card))
  expect(hovercard.hidePending()).toBe(false)
  // "Enter point will be null when the user hovers over the hovercard element."
  expect(hovercard.enterPoint()).toBe(null)

  await sleep(HIDE_MS * 2)
  expect(hovercard()).toBe(true)
})

test('the delay is measured from the moment the pointer left', async () => {
  const { hovercard, anchor, outside } = await mount({ hideTimeout: 80 })
  await open(hovercard, anchor)

  dispatch(outside, 'mousemove', centre(outside))
  await sleep(60)
  // `if (hideTimeoutRef.current) return` — a second position must not restart
  // the wait, or a pointer resting outside would keep the card forever
  dispatch(outside, 'mousemove', { ...centre(outside), clientX: 10 })

  await sleep(40)
  expect(hovercard()).toBe(false)
})

test('a card with focus inside it stays open wherever the pointer goes', async () => {
  const { hovercard, anchor, card, outside } = await mount()
  const button = document.createElement('button')
  button.textContent = 'Follow'
  card.append(button)

  await open(hovercard, anchor)
  button.focus()
  expect(document.activeElement).toBe(button)

  // `hasFocusWithin`: "The hovercard element has focus so we should keep it
  // visible."
  dispatch(outside, 'mousemove', centre(outside))
  expect(hovercard.hidePending()).toBe(false)

  await sleep(HIDE_MS * 2)
  expect(hovercard()).toBe(true)
})

test('a nested card is part of the card for the pointer', async () => {
  const { hovercard, anchor, card } = await mount()
  const submenu = reatomHovercard({
    parent: hovercard,
    hideTimeout: HIDE_MS,
    name: 'h.submenu',
  })
  // a portalled submenu overlapping neither the card nor the anchor
  const submenuCard = box({
    top: '60px',
    left: '220px',
    width: '100px',
    height: '100px',
  })

  submenu.props.content().ref(submenuCard)
  submenu.show()
  await open(hovercard, anchor)

  expect(hovercard.nestedCards()).toEqual([submenuCard])
  expect(card.contains(submenuCard)).toBe(false)

  dispatch(submenuCard, 'mousemove', centre(submenuCard))
  expect(hovercard.hidePending()).toBe(false)

  await sleep(HIDE_MS * 2)
  expect(hovercard()).toBe(true)
})

// react-components 0.3.0: "Fixed `Hovercard` so it stays open when hovering
// content rendered inside an open shadow root." A composed event is retargeted
// to the shadow host by the time a document listener reads `event.target`, and
// the host is not the card — only `composedPath()` still points at the element
// the pointer is really over.
test('the pointer on a card inside an open shadow root keeps it open', async () => {
  const { hovercard, card } = await mount()
  const host = box({ top: '0px', left: '0px' })
  host.attachShadow({ mode: 'open' }).append(card)

  // opened without ever hovering the anchor, so there is no safe polygon to
  // keep the card open: being on the card is the only thing that can
  hovercard.show()
  await settle()
  expect(hovercard.enterPoint()).toBe(null)

  // what a document listener would see instead of the card
  const seen: Array<EventTarget | null> = []
  document.addEventListener('mousemove', (event) => seen.push(event.target), {
    capture: true,
    once: true,
  })

  dispatch(card, 'mousemove', centre(card))

  expect(seen).toEqual([host])
  expect(hovercard.hidePending()).toBe(false)

  await sleep(HIDE_MS * 2)
  expect(hovercard()).toBe(true)
})

// react-components 0.3.0: "Fixed nested `Hovercard` components so pressing
// Escape closes the topmost card even when focus is on another element."
// Ariakit answers "am I the topmost?" by marking every element outside each open
// dialog and asking whether its own element got marked; here the nesting is
// declared, so `topmost` is a derivation of the stack and of the `open` atoms.
test('Escape closes the topmost nested card, wherever focus is', async () => {
  const outer = reatomHovercard({ showTimeout: 0, name: 'outer' }).extend(
    withDialogDismiss(),
  )
  const inner = reatomHovercard({
    parent: outer,
    showTimeout: 0,
    name: 'inner',
  }).extend(withDialogDismiss())

  outer.props.content().ref(box({ top: '60px', left: '100px' }))
  inner.props.content().ref(box({ top: '60px', left: '220px' }))
  cleanups.push(outer.subscribe(() => {}))
  cleanups.push(inner.subscribe(() => {}))

  // focus is on something that is neither card, nor a disclosure of either —
  // and it was there before the cards opened, so no interaction moved it out
  const elsewhere = box({ top: '300px', left: '0px' }, 'button')
  elsewhere.focus()
  expect(document.activeElement).toBe(elsewhere)

  outer.show()
  inner.show()
  await settle()
  expect(outer()).toBe(true)
  expect(inner()).toBe(true)

  const escape = () => {
    elsewhere.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    )
    return settle()
  }

  expect(outer.topmost()).toBe(false)
  expect(inner.topmost()).toBe(true)

  await escape()
  expect(inner()).toBe(false)
  expect(outer()).toBe(true)

  await escape()
  expect(outer()).toBe(false)
})

test('the pointer-transition events are suppressed during an approach', async () => {
  const { hovercard, anchor, card, outside } = await mount()
  await open(hovercard, anchor)

  const anchorRect = anchor.getBoundingClientRect()
  const cardRect = card.getBoundingClientRect()
  const inPolygon = {
    clientX: cardRect.left + cardRect.width / 2,
    clientY: (anchorRect.bottom + cardRect.top) / 2,
  }

  for (const type of ['mouseenter', 'mouseover', 'mouseout', 'mouseleave']) {
    expect(dispatch(container, type, inPolygon).defaultPrevented).toBe(true)
    // …and only inside the polygon, so the rest of the page keeps working
    expect(dispatch(outside, type, centre(outside)).defaultPrevented).toBe(
      false,
    )
  }
})

test('leaving the anchor cancels the pending show through a native mouseleave', async () => {
  const { hovercard, anchor, moving } = await mount()
  hovercard.showTimeout.set(200)
  await settle()

  moving.move({ movementX: 4 })
  hovercard.props.anchor().onMouseMove({ currentTarget: anchor, movementX: 4 })
  expect(hovercard.showPending()).toBe(true)

  // "We're using the native mouseleave event instead of React's onMouseLeave so
  // we bypass the event.stopPropagation() logic set on the Hovercard component."
  dispatch(anchor, 'mouseleave', centre(anchor))
  expect(hovercard.showPending()).toBe(false)

  await sleep(250)
  expect(hovercard()).toBe(false)
})

// --- the keyboard disclosure ------------------------------------------------

test('the disclosure button appears once the anchor is focus-visible', async () => {
  const { hovercard, anchor } = await mount()

  expect(hovercard.disclosureVisible()).toBe(false)
  expect(hovercard.props.disclosure().style).not.toBe(undefined)

  // the attribute the focusable layer writes imperatively, which is why this is
  // observed rather than derived
  anchor.setAttribute('data-focus-visible', '')
  await settle()

  expect(hovercard.disclosureVisible()).toBe(true)
  expect(hovercard.props.disclosure().style).toBe(undefined)
})

test('the reveal follows the anchor a shared card is moved to', async () => {
  // One card for a list of links: Ariakit re-targets its observer whenever
  // `anchorElement` changes, and the document-level one needs no re-targeting.
  const { hovercard, anchor } = await mount()
  const second = box(
    { top: '20px', left: '100px', width: '100px', height: '20px' },
    'a',
  )

  hovercard.anchorElement.set(second)
  await settle()

  anchor.setAttribute('data-focus-visible', '')
  await settle()
  expect(hovercard.disclosureVisible()).toBe(false)

  second.setAttribute('data-focus-visible', '')
  await settle()
  expect(hovercard.disclosureVisible()).toBe(true)
})

test('the disclosure button hides again when focus leaves for good', async () => {
  const { hovercard, anchor, card, outside } = await mount()
  const button = box({ top: '20px', left: '100px' }, 'button')
  const inside = document.createElement('button')
  card.append(inside)

  hovercard.props.disclosure().ref(button)
  anchor.setAttribute('data-focus-visible', '')
  await settle()
  expect(hovercard.disclosureVisible()).toBe(true)

  // focus that stays within the widget keeps the button reachable
  hovercard.show()
  await settle()
  document.dispatchEvent(
    new FocusEvent('focusout', { bubbles: true, relatedTarget: inside }),
  )
  expect(hovercard.disclosureVisible()).toBe(true)

  document.dispatchEvent(
    new FocusEvent('focusout', { bubbles: true, relatedTarget: button }),
  )
  expect(hovercard.disclosureVisible()).toBe(true)

  document.dispatchEvent(
    new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }),
  )
  expect(hovercard.disclosureVisible()).toBe(false)
})
