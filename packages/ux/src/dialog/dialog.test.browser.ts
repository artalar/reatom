import type { Computed } from '@reatom/core'
import { context, notify } from '@reatom/core'
import { userEvent } from '@vitest/browser/context'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { isFocusable } from '../focusable/focusableDom'
import type { DialogOptions } from './reatomDialog'
import { reatomDialog } from './reatomDialog'
import { withDialogDom } from './reatomDialogDom'

/**
 * Bucket B (`PORTING_PLAN.md` §3): everything a dialog can only be judged by in
 * a real document — focus moving in and out, the `inert` background, the locked
 * body scroll, a document-level Escape, and a real click outside.
 *
 * The policy behind each of them is asserted without a DOM in `dialog.test.ts`,
 * so these tests only check that the DOM layer applies it to real elements.
 */

const cleanups: Array<() => void> = []
let container: HTMLDivElement

beforeEach(() => {
  context.reset()
  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  container.remove()
})

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
    if (key.startsWith('on')) {
      element.addEventListener(key.slice(2).toLowerCase(), value)
    }
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
        element.removeAttribute('style')
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

const create = <T extends keyof HTMLElementTagNameMap>(
  tag: T,
  text?: string,
): HTMLElementTagNameMap[T] => {
  const element = document.createElement(tag)
  if (text) element.textContent = text
  return element
}

/** Flushes the notification and the microtasks the focus flow is deferred by. */
const settle = async () => {
  notify()
  await null
  await null
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

/**
 * Mounts a complete dialog: a disclosure button, an element outside the dialog,
 * a backdrop, the two focus-trap sentinels, and a dialog with two tabbables.
 */
const mount = async (options: DialogOptions = {}) => {
  const dialog = reatomDialog({ name: 'd', ...options }).extend(withDialogDom())

  const disclosure = create('button', 'Open')
  const outside = create('button', 'Outside')
  const backdrop = create('div')
  const before = create('span')
  const after = create('span')
  const content = create('div')
  const input = create('input')
  const dismiss = create('button', 'Cancel')

  content.append(input, dismiss)
  container.append(disclosure, outside, backdrop, before, content, after)

  spread(disclosure, dialog.props.disclosure)
  spread(backdrop, dialog.props.backdrop)
  spread(before, dialog.props.focusTrap)
  spread(after, dialog.props.focusTrap)
  spread(dismiss, dialog.props.dismiss)
  spread(content, dialog.props.content)

  await settle()

  return {
    dialog,
    disclosure,
    outside,
    backdrop,
    before,
    after,
    content,
    input,
    dismiss,
  }
}

const press = async (target: EventTarget, key: string) => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  await settle()
}

/** A full press-and-release, which is what the outside-click policy reads. */
const clickOn = async (element: Element) => {
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await settle()
}

// --- focus ------------------------------------------------------------------

// ariakit-react-components/src/dialog/dialog.tsx, "Auto focus on show" /
// "Auto focus on hide"
test('focus moves into the dialog and back to the disclosure', async () => {
  const { dialog, disclosure, input } = await mount()

  disclosure.focus()
  disclosure.click()
  await settle()

  expect(dialog()).toBe(true)
  // no `initialFocus`, no `[data-autofocus]`: the first tabbable element wins
  expect(document.activeElement).toBe(input)

  dialog.dismiss('button')
  await settle()

  expect(document.activeElement).toBe(disclosure)
})

test('initialFocus wins over the first tabbable element', async () => {
  const { dialog, disclosure, dismiss } = await mount()
  dialog.initialFocus.set(dismiss)

  disclosure.click()
  await settle()

  expect(document.activeElement).toBe(dismiss)
})

test('an empty dialog focuses itself, because of its tabIndex', async () => {
  const dialog = reatomDialog({ name: 'empty' }).extend(withDialogDom())
  const content = create('div')
  container.append(content)
  spread(content, dialog.props.content)
  await settle()

  dialog.show()
  await settle()

  expect(document.activeElement).toBe(content)
})

// ariakit-react-components/src/dialog/dialog.tsx, `interactedOutsideRef`
test('a dismissal from outside leaves focus where the user put it', async () => {
  const { dialog, disclosure, outside } = await mount({ modal: false })

  disclosure.focus()
  disclosure.click()
  await settle()

  await clickOn(outside)

  expect(dialog()).toBe(false)
  expect(dialog.dismissIntent()).toBe('outside')
  expect(document.activeElement).not.toBe(disclosure)
})

// ariakit-react-components/src/focus-trap/focus-trap-region.tsx
test('the focus-trap sentinels wrap focus around the dialog', async () => {
  const { dialog, before, after, input, dismiss } = await mount()

  dialog.show()
  await settle()

  // the sentinels are only tabbable while focus must be trapped
  expect(before.hidden).toBe(false)
  expect(isFocusable(before)).toBe(true)

  // Shift+Tab from the first tabbable element lands on the sentinel before the
  // dialog, which sends focus to the last one
  input.focus()
  before.dispatchEvent(
    new FocusEvent('focus', { relatedTarget: input, bubbles: false }),
  )
  await settle()
  expect(document.activeElement).toBe(dismiss)

  // Tab out of the end of the dialog wraps back to its first tabbable element
  after.dispatchEvent(new FocusEvent('focus', { bubbles: false }))
  await settle()
  expect(document.activeElement).toBe(input)

  dialog.modal.set(false)
  await settle()
  expect(before.hidden).toBe(true)
  expect(isFocusable(before)).toBe(false)
})

test('a real Tab cycles inside a modal dialog', async () => {
  const { dialog, input, dismiss, outside } = await mount()

  dialog.show()
  await settle()
  input.focus()

  await userEvent.tab()
  expect(document.activeElement).toBe(dismiss)

  // the background is inert and the sentinel catches the focus that leaves the
  // dialog, so Tab wraps instead of walking into the page
  await userEvent.tab()
  await settle()
  expect(document.activeElement).toBe(input)
  expect(document.activeElement).not.toBe(outside)
})

test('a real Escape key press closes the dialog', async () => {
  const { dialog, disclosure, input } = await mount()

  disclosure.click()
  await settle()
  expect(dialog()).toBe(true)
  expect(document.activeElement).toBe(input)

  await userEvent.keyboard('{Escape}')
  await settle()

  expect(dialog()).toBe(false)
  expect(dialog.dismissIntent()).toBe('escape')
})

// ariakit-react-components/src/dialog/dialog.tsx, `isValidTarget`: the document
// listener accepts Escape from `<body>`, the dialog, and its disclosure — but
// not from an unrelated widget that happens to have focus.
test('a real Escape is filtered by the element it comes from', async () => {
  const { dialog, disclosure, outside } = await mount({
    modal: false,
    autoFocusOnShow: false,
    hideOnInteractOutside: false,
  })

  dialog.show()
  await settle()

  outside.focus()
  await userEvent.keyboard('{Escape}')
  await settle()
  expect(dialog()).toBe(true)

  disclosure.focus()
  await userEvent.keyboard('{Escape}')
  await settle()
  expect(dialog()).toBe(false)
})

// --- modal ------------------------------------------------------------------

// ariakit-react-components/src/dialog/utils/{walk-tree-outside,disable-tree}.ts
test('a modal dialog makes the background inert and restores it', async () => {
  const { dialog, disclosure, outside, backdrop, before, content, input } =
    await mount()

  expect(isFocusable(outside)).toBe(true)

  dialog.show()
  await settle()

  expect(outside.hasAttribute('inert')).toBe(true)
  expect(disclosure.hasAttribute('inert')).toBe(true)
  expect(isFocusable(outside)).toBe(false)
  // the dialog, its content, the backdrop, and the sentinels stay usable
  expect(content.hasAttribute('inert')).toBe(false)
  expect(backdrop.hasAttribute('inert')).toBe(false)
  expect(before.hasAttribute('inert')).toBe(false)
  expect(isFocusable(input)).toBe(true)

  dialog.hide()
  await settle()

  expect(outside.hasAttribute('inert')).toBe(false)
  expect(isFocusable(outside)).toBe(true)
})

test('a non-modal dialog leaves the background alone', async () => {
  const { dialog, outside } = await mount({ modal: false })

  dialog.show()
  await settle()

  expect(outside.hasAttribute('inert')).toBe(false)
  expect(document.body.style.overflow).toBe('')
})

// ariakit-react-components/src/dialog/utils/use-prevent-body-scroll.ts
test('a modal dialog locks the scroll while it is mounted', async () => {
  const { dialog } = await mount()

  dialog.show()
  await settle()
  expect(document.body.style.overflow).toBe('hidden')

  dialog.hide()
  await settle()
  expect(document.body.style.overflow).toBe('')
})

test('a scrollbar that takes no space is not compensated for', async () => {
  const { dialog } = await mount()
  const html = document.documentElement
  // a page tall enough to scroll, whose scrollbar is an overlay one — this
  // browser runs with `--hide-scrollbars`, which is the same measurement
  const tall = create('div')
  tall.style.height = '300vh'
  container.append(tall)
  expect(window.innerWidth - html.clientWidth).toBe(0)

  dialog.show()
  await settle()

  // hiding the overflow cannot shift the layout, so there is nothing to
  // reserve: no gutter, no padding, and no `--scrollbar-width`
  expect(html.getAttribute('style')).toBe(null)
  expect(document.body.style.paddingRight).toBe('')
  expect(document.body.style.overflow).toBe('hidden')

  dialog.hide()
  await settle()
  expect(document.body.style.overflow).toBe('')
})

test('a page that reserves the gutter itself is locked through it', async () => {
  // the technique the lock prefers wherever the browser supports it
  expect(CSS.supports('scrollbar-gutter', 'stable')).toBe(true)

  const html = document.documentElement
  // `both-edges` is an author keyword the lock must carry over as it is
  html.style.setProperty('scrollbar-gutter', 'stable both-edges')
  cleanups.push(() => html.removeAttribute('style'))

  const { dialog } = await mount()

  dialog.show()
  await settle()

  expect(html.style.getPropertyValue('scrollbar-gutter')).toBe(
    'stable both-edges',
  )
  // the reserved gutter keeps the scrollbar's space while the hidden overflow
  // of `<html>` — the element the page scrolls through — locks the scroll
  expect(html.style.getPropertyValue('overflow-x')).toBe('hidden')
  expect(html.style.getPropertyValue('overflow-y')).toBe('hidden')
  // and `<body>` is left alone, so nothing shifts
  expect(document.body.style.overflow).toBe('')
  expect(document.body.style.paddingRight).toBe('')

  dialog.hide()
  await settle()

  // the author's declaration is back, and the lock's own ones are gone
  expect(html.getAttribute('style')).toBe(
    'scrollbar-gutter: stable both-edges;',
  )
})

test('a dialog stack locks the scroll once and releases it last', async () => {
  const parent = reatomDialog({ name: 'parent' }).extend(withDialogDom())
  const child = reatomDialog({ parent, name: 'parent.child' }).extend(
    withDialogDom(),
  )
  const parentContent = create('div')
  const childContent = create('div')
  container.append(parentContent, childContent)
  spread(parentContent, parent.props.content)
  spread(childContent, child.props.content)
  await settle()

  parent.show()
  child.show()
  await settle()
  expect(document.body.style.overflow).toBe('hidden')

  // the parent is still open, so the page stays locked
  child.hide()
  await settle()
  expect(document.body.style.overflow).toBe('hidden')

  parent.hide()
  await settle()
  expect(document.body.style.overflow).toBe('')
})

// ariakit-react-components/src/dialog/utils/prepend-hidden-dismiss.ts
test('a modal dialog without a dismiss button gets a hidden one', async () => {
  const dialog = reatomDialog({ name: 'bare' }).extend(withDialogDom())
  const content = create('div')
  container.append(content)
  spread(content, dialog.props.content)
  await settle()

  dialog.show()
  await settle()

  const hidden = content.firstElementChild as HTMLButtonElement
  expect(hidden.dataset.dialogHiddenDismiss).toBe('')
  expect(hidden.textContent).toBe('Dismiss popup')
  // visually hidden, but reachable for a screen reader
  expect(getComputedStyle(hidden).position).toBe('absolute')

  hidden.click()
  await settle()
  expect(dialog()).toBe(false)
})

test('a dialog that has its own dismiss button gets no hidden one', async () => {
  const { dialog, content } = await mount()

  dialog.show()
  await settle()

  expect(content.querySelector('[data-dialog-hidden-dismiss]')).toBe(null)
})

// --- dismissal --------------------------------------------------------------

// ariakit-react-components/src/dialog/dialog.tsx: the listener is on the
// document, so the key works while focus is outside the dialog
test('Escape closes the dialog from anywhere in the document', async () => {
  const { dialog } = await mount()

  dialog.show()
  await settle()

  await press(document.body, 'Escape')

  expect(dialog()).toBe(false)
  expect(dialog.dismissIntent()).toBe('escape')
})

test('Escape closes only the innermost dialog of a stack', async () => {
  const parent = reatomDialog({ name: 'parent' }).extend(withDialogDom())
  const child = reatomDialog({ parent, name: 'parent.child' }).extend(
    withDialogDom(),
  )
  const parentContent = create('div')
  const childContent = create('div')
  container.append(parentContent, childContent)
  spread(parentContent, parent.props.content)
  spread(childContent, child.props.content)
  await settle()

  parent.show()
  child.show()
  await settle()

  await press(document.body, 'Escape')
  expect(child()).toBe(false)
  expect(parent()).toBe(true)

  await press(document.body, 'Escape')
  expect(parent()).toBe(false)
})

test('a nested dialog is not disabled by its parent', async () => {
  const parent = reatomDialog({ name: 'parent' }).extend(withDialogDom())
  const child = reatomDialog({ parent, name: 'parent.child' }).extend(
    withDialogDom(),
  )
  const parentContent = create('div')
  const childContent = create('div')
  const childInput = create('input')
  const outside = create('button', 'Outside')
  childContent.append(childInput)
  container.append(outside, parentContent, childContent)
  spread(parentContent, parent.props.content)
  spread(childContent, child.props.content)
  await settle()

  parent.show()
  child.show()
  await settle()

  expect(outside.hasAttribute('inert')).toBe(true)
  expect(childContent.hasAttribute('inert')).toBe(false)
  expect(isFocusable(childInput)).toBe(true)
})

// react-components 0.3.4: "Fixed sibling modal `Dialog` components […] rendered
// in their default portals so opening them in the same render no longer made
// each other inert." Ariakit has to infer the relation between two modals from
// the order their portal nodes were created, and two that opened in one render
// disabled each other, leaving the whole page inert. Here the relation is
// declared, so the order they opened in decides nothing — and the restore of the
// dialog that closes first leaves the background inert for the one still open.
test('the declared stack, not the open order, decides which modal traps', async () => {
  const parent = reatomDialog({ name: 'parent' }).extend(withDialogDom())
  const child = reatomDialog({ parent, name: 'parent.child' }).extend(
    withDialogDom(),
  )
  const parentContent = create('div')
  const childContent = create('div')
  const outside = create('button', 'Outside')
  // rendered next to each other, which is where a default portal puts them
  container.append(outside, parentContent, childContent)
  spread(parentContent, parent.props.content)
  spread(childContent, child.props.content)
  await settle()

  // the nested dialog opens first, and its parent joins it in the same batch
  child.show()
  parent.show()
  await settle()

  expect(outside.hasAttribute('inert')).toBe(true)
  expect(childContent.hasAttribute('inert')).toBe(false)
  // the innermost dialog of the stack is the one that traps
  expect(parentContent.hasAttribute('inert')).toBe(true)

  child.hide()
  await settle()

  // the page belongs to the parent again, and is still not the user's
  expect(parentContent.hasAttribute('inert')).toBe(false)
  expect(outside.hasAttribute('inert')).toBe(true)

  parent.hide()
  await settle()
  expect(outside.hasAttribute('inert')).toBe(false)
})

// ariakit-react-components/src/dialog/utils/use-hide-on-interact-outside.ts
test('a click outside closes the dialog, a click inside does not', async () => {
  const { dialog, outside, input } = await mount({ modal: false })

  dialog.show()
  await settle()

  await clickOn(input)
  expect(dialog()).toBe(true)

  await clickOn(outside)
  expect(dialog()).toBe(false)
  expect(dialog.dismissIntent()).toBe('outside')
})

// react-components 0.3.4: "Fixed `Dialog` […] so interacting with elements
// returned by `getPersistentElements` across open shadow roots no longer closes
// the component before it receives focus." A listener on the document is given
// `event.target` retargeted to the shadow host, and the host is not part of the
// dialog — only the composed path still points at the element under the pointer.
test('a click inside a shadow root of the dialog does not close it', async () => {
  const dialog = reatomDialog({ modal: false, name: 'shadow' }).extend(
    withDialogDom(),
  )
  const host = create('div')
  const outside = create('button', 'Outside')
  container.append(outside, host)

  const content = create('div')
  const input = create('input')
  content.append(input)
  host.attachShadow({ mode: 'open' }).append(content)

  spread(content, dialog.props.content)
  await settle()

  dialog.show()
  await settle()

  // a real pointer event is composed, which is what makes it leave the root
  const clickThroughShadow = async (element: Element) => {
    const init = { bubbles: true, composed: true }
    element.dispatchEvent(new MouseEvent('mousedown', init))
    element.dispatchEvent(new MouseEvent('click', init))
    await settle()
  }

  const seen: Array<EventTarget | null> = []
  document.addEventListener('click', (event) => seen.push(event.target), {
    capture: true,
    once: true,
  })

  await clickThroughShadow(input)

  // what the document listener was given instead of the field
  expect(seen).toEqual([host])
  expect(dialog()).toBe(true)

  // …while an interaction that really is outside still closes it
  await clickThroughShadow(outside)
  expect(dialog()).toBe(false)
  expect(dialog.dismissIntent()).toBe('outside')
})

// ariakit#1336, ariakit#2330: selecting text inside the dialog and releasing
// the button outside of it must not close anything
test('a drag out of the dialog does not close it', async () => {
  const { dialog, outside, input } = await mount({ modal: false })

  dialog.show()
  await settle()

  input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await settle()

  expect(dialog()).toBe(true)
})

test('the backdrop stays clickable while the background is inert', async () => {
  const { dialog, backdrop } = await mount()

  dialog.show()
  await settle()

  expect(backdrop.hasAttribute('inert')).toBe(false)
  expect(getComputedStyle(backdrop).position).toBe('fixed')

  backdrop.click()
  await settle()

  expect(dialog()).toBe(false)
  expect(dialog.interactedOutside()).toBe(true)
})

test('hideOnInteractOutside keeps a dialog open on an outside click', async () => {
  const { dialog, outside } = await mount({
    modal: false,
    hideOnInteractOutside: false,
  })

  dialog.show()
  await settle()

  await clickOn(outside)
  expect(dialog()).toBe(true)

  await press(document.body, 'Escape')
  expect(dialog()).toBe(false)
})

// --- a11y contract ----------------------------------------------------------

test('the rendered dialog carries the APG attributes', async () => {
  const dialog = reatomDialog({ role: 'alertdialog', name: 'confirm' })
  const content = create('div')
  const heading = create('h2', 'Delete file?')
  const description = create('p', 'This cannot be undone.')
  content.append(heading, description)
  container.append(content)

  spread(content, dialog.props.content)
  spread(heading, dialog.props.heading)
  spread(description, dialog.props.description)
  await settle()

  dialog.show()
  await settle()

  expect(content.getAttribute('role')).toBe('alertdialog')
  expect(content.getAttribute('aria-modal')).toBe('')
  expect(content.getAttribute('aria-labelledby')).toBe(heading.id)
  expect(content.getAttribute('aria-describedby')).toBe(description.id)
  expect(content.id).toBe('confirm-content')
  expect(content.tabIndex).toBe(-1)
  expect(content.hidden).toBe(false)
})
