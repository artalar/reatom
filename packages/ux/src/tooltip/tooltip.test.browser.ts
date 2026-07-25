import type { Computed } from '@reatom/core'
import { context, notify, sleep, withConnectHook } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { withDialogDismiss } from '../dialog/reatomDialogDom'
import { connectKeyboardModality } from '../focusable/focusableDom'
import { reatomFocusVisible } from '../focusable/reatomFocusVisible'
import { withHovercardDom } from '../hovercard/reatomHovercardDom'
import { reatomPointerMoving } from '../hovercard/reatomPointerMoving'
import type { TooltipOptions } from './reatomTooltip'
import { reatomTooltip } from './reatomTooltip'
import { reatomTooltipRegistry } from './reatomTooltipRegistry'

/**
 * Bucket B (`PORTING_PLAN.md` §3): the parts of a tooltip that only a real
 * document can answer.
 *
 * The policy behind each of them is asserted without a DOM in
 * `tooltip.test.ts`; what needs a browser is that a real `focusin` carries the
 * facts the anchor record derives from it (`target === currentTarget`,
 * containment of the `relatedTarget`, the `selectionStart` probe that makes a
 * text field always-focus-visible), that the modality listener flips before the
 * focus it caused, that a click on the anchor is exempt from the dialog's
 * outside-interaction dismissal because the anchor is also the disclosure, and
 * that the "one tooltip at a time" registry works when the pointer, rather than
 * a test, drives it.
 */

const cleanups: Array<() => void> = []
let container: HTMLDivElement
let outside: HTMLElement
let rows = 0

beforeEach(() => {
  context.reset()
  rows = 0
  container = document.createElement('div')
  Object.assign(container.style, {
    position: 'fixed',
    top: '0px',
    left: '0px',
    width: '400px',
    height: '400px',
  })
  document.body.append(container)
  outside = box({ top: '300px', left: '0px', width: '400px', height: '100px' })
})

afterEach(async () => {
  while (cleanups.length) cleanups.pop()!()
  // The document listeners are removed by the disconnect of the models, and a
  // disconnect is a notification away. Without this the listeners of a finished
  // test are still installed when the next one resets the context, and the
  // first event of that test reaches a handler whose context is gone.
  await settle()
  container.remove()
})

const create = <T extends keyof HTMLElementTagNameMap>(
  tag: T,
  text?: string,
): HTMLElementTagNameMap[T] => {
  const element = document.createElement(tag)
  if (text) element.textContent = text
  return element
}

const box = (
  style: Partial<CSSStyleDeclaration>,
  tag: keyof HTMLElementTagNameMap = 'div',
): HTMLElement => {
  const element = create(tag)
  Object.assign(element.style, { position: 'absolute' }, style)
  container.append(element)
  return element
}

/**
 * How a view adapter binds the two focus handlers. React's `onFocus` is
 * `focusin`, not `focus`, and it has to be: `focus` does not bubble, so an
 * anchor listening for it would never see a child of its own being focused —
 * which is one of the cases the record has to tell apart.
 */
const EVENT_NAMES: Record<string, string> = {
  onfocus: 'focusin',
  onblur: 'focusout',
}

/**
 * The minimal view adapter: a reactive prop record applied to a real element.
 * `@reatom/jsx` does this with `$spread`, React with a plain spread; the test
 * does it by hand so the package keeps no view dependency.
 */
const spread = (
  element: HTMLElement,
  props: Computed<Record<string, any>>,
): void => {
  const record = props()

  for (const [key, value] of Object.entries(record)) {
    if (!key.startsWith('on')) continue
    const type = EVENT_NAMES[key.toLowerCase()] ?? key.slice(2).toLowerCase()
    element.addEventListener(type, value)
  }

  const apply = (next: Record<string, any>) => {
    next.ref?.(element)

    for (const [key, value] of Object.entries(next)) {
      if (key === 'ref' || key.startsWith('on')) continue
      if (key === 'hidden') {
        element.hidden = !!value
      } else if (key === 'tabIndex') {
        element.tabIndex = value
      } else if (key === 'style') {
        const { position, top, left, width, height } = element.style
        element.removeAttribute('style')
        Object.assign(element.style, { position, top, left, width, height })
        if (value) Object.assign(element.style, value)
      } else if (value == null || value === false) {
        element.removeAttribute(key)
      } else {
        element.setAttribute(key, value === true ? '' : String(value))
      }
    }
  }

  apply(record)
  cleanups.push(props.subscribe(apply))
}

/** Lets the connect hook, its effects and the delayed flows catch up. */
const settle = async () => {
  notify()
  await null
  await null
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

/**
 * A tooltip wired to a real anchor and a real tooltip element, with the pointer
 * layer of the hovercard and the dismissal layer of the dialog attached.
 */
const mount = async (
  options: TooltipOptions & { anchorTag?: keyof HTMLElementTagNameMap } = {},
) => {
  const { anchorTag = 'button', name = `tip${rows}`, ...rest } = options
  const row = rows++

  // The document listeners have to be installed from a connect hook, as
  // `reatomFocusable` does: `connectKeyboardModality` binds them to the abort
  // scope it is called in, and one called from a bare test has none to clean.
  const modality = reatomFocusVisible({ name: `${name}.modality` }).extend(
    withConnectHook((target) => {
      connectKeyboardModality(target)
    }),
  )

  const tooltip = reatomTooltip({
    showTimeout: 0,
    moving: reatomPointerMoving({ name: `${name}.moving` }),
    modality,
    name,
    ...rest,
  }).extend(withHovercardDom(), withDialogDismiss())

  cleanups.push(modality.subscribe(() => {}))

  const anchor = box(
    { top: `${row * 80}px`, left: '0px', width: '100px', height: '20px' },
    anchorTag,
  )
  const content = box({
    top: `${row * 80 + 40}px`,
    left: '0px',
    width: '120px',
    height: '30px',
  })
  // A `span` anchor is the interesting one for focus, so it needs to be
  // focusable at all.
  if (anchorTag === 'span') anchor.tabIndex = 0

  cleanups.push(tooltip.subscribe(() => {}))
  spread(anchor, tooltip.props.anchor)
  spread(content, tooltip.props.content)
  await settle()

  return { tooltip, anchor, content }
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

/** A pointer arriving on the anchor and moving over it, as a real one does. */
const hover = async (anchor: HTMLElement) => {
  dispatch(anchor, 'mouseenter', centre(anchor))
  dispatch(anchor, 'mousemove', centre(anchor))
  await settle()
}

const press = async (target: EventTarget, key: string) => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  await settle()
}

/** A full press-and-release, which is what the outside-click policy reads. */
const clickOn = async (element: Element) => {
  dispatch(element, 'mousedown', centre(element))
  dispatch(element, 'click', centre(element))
  await settle()
}

// --- the focus route --------------------------------------------------------

test('a real focus on the anchor opens the tooltip it describes', async () => {
  const { tooltip, anchor, content } = await mount()

  anchor.focus()
  await settle()

  expect(tooltip()).toBe(true)
  expect(tooltip.anchorFocusVisible()).toBe(true)
  // no delay, and no pending one: `onFocusVisible` calls `store.show()`
  expect(tooltip.showPending()).toBe(false)
  expect(tooltip.anchorElement()).toBe(anchor)

  // https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/ — the description has to
  // resolve to the element that is actually on screen
  const id = anchor.getAttribute('aria-describedby')!
  expect(document.getElementById(id)).toBe(content)
  expect(content.getAttribute('role')).toBe('tooltip')
  expect(content.hidden).toBe(false)
})

test('a pointer press decides whether the focus it causes shows the tooltip', async () => {
  const { tooltip, anchor } = await mount()

  // the capture-phase `mousedown` listener flips modality before the focus
  dispatch(anchor, 'mousedown', centre(anchor))
  anchor.focus()
  await settle()

  expect(tooltip.modality()).toBe(false)
  expect(tooltip()).toBe(false)

  // …and a keypress puts the user back in keyboard modality
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
  anchor.blur()
  anchor.focus()
  await settle()

  expect(tooltip()).toBe(true)
})

test('a clicked text field shows its tooltip anyway', async () => {
  const { tooltip, anchor } = await mount({ anchorTag: 'input' })

  dispatch(anchor, 'mousedown', centre(anchor))
  anchor.focus()
  await settle()

  // `isAlwaysFocusVisible` over a descriptor of the live node: the caret has to
  // be discoverable however focus arrived
  expect(tooltip.modality()).toBe(false)
  expect(tooltip()).toBe(true)
})

test('focus reaching a child of the anchor is not the anchor being focused', async () => {
  const { tooltip, anchor } = await mount({ anchorTag: 'span' })
  const child = create('input')
  anchor.append(child)

  child.focus()
  await settle()

  // `isSelfTarget(event)` — the record reads it off the bubbling `focusin`
  expect(tooltip.anchorFocusVisible()).toBe(false)
  expect(tooltip()).toBe(false)
})

test('focus moving inside the anchor keeps the tooltip, leaving closes it', async () => {
  const registry = reatomTooltipRegistry({ name: 'reg' })
  const { tooltip, anchor } = await mount({ registry, anchorTag: 'span' })
  const child = create('input')
  anchor.append(child)

  anchor.focus()
  await settle()
  expect(tooltip()).toBe(true)
  expect(registry()).toBe(tooltip)

  // `isFocusEventOutside(event)`: the `relatedTarget` is inside the anchor
  child.focus()
  await settle()
  expect(tooltip()).toBe(true)

  outside.tabIndex = 0
  outside.focus()
  await settle()

  // APG: "the tooltip remains visible until Escape is pressed or focus moves
  // away from the trigger"
  expect(tooltip()).toBe(false)
  // "we don't want to show subsequent tooltips without a delay"
  expect(registry()).toBe(null)
})

// --- the pointer route ------------------------------------------------------

test('a hovered anchor closes its tooltip the moment the pointer leaves', async () => {
  const { tooltip, anchor } = await mount()

  await hover(anchor)
  expect(tooltip()).toBe(true)
  // the anchor is also the disclosure, which is what exempts it from dismissal
  expect(tooltip.disclosureElement()).toBe(anchor)

  dispatch(outside, 'mousemove', centre(outside))
  await settle()

  // `hideTimeout: 0` — there is nothing inside a tooltip to travel to
  expect(tooltip()).toBe(false)
})

test('a keyboard-focused anchor keeps its tooltip wherever the pointer goes', async () => {
  const { tooltip, anchor } = await mount()

  anchor.focus()
  await settle()
  // "If the anchor element has the `data-focus-visible` attribute, we don't hide
  // the tooltip when the mouse leaves the anchor element."
  expect(tooltip.hideOnHoverOutside()).toBe(false)

  dispatch(outside, 'mousemove', centre(outside))
  await settle()
  expect(tooltip.hidePending()).toBe(false)

  await sleep(30)
  expect(tooltip()).toBe(true)
})

test('Escape closes the tooltip, and the resting pointer does not reopen it', async () => {
  const { tooltip, anchor } = await mount()

  await hover(anchor)
  expect(tooltip()).toBe(true)

  // the document-level listener of `withDialogDismiss`, with focus on the body
  await press(document.body, 'Escape')
  expect(tooltip()).toBe(false)
  expect(tooltip.canShowOnHover()).toBe(false)

  // "the user hovers over an anchor, which shows a tooltip, then presses escape
  // to close the tooltip. We don't want to show the tooltip again while the
  // anchor is still hovered."
  dispatch(anchor, 'mousemove', centre(anchor))
  await settle()
  expect(tooltip()).toBe(false)

  // leaving and re-entering the anchor arms it again
  dispatch(anchor, 'mouseleave', centre(anchor))
  await hover(anchor)
  expect(tooltip()).toBe(true)
})

test('clicking the anchor does not dismiss the tooltip, clicking elsewhere does', async () => {
  const { tooltip, anchor } = await mount()

  await hover(anchor)
  expect(tooltip()).toBe(true)

  // `isDisclosureTarget(disclosureElement, target)`: Ariakit's tooltip-specific
  // `hideOnInteractOutside` override, as an element assignment
  await clickOn(anchor)
  expect(tooltip()).toBe(true)

  await clickOn(outside)
  expect(tooltip()).toBe(false)
  expect(tooltip.dismissIntent()).toBe('outside')
})

// --- the registry -----------------------------------------------------------

test('hovering a second anchor while a tooltip is open swaps the two at once', async () => {
  const registry = reatomTooltipRegistry({ name: 'reg' })
  const first = await mount({ registry, name: 'first' })
  // a delay the second tooltip is expected to skip entirely
  const second = await mount({ registry, name: 'second', showTimeout: 500 })

  await hover(first.anchor)
  expect(first.tooltip()).toBe(true)
  expect(registry()).toBe(first.tooltip)

  dispatch(first.anchor, 'mouseleave', centre(first.anchor))
  await hover(second.anchor)

  // "Show the tooltip immediately if there's an active tooltip instead of
  // waiting for the showTimeout delay."
  expect(second.tooltip()).toBe(true)
  expect(second.tooltip.showPending()).toBe(false)
  expect(first.tooltip()).toBe(false)
  expect(registry()).toBe(second.tooltip)
  expect(second.content.hidden).toBe(false)
  expect(first.content.hidden).toBe(true)
})
