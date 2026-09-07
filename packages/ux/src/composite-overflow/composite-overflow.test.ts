import { atom, context } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import { reatomComposite } from '../composite/reatomComposite'
import { popoverProps } from '../popover/props'
import { reatomPopover } from '../popover/reatomPopover'
import {
  COMPOSITE_OVERFLOW_HIDDEN_STYLE,
  compositeOverflowProps,
  withCompositeOverflowProps,
} from './props'
import {
  compositeOverflowDisclosureId,
  reatomCompositeOverflow,
  withCompositeOverflow,
} from './reatomCompositeOverflow'

beforeEach(() => context.reset())

/**
 * A stand-in for a DOM node: the model and the prop records only store element
 * handles and compare them, so an object with an `id` is enough. The real focus
 * behavior of the popover lives in the popover and composite browser tests.
 */
const element = (id = ''): HTMLElement => ({ id }) as unknown as HTMLElement

/** A composite with two visible items, the widget an overflow popover extends. */
const toolbar = (name = 't') => {
  const composite = reatomComposite({ name })
  composite.items.renderItem({ id: 'bold', element: element('bold') })
  composite.items.renderItem({ id: 'italic', element: element('italic') })
  return composite
}

/** The event shape the disclosure handlers read, targeted at the button. */
const on = <Rest extends object>(button: HTMLElement, rest = {} as Rest) => ({
  target: button,
  currentTarget: button,
  ...rest,
})

// --- model ------------------------------------------------------------------

test('a composite overflow is a popover, with the popover defaults', () => {
  const overflow = reatomCompositeOverflow({ name: 'o' })

  // `createCompositeOverflowStore` is `createPopoverStore`, so every popover
  // unit is the overflow's own
  expect(overflow()).toBe(false)
  expect(overflow.placement()).toBe('bottom')
  expect(overflow.currentPlacement()).toBe('bottom')
  expect(overflow.modal()).toBe(false)
  expect(overflow.mounted()).toBe(false)
  expect(overflow.hideOnEscape()).toBe(true)
  expect(overflow.contentId()).toBe('o-content')
  expect(overflow.anchorElement()).toBe(null)

  // and what the overflow adds
  expect(overflow.composite).toBe(null)
  expect(overflow.disclosureId()).toBe('o-disclosure')
  expect(overflow.disclosureItem()).toBe(null)
  expect(overflow.disclosureFocused()).toBe(false)
})

test('every unit is named after the model', () => {
  const overflow = reatomCompositeOverflow({ name: 'editor.overflow' })

  expect(overflow.name).toBe('editor.overflow')
  expect(overflow.disclosureId.name).toBe('editor.overflow.disclosureId')
  expect(overflow.disclosureFocused.name).toBe(
    'editor.overflow.disclosureFocused',
  )
  expect(overflow.disclosureItem.name).toBe('editor.overflow.disclosureItem')
  expect(overflow.renderDisclosure.name).toBe(
    'editor.overflow.renderDisclosure',
  )
  expect(overflow.unrenderDisclosure.name).toBe(
    'editor.overflow.unrenderDisclosure',
  )
  // inherited from the popover it is built on
  expect(overflow.placement.name).toBe('editor.overflow.placement')
  expect(overflow.reposition.name).toBe('editor.overflow.reposition')

  expect(reatomCompositeOverflow().name).toMatch(/^compositeOverflow#\d+$/)
})

test('the disclosure id is a DOM-safe derivation of the name, and overridable', () => {
  expect(compositeOverflowDisclosureId('toolbar.overflow')).toBe(
    'toolbar-overflow-disclosure',
  )
  expect(compositeOverflowDisclosureId('select#3.overflow')).toBe(
    'select-3-overflow-disclosure',
  )

  const overflow = reatomCompositeOverflow({
    disclosureId: 'more-items',
    name: 'o',
  })
  expect(overflow.disclosureId()).toBe('more-items')
})

test('the disclosure is rendered into the composite on demand, and removed again', () => {
  const composite = toolbar()
  const overflow = reatomCompositeOverflow({ composite, name: 't.overflow' })
  const button = element('more')

  expect(overflow.composite).toBe(composite)
  expect(overflow.disclosureItem()).toBe(null)

  // the element defaults to the one the `disclosure` record's `ref` assigned
  overflow.disclosureElement.set(button)
  const item = overflow.renderDisclosure()

  expect(item).not.toBe(null)
  expect(item!.id).toBe('t-overflow-disclosure')
  expect(item!.element()).toBe(button)
  expect(overflow.disclosureItem()).toBe(item)
  // registered *and* rendered, so the composite navigates to it
  expect(composite.items.renderedItems().map((node) => node.id)).toEqual([
    'bold',
    'italic',
    't-overflow-disclosure',
  ])

  expect(overflow.unrenderDisclosure()).toBe(true)
  expect(overflow.disclosureItem()).toBe(null)
  expect(composite.items.ids()).toEqual(['bold', 'italic'])
})

test('without a composite the disclosure item actions are no-ops', () => {
  const overflow = reatomCompositeOverflow({ name: 'o' })

  expect(overflow.renderDisclosure()).toBe(null)
  expect(overflow.unrenderDisclosure()).toBe(false)
  expect(overflow.disclosureItem()).toBe(null)
})

test('withCompositeOverflow adopts a caller-owned boolean atom', () => {
  const composite = toolbar()
  const open = atom(false, 'more')
  const overflow = open
    .extend(withCompositeOverflow({ composite, placement: 'bottom-end' }))
    .extend(withCompositeOverflowProps())

  expect(overflow.placement()).toBe('bottom-end')
  expect(overflow.disclosureId()).toBe('more-disclosure')
  expect(overflow.props.content().role).toBe('presentation')

  overflow.show()
  expect(open()).toBe(true)
})

// --- the popover element ----------------------------------------------------

test('the popover element is a presentational wrapper that is never hidden', () => {
  const overflow = reatomCompositeOverflow({ name: 'o' })
  const content = overflow.props.content()

  // composite-overflow.tsx: `role: 'presentation'` — the popover only holds the
  // overflowing items, which are composite items in their own right
  expect(content.role).toBe('presentation')
  // `usePopover({ focusable: false })`: the element takes no tab stop
  expect(content.tabIndex).toBe(undefined)
  // `usePopover({ alwaysVisible: true })`: hiding the popover with
  // `display: none` would make the overflowing items unfocusable
  expect(content.hidden).toBe(false)
  expect(content.style).toEqual({ position: 'relative' })
  // the dialog half of the record is untouched
  expect(content['data-dialog']).toBe('')
  expect(content.id).toBe('o-content')

  overflow.show()
  expect(overflow.props.content()).toMatchObject({
    hidden: false,
    'data-open': true,
    'data-placing': true,
  })
})

test('focus reaching the popover shows it', () => {
  const overflow = reatomCompositeOverflow({ name: 'o' })

  // The overflowing items stay focusable while the popover is closed, so
  // arrow-key navigation can land on one before it is open — focus is what
  // opens the popover (composite-overflow.tsx: `store.show()` on focus). The
  // event is not checked for `isSelfTarget`: it bubbles up from an item.
  overflow.props
    .content()
    .onFocus({ target: element('item'), currentTarget: element('popover') })
  expect(overflow()).toBe(true)

  overflow.hide()
  overflow.props.content().onFocus({ defaultPrevented: true })
  expect(overflow()).toBe(false)
})

test('the wrapper is transparent instead of hidden while the popover is closed', () => {
  const overflow = reatomCompositeOverflow({ name: 'o' })

  expect(COMPOSITE_OVERFLOW_HIDDEN_STYLE).toEqual({
    opacity: 0,
    pointerEvents: 'none',
  })
  expect(overflow.props.wrapper().style).toEqual({
    position: 'absolute',
    top: 0,
    left: 0,
    width: 'max-content',
    opacity: 0,
    pointerEvents: 'none',
  })

  overflow.show()
  expect(overflow.props.wrapper().style).toEqual({
    position: 'absolute',
    top: 0,
    left: 0,
    width: 'max-content',
  })
})

test('alwaysVisible can be opted out of, at the cost of the pattern', () => {
  const overflow = reatomCompositeOverflow({ alwaysVisible: false, name: 'o' })

  expect(overflow.props.content().hidden).toBe(true)
  expect(overflow.props.content().style).toEqual({
    position: 'relative',
    display: 'none',
  })
})

// --- the disclosure element -------------------------------------------------

test('the disclosure is a popover disclosure that hides itself from ATs', () => {
  const composite = toolbar()
  const overflow = reatomCompositeOverflow({ composite, name: 't.overflow' })
  const button = element('more')

  overflow.props.disclosure().ref(button)
  expect(overflow.disclosureElement()).toBe(button)
  // a popover disclosure anchors the popover it opens
  expect(overflow.anchorElement()).toBe(button)

  expect(overflow.props.disclosure()).toMatchObject({
    id: 't-overflow-disclosure',
    type: 'button',
    'aria-haspopup': 'dialog',
    'aria-expanded': false,
    'aria-controls': 't-overflow-content',
    // composite-overflow-disclosure.ts: `aria-hidden: !shouldRegisterItem` —
    // the overflowing items are announced themselves, so a "+2 items" button
    // would duplicate them
    'aria-hidden': true,
    'data-active-item': undefined,
    // the roving tabindex: the single tab stop belongs to the active item
    tabIndex: -1,
  })

  overflow.props.disclosure().onClick({ currentTarget: button })
  expect(overflow()).toBe(true)
  expect(overflow.props.disclosure()['aria-expanded']).toBe(true)
})

test('the disclosure joins the composite while it has focus', () => {
  const composite = toolbar()
  const overflow = reatomCompositeOverflow({ composite, name: 't.overflow' })
  const button = element('more')
  const props = overflow.props.disclosure

  props().ref(button)
  props().onFocus(on(button))

  expect(overflow.disclosureFocused()).toBe(true)
  // registered, rendered, and active — a composite item like any other
  expect(overflow.disclosureItem()?.element()).toBe(button)
  expect(composite()).toBe('t-overflow-disclosure')
  expect(props()).toMatchObject({
    'aria-hidden': false,
    'data-active-item': true,
    tabIndex: undefined,
  })

  props().onBlur(on(button))
  expect(overflow.disclosureFocused()).toBe(false)
  expect(overflow.disclosureItem()).toBe(null)
  expect(props()['aria-hidden']).toBe(true)
})

test('the disclosure ignores focus that bubbled up and prevented events', () => {
  const composite = toolbar()
  const overflow = reatomCompositeOverflow({ composite, name: 't.overflow' })
  const button = element('more')
  const props = overflow.props.disclosure

  props().onFocus({ target: element('icon'), currentTarget: button })
  expect(overflow.disclosureFocused()).toBe(false)

  props().onFocus(on(button, { defaultPrevented: true }))
  expect(overflow.disclosureFocused()).toBe(false)

  props().onFocus(on(button))
  props().onBlur(on(button, { defaultPrevented: true }))
  expect(overflow.disclosureFocused()).toBe(true)
})

test('unmounting the disclosure element leaves the composite', () => {
  const composite = toolbar()
  const overflow = reatomCompositeOverflow({ composite, name: 't.overflow' })
  const button = element('more')
  const props = overflow.props.disclosure

  props().ref(button)
  props().onFocus(on(button))
  props().ref(null)

  expect(overflow.disclosureElement()).toBe(null)
  expect(overflow.disclosureFocused()).toBe(false)
  expect(overflow.disclosureItem()).toBe(null)
  expect(composite.items.ids()).toEqual(['bold', 'italic'])
})

test('the disclosure navigates the composite with the arrow keys', () => {
  const composite = toolbar()
  const overflow = reatomCompositeOverflow({ composite, name: 't.overflow' })
  const button = element('more')
  const props = overflow.props.disclosure
  let prevented = 0

  const keyDown = (key: string) =>
    props().onKeyDown(on(button, { key, preventDefault: () => prevented++ }))

  props().ref(button)
  props().onFocus(on(button))

  // the disclosure is the last rendered item, so the previous one is `italic`
  keyDown('ArrowLeft')
  expect(composite()).toBe('italic')
  expect(prevented).toBe(1)

  composite.set('t-overflow-disclosure')
  // nowhere to go: the key keeps its default behavior
  keyDown('ArrowRight')
  expect(composite()).toBe('t-overflow-disclosure')
  expect(prevented).toBe(1)

  keyDown('Home')
  expect(composite()).toBe('bold')
  expect(prevented).toBe(2)

  // a key that means nothing to the composite, and a prevented event
  keyDown('Enter')
  props().onKeyDown(
    on(button, {
      key: 'ArrowLeft',
      defaultPrevented: true,
      preventDefault: () => prevented++,
    }),
  )
  expect(composite()).toBe('bold')
  expect(prevented).toBe(2)
})

test('a disclosure without a composite is a plain popover disclosure', () => {
  const overflow = reatomCompositeOverflow({ name: 'o' })
  const button = element('more')
  const props = overflow.props.disclosure

  expect(props()).toMatchObject({
    // Without composite items to stand for, this is an ordinary disclosure and
    // must remain exposed to assistive technology.
    'aria-hidden': false,
    'data-active-item': undefined,
    // no composite to hold a roving tabindex, so the button keeps its own
    tabIndex: undefined,
  })

  props().onFocus(on(button))
  expect(overflow.disclosureFocused()).toBe(true)
  expect(props()['aria-hidden']).toBe(false)
  expect(overflow.disclosureItem()).toBe(null)

  props().onKeyDown(on(button, { key: 'ArrowLeft' }))
  expect(overflow.disclosureFocused()).toBe(true)
})

test('the disclosure stays out of the tab order it cannot hold', () => {
  const composite = reatomComposite({ name: 't' })
  const overflow = reatomCompositeOverflow({ composite, name: 't.overflow' })

  // an empty composite has no item to hold the single tab stop, so every
  // candidate is tabbable — Ariakit's first `isTabbable` branch
  expect(overflow.props.disclosure().tabIndex).toBe(undefined)

  composite.items.renderItem({ id: 'bold', element: element('bold') })
  expect(overflow.props.disclosure().tabIndex).toBe(-1)

  // with virtual focus the base element keeps DOM focus, so no item is tabbable
  composite.virtualFocus.set(true)
  overflow.renderDisclosure({ element: element('more') })
  expect(overflow.props.disclosure().tabIndex).toBe(-1)
})

// --- prop records -----------------------------------------------------------

test('the records are named after the model, and inherit the popover ones', () => {
  const overflow = reatomCompositeOverflow({ name: 't.overflow' })

  expect(overflow.props.disclosure.name).toBe('t.overflow.props.disclosure')
  expect(overflow.props.content.name).toBe('t.overflow.props.content')
  expect(overflow.props.wrapper.name).toBe('t.overflow.props.wrapper')
  // untouched by the overflow layer
  expect(overflow.props.anchor.name).toBe('t.overflow.props.anchor')
  expect(overflow.props.arrow().style.fontSize).toBe(30)
  expect(overflow.props.heading().id).toBe('t-overflow-heading')
})

test('compositeOverflowProps layers onto records the caller built', () => {
  const composite = toolbar()
  const overflow = atom(false, 'more').extend(
    withCompositeOverflow({ composite }),
  )
  const popover = popoverProps(overflow, { fixed: true, alwaysVisible: true })
  const props = compositeOverflowProps(overflow, {
    popover,
    name: 'more.overflow',
  })

  expect(props.wrapper().style).toMatchObject({
    position: 'fixed',
    opacity: 0,
    pointerEvents: 'none',
  })
  expect(props.content().role).toBe('presentation')
  expect(props.disclosure.name).toBe('more.overflow.props.disclosure')
  // the records the overflow does not touch are the ones passed in
  expect(props.anchor).toBe(popover.anchor)
  expect(props.dismiss).toBe(popover.dismiss)
})

test('an overflow popover is a popover a positioner can drive', () => {
  const overflow = reatomCompositeOverflow({ name: 'o' })

  // the placement pair and the element handles behave exactly as a popover's,
  // which is what makes `withFloating` work unchanged
  overflow.show()
  expect(overflow.placing()).toBe(true)
  overflow.currentPlacement.set('top-end')
  overflow.positioned.set(true)
  expect(overflow.side()).toBe('top')
  expect(overflow.placing()).toBe(false)
  expect(overflow.props.content()['data-placing']).toBe(undefined)

  // and a plain popover is not a composite overflow: the overflow records are
  // the only ones that make the popover presentational
  expect(reatomPopover({ name: 'p' }).props.content().role).toBe('dialog')
})
