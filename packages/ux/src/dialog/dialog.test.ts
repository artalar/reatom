import { atom, context, effect } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import { claimEscape, setAttribute } from './dialogDom'
import {
  isDialogEscape,
  isDialogInteractionOutside,
  isDialogOutsideClick,
  nextDialogFinalFocus,
  nextFocusTrapTarget,
  pickDialogInitialFocus,
} from './dialogIntent'
import {
  dialogDescriptionId,
  dialogHeadingId,
  dialogProps,
  withDialogProps,
} from './props'
import { reatomDialog, withDialog } from './reatomDialog'

beforeEach(() => context.reset())

/** A stand-in for a DOM node: the model only ever stores element handles. */
const element = (id = '') => ({ id }) as unknown as HTMLElement

// --- model ------------------------------------------------------------------

test('defaults match the Ariakit dialog props', () => {
  const dialog = reatomDialog({ name: 'd' })

  // the disclosure half
  expect(dialog()).toBe(false)
  expect(dialog.mounted()).toBe(false)
  expect(dialog.animated()).toBe(false)
  expect(dialog.contentId()).toBe('d-content')

  // the dialog half
  expect(dialog.role()).toBe('dialog')
  expect(dialog.modal()).toBe(true)
  expect(dialog.backdrop()).toBe(true)
  expect(dialog.preventBodyScroll()).toBe(true)
  expect(dialog.hideOnEscape()).toBe(true)
  expect(dialog.hideOnInteractOutside()).toBe(true)
  expect(dialog.autoFocusOnShow()).toBe(true)
  expect(dialog.autoFocusOnHide()).toBe(true)
  expect(dialog.initialFocus()).toBe(null)
  expect(dialog.finalFocus()).toBe(null)
  expect(dialog.backdropElement()).toBe(null)
  expect(dialog.label()).toBe(null)
  expect(dialog.headingId()).toBe(null)
  expect(dialog.descriptionId()).toBe(null)
  expect(dialog.parent).toBe(null)
  expect(dialog.children()).toEqual([])
  expect(dialog.nestedDialogs()).toEqual([])
  expect(dialog.topmost()).toBe(true)
  expect(dialog.focusTrapped()).toBe(false)
  expect(dialog.scrollLocked()).toBe(false)
  expect(dialog.dismissIntent()).toBe(null)
  expect(dialog.interactedOutside()).toBe(false)
})

test('every unit is named after the model', () => {
  const dialog = reatomDialog({ name: 'd' })

  expect(dialog.name).toBe('d')
  expect(dialog.role.name).toBe('d.role')
  expect(dialog.modal.name).toBe('d.modal')
  expect(dialog.backdrop.name).toBe('d.backdrop')
  expect(dialog.backdropElement.name).toBe('d.backdropElement')
  expect(dialog.preventBodyScroll.name).toBe('d.preventBodyScroll')
  expect(dialog.hideOnEscape.name).toBe('d.hideOnEscape')
  expect(dialog.hideOnInteractOutside.name).toBe('d.hideOnInteractOutside')
  expect(dialog.autoFocusOnShow.name).toBe('d.autoFocusOnShow')
  expect(dialog.autoFocusOnHide.name).toBe('d.autoFocusOnHide')
  expect(dialog.initialFocus.name).toBe('d.initialFocus')
  expect(dialog.finalFocus.name).toBe('d.finalFocus')
  expect(dialog.label.name).toBe('d.label')
  expect(dialog.headingId.name).toBe('d.headingId')
  expect(dialog.descriptionId.name).toBe('d.descriptionId')
  expect(dialog.children.name).toBe('d.children')
  expect(dialog.nestedDialogs.name).toBe('d.nestedDialogs')
  expect(dialog.topmost.name).toBe('d.topmost')
  expect(dialog.focusTrapped.name).toBe('d.focusTrapped')
  expect(dialog.scrollLocked.name).toBe('d.scrollLocked')
  expect(dialog.dismissIntent.name).toBe('d.dismissIntent')
  expect(dialog.interactedOutside.name).toBe('d.interactedOutside')
  expect(dialog.register.name).toBe('d.register')
  expect(dialog.unregister.name).toBe('d.unregister')
  expect(dialog.dismiss.name).toBe('d.dismiss')
  // inherited from the disclosure it is built on
  expect(dialog.mounted.name).toBe('d.mounted')
  expect(dialog.show.name).toBe('d.show')
})

test('the dialog is a disclosure: show, hide, and toggle drive open', () => {
  const dialog = reatomDialog({ name: 'd' })

  expect(dialog.show()).toBe(true)
  expect(dialog.mounted()).toBe(true)
  expect(dialog.focusTrapped()).toBe(true)
  expect(dialog.scrollLocked()).toBe(true)

  expect(dialog.hide()).toBe(false)
  expect(dialog.mounted()).toBe(false)
  expect(dialog.toggle()).toBe(true)
  expect(dialog.toggle()).toBe(false)
})

test('an animated dialog stays mounted, trapped only while open', () => {
  const dialog = reatomDialog({ animated: true, name: 'd' })
  const unsubscribe = dialog.mounted.subscribe(() => {})

  dialog.show()
  // `animating` is a derivation of the observed `open` changes, so the open
  // state has to be read before it can be animated out — see the disclosure
  // test "an unobserved open and close round trip does not animate".
  expect(dialog.mounted()).toBe(true)
  expect(dialog.focusTrapped()).toBe(true)

  dialog.hide()
  // the exit animation keeps it on screen, but focus is free again
  expect(dialog.mounted()).toBe(true)
  expect(dialog.focusTrapped()).toBe(false)
  // …and the body stays locked until it is really gone
  expect(dialog.scrollLocked()).toBe(true)

  dialog.animating.set(false)
  expect(dialog.mounted()).toBe(false)
  expect(dialog.scrollLocked()).toBe(false)

  unsubscribe()
})

test('backdrop and preventBodyScroll follow modal until pinned', () => {
  const following = reatomDialog({ name: 'following' })

  following.modal.set(false)
  expect(following.backdrop()).toBe(false)
  expect(following.preventBodyScroll()).toBe(false)
  expect(following.focusTrapped()).toBe(false)

  const pinned = reatomDialog({
    modal: false,
    backdrop: true,
    preventBodyScroll: true,
    name: 'pinned',
  })

  expect(pinned.backdrop()).toBe(true)
  expect(pinned.preventBodyScroll()).toBe(true)
  pinned.modal.set(true)
  expect(pinned.backdrop()).toBe(true)
})

test('a non-modal dialog locks nothing', () => {
  const dialog = reatomDialog({ modal: false, name: 'd' })

  expect(dialog.backdrop()).toBe(false)
  dialog.show()
  expect(dialog.focusTrapped()).toBe(false)
  expect(dialog.scrollLocked()).toBe(false)
})

test('dismiss closes the dialog and records why', () => {
  const dialog = reatomDialog({ name: 'd' })
  dialog.show()

  expect(dialog.dismiss('escape')).toBe(false)
  expect(dialog()).toBe(false)
  expect(dialog.dismissIntent()).toBe('escape')
  expect(dialog.interactedOutside()).toBe(false)

  dialog.show()
  dialog.dismiss('outside')
  expect(dialog.interactedOutside()).toBe(true)

  // the default intent keeps `dismiss` usable as a plain close
  dialog.show()
  dialog.dismiss()
  expect(dialog.dismissIntent()).toBe('programmatic')
})

test('the dismiss intent resets when the dialog opens again', () => {
  // ariakit-react-components/src/dialog/dialog.tsx: the flag is reset from a
  // `sync(store, ['open'])` listener so a prevented or animated close can not
  // leave a stale value behind.
  const dialog = reatomDialog({ name: 'd' })

  dialog.show()
  dialog.dismiss('outside')
  expect(dialog.interactedOutside()).toBe(true)

  dialog.show()
  expect(dialog.dismissIntent()).toBe(null)
  expect(dialog.interactedOutside()).toBe(false)
})

test('withDialog adopts a caller-owned atom', () => {
  const open = atom(false, 'checkout.open')
  const checkout = open.extend(withDialog({ role: 'alertdialog' }))

  expect(checkout).toBe(open)
  expect(checkout.role()).toBe('alertdialog')
  expect(checkout.mounted.name).toBe('checkout.open.mounted')
  expect(checkout.topmost.name).toBe('checkout.open.topmost')

  open.set(true)
  expect(checkout.focusTrapped()).toBe(true)
})

test('anonymous dialogs get unique names and DOM-safe ids', () => {
  const first = reatomDialog()
  const second = reatomDialog()

  expect(first.name).not.toBe(second.name)
  expect(first.contentId()).not.toContain('#')
  expect(dialogHeadingId('menu#3.dialog')).toBe('menu-3-dialog-heading')
  expect(dialogDescriptionId('menu#3.dialog')).toBe('menu-3-dialog-description')
})

// --- nested dialogs ---------------------------------------------------------

test('a nested dialog joins the stack on creation and the list while open', () => {
  const parent = reatomDialog({ name: 'parent' })
  const child = reatomDialog({ parent, name: 'parent.child' })

  expect(child.parent).toBe(parent)
  // the structure is known immediately, the open list is derived from it
  expect(parent.children()).toEqual([child])
  expect(parent.nestedDialogs()).toEqual([])

  parent.show()
  child.show()

  expect(parent.nestedDialogs()).toEqual([child])
  // only the innermost dialog reacts to Escape
  expect(parent.topmost()).toBe(false)
  expect(child.topmost()).toBe(true)

  child.hide()

  expect(parent.nestedDialogs()).toEqual([])
  expect(parent.topmost()).toBe(true)
})

test('a deeply nested dialog is known to every ancestor', () => {
  // ariakit-react-components/src/dialog/utils/use-nested-dialogs.tsx chains
  // `context.add`, so a grandchild is registered in the grandparent too.
  const root = reatomDialog({ name: 'root' })
  const middle = reatomDialog({ parent: root, name: 'root.middle' })
  const leaf = reatomDialog({ parent: middle, name: 'root.middle.leaf' })

  middle.show()
  leaf.show()

  expect(root.nestedDialogs()).toEqual([middle, leaf])
  expect(middle.nestedDialogs()).toEqual([leaf])
  expect(root.topmost()).toBe(false)
  expect(middle.topmost()).toBe(false)
  expect(leaf.topmost()).toBe(true)

  leaf.hide()

  expect(root.nestedDialogs()).toEqual([middle])
  expect(middle.topmost()).toBe(true)

  // the chain does not depend on the dialog in between being open
  middle.hide()
  leaf.show()
  expect(root.nestedDialogs()).toEqual([leaf])
  expect(root.topmost()).toBe(false)
})

test('the stack works without a subscription and updates reactively', async () => {
  const parent = reatomDialog({ name: 'parent' })
  const child = reatomDialog({ parent, name: 'parent.child' })
  const seen: Array<number> = []
  const track = effect(
    () => void seen.push(parent.nestedDialogs().length),
    'parent.track',
  )

  child.show()
  await null
  child.hide()
  await null

  track.unsubscribe()
  expect(seen).toEqual([0, 1, 0])
})

test('register adopts a dialog, unregister detaches it again', () => {
  const parent = reatomDialog({ name: 'parent' })
  const foreign = reatomDialog({ name: 'foreign' })
  foreign.show()

  const detach = parent.register(foreign)
  expect(parent.children()).toEqual([foreign])
  expect(parent.nestedDialogs()).toEqual([foreign])
  expect(parent.topmost()).toBe(false)

  detach()
  expect(parent.children()).toEqual([])
  expect(parent.nestedDialogs()).toEqual([])

  // a dialog created with a `parent` detaches itself the same way
  const child = reatomDialog({ parent, name: 'parent.child' })
  child.show()
  expect(parent.topmost()).toBe(false)

  child.unregister()
  expect(parent.children()).toEqual([])
  expect(parent.topmost()).toBe(true)
  // idempotent, and a root dialog can be asked too
  child.unregister()
  parent.unregister()
  expect(parent.children()).toEqual([])
})

// --- pure policy ------------------------------------------------------------

test('isDialogEscape accepts only Escape from a valid target', () => {
  // ariakit-react-components/src/dialog/dialog.tsx, `isValidTarget`
  const base = { key: 'Escape', enabled: true, topmost: true } as const

  expect(isDialogEscape({ ...base, bodyTarget: true })).toBe(true)
  expect(isDialogEscape({ ...base, insideContent: true })).toBe(true)
  // no known disclosure element: every target is accepted
  expect(isDialogEscape(base)).toBe(true)
  expect(isDialogEscape({ ...base, hasDisclosure: true })).toBe(false)
  expect(
    isDialogEscape({ ...base, hasDisclosure: true, insideDisclosure: true }),
  ).toBe(true)

  expect(isDialogEscape({ ...base, key: 'Enter', bodyTarget: true })).toBe(
    false,
  )
  expect(isDialogEscape({ ...base, bodyTarget: true, enabled: false })).toBe(
    false,
  )
  expect(isDialogEscape({ ...base, bodyTarget: true, topmost: false })).toBe(
    false,
  )
  expect(
    isDialogEscape({ ...base, bodyTarget: true, defaultPrevented: true }),
  ).toBe(false)
})

// react-components 0.3.4, "Handling Esc in nested widgets"
test('isDialogEscape refuses a key a nested widget consumed', () => {
  const base = {
    key: 'Escape',
    enabled: true,
    topmost: true,
    insideContent: true,
  } as const

  expect(isDialogEscape(base)).toBe(true)
  expect(isDialogEscape({ ...base, propagationStopped: true })).toBe(false)
  // a valid target does not make up for it either
  expect(
    isDialogEscape({ ...base, bodyTarget: true, propagationStopped: true }),
  ).toBe(false)
})

test('isDialogInteractionOutside excludes everything that belongs to the dialog', () => {
  // ariakit-react-components/src/dialog/utils/use-hide-on-interact-outside.ts
  expect(isDialogInteractionOutside({})).toBe(true)
  expect(isDialogInteractionOutside({ inDocument: false })).toBe(false)
  expect(isDialogInteractionOutside({ insideContent: true })).toBe(false)
  // a nested dialog is part of the modal context, wherever it is rendered
  expect(isDialogInteractionOutside({ onNestedDialog: true })).toBe(false)
  expect(isDialogInteractionOutside({ onDisclosure: true })).toBe(false)
  expect(isDialogInteractionOutside({ onFocusTrap: true })).toBe(false)
  expect(isDialogInteractionOutside({ onContentBox: true })).toBe(false)
})

test('isDialogOutsideClick needs a press that started outside', () => {
  expect(isDialogOutsideClick({ pressed: true, pressedOutside: true })).toBe(
    true,
  )
  // the press opened the dialog: ariakit form-select example
  expect(isDialogOutsideClick({})).toBe(false)
  // a drag out of the dialog: ariakit#1336, ariakit#2330
  expect(isDialogOutsideClick({ pressed: true, pressedOutside: false })).toBe(
    false,
  )
  expect(
    isDialogOutsideClick({
      pressed: true,
      pressedOutside: true,
      insideContent: true,
    }),
  ).toBe(false)
})

test('an Escape event is claimed by one dialog only', () => {
  // ariakit-react-components/src/dialog/dialog.tsx marks the tree outside the
  // innermost dialog instead, so the outer ones bail out on `isElementMarked`.
  const event = { key: 'Escape' }

  expect(claimEscape(event)).toBe(true)
  expect(claimEscape(event)).toBe(false)
  expect(claimEscape({ key: 'Escape' })).toBe(true)
  // a manual call has no event to claim
  expect(claimEscape()).toBe(true)
  expect(claimEscape(null)).toBe(true)
})

test('a nested dialog does not close its parent with one Escape', () => {
  const parent = reatomDialog({ name: 'parent' })
  const child = reatomDialog({ parent, name: 'parent.child' })
  parent.show()
  child.show()

  // one key press, delivered to both dialogs — a nested dialog renders inside
  // its parent, so the event bubbles through both records
  const event = { key: 'Escape' }
  child.props.content().onKeyDown(event)
  parent.props.content().onKeyDown(event)

  expect(child()).toBe(false)
  expect(parent()).toBe(true)

  parent.props.content().onKeyDown({ key: 'Escape' })
  expect(parent()).toBe(false)
})

test('nextFocusTrapTarget wraps focus around the dialog', () => {
  // ariakit-react-components/src/focus-trap/focus-trap-region.tsx
  expect(nextFocusTrapTarget(3, false)).toBe('first')
  expect(nextFocusTrapTarget(3, true)).toBe('last')
  expect(nextFocusTrapTarget(0, false)).toBe('container')
  expect(nextFocusTrapTarget(0, true)).toBe('container')
})

test('pickDialogInitialFocus follows the Ariakit fallback chain', () => {
  expect(
    pickDialogInitialFocus({
      initialFocus: true,
      autoFocus: true,
      firstTabbable: true,
    }),
  ).toBe('initialFocus')
  expect(pickDialogInitialFocus({ autoFocus: true, firstTabbable: true })).toBe(
    'autoFocus',
  )
  expect(pickDialogInitialFocus({ firstTabbable: true })).toBe('firstTabbable')
  expect(pickDialogInitialFocus({})).toBe('content')
})

test('nextDialogFinalFocus restores, retries, or gives up', () => {
  const focusable = { enabled: true, hasTarget: true, targetFocusable: true }

  expect(nextDialogFinalFocus(focusable)).toBe('focus')
  expect(nextDialogFinalFocus({ ...focusable, enabled: false })).toBe('skip')
  // a click outside behaves like a native dialog: focus stays where it landed
  expect(nextDialogFinalFocus({ ...focusable, interactedOutside: true })).toBe(
    'skip',
  )
  expect(
    nextDialogFinalFocus({ ...focusable, focusMovedElsewhere: true }),
  ).toBe('skip')
  // a nested dialog may still need a tick to drop `inert`
  expect(
    nextDialogFinalFocus({ enabled: true, hasTarget: true, canRetry: true }),
  ).toBe('retry')
  expect(nextDialogFinalFocus({ enabled: true, hasTarget: true })).toBe('skip')
  expect(nextDialogFinalFocus({ enabled: true, canRetry: true })).toBe('retry')
})

// --- the orchestrated DOM mutations -----------------------------------------

/** A stand-in for a DOM node with the attribute API `setAttribute` mutates. */
const attributed = (attributes: Record<string, string>) =>
  ({
    getAttribute: (key: string) => attributes[key] ?? null,
    setAttribute: (key: string, value: string) => {
      attributes[key] = value
    },
    removeAttribute: (key: string) => {
      delete attributes[key]
    },
  }) as unknown as Element

test('the restore stack of one key unwinds in order', () => {
  const attributes: Record<string, string> = { inert: 'initial' }
  const element = attributed(attributes)

  const restoreOne = setAttribute(element, 'inert', 'one')
  const restoreTwo = setAttribute(element, 'inert', 'two')
  const restoreThree = setAttribute(element, 'inert', 'three')
  expect(attributes.inert).toBe('three')

  restoreThree()
  expect(attributes.inert).toBe('two')
  restoreTwo()
  expect(attributes.inert).toBe('one')
  restoreOne()
  expect(attributes.inert).toBe('initial')
})

// react-components 0.2.0: "Fixed `Dialog` cleanup so stale nested dialog effects
// no longer restore page accessibility state while a newer effect is active."
// Two dialogs disable the same background element, and they close in whichever
// order the user picked; the one that closes first must leave the attribute to
// the one still open, and hand it back only when that one is done with it.
test('a stale restore waits for the current owner of the key', () => {
  const attributes: Record<string, string> = { inert: 'initial' }
  const element = attributed(attributes)

  const restoreOne = setAttribute(element, 'inert', 'one')
  const restoreTwo = setAttribute(element, 'inert', 'two')

  // the outer dialog closes first, while the inner one is still open
  restoreOne()
  expect(attributes.inert).toBe('two')

  // and the value the inner one found is what it restores — both undone at once
  restoreTwo()
  expect(attributes.inert).toBe('initial')

  // a restore is idempotent, so a re-run of the same effect cleanup is harmless
  restoreOne()
  restoreTwo()
  expect(attributes.inert).toBe('initial')
})

test('a restore in the middle of the stack is skipped over, not applied', () => {
  const attributes: Record<string, string> = { inert: 'initial' }
  const element = attributed(attributes)

  const restoreOne = setAttribute(element, 'inert', 'one')
  const restoreTwo = setAttribute(element, 'inert', 'two')
  const restoreThree = setAttribute(element, 'inert', 'three')

  restoreTwo()
  expect(attributes.inert).toBe('three')

  restoreThree()
  expect(attributes.inert).toBe('one')

  restoreOne()
  expect(attributes.inert).toBe('initial')
})

test('every element and every key keeps its own stack', () => {
  const first: Record<string, string> = {}
  const second: Record<string, string> = {}
  const element = attributed(first)
  const other = attributed(second)

  const restoreInert = setAttribute(element, 'inert', '')
  setAttribute(element, 'aria-hidden', 'true')
  setAttribute(other, 'inert', '')

  restoreInert()
  expect('inert' in first).toBe(false)
  expect(first['aria-hidden']).toBe('true')
  expect('inert' in second).toBe(true)
})

// --- prop records -----------------------------------------------------------

test('the disclosure record is the disclosure button plus aria-haspopup', () => {
  const dialog = reatomDialog({ name: 'd' })

  expect(dialog.props.disclosure()).toMatchObject({
    type: 'button',
    'aria-haspopup': 'dialog',
    'aria-expanded': false,
    'aria-controls': 'd-content',
  })

  const button = element('button')
  dialog.props.disclosure().onClick({ currentTarget: button })

  expect(dialog()).toBe(true)
  expect(dialog.disclosureElement()).toBe(button)
  expect(dialog.props.disclosure()['aria-expanded']).toBe(true)
})

test('the content record carries the dialog ARIA contract', () => {
  const dialog = reatomDialog({ name: 'd' })

  expect(dialog.props.content()).toMatchObject({
    'data-dialog': '',
    id: 'd-content',
    role: 'dialog',
    'aria-modal': true,
    'aria-label': undefined,
    'aria-labelledby': undefined,
    'aria-describedby': undefined,
    tabIndex: -1,
    hidden: true,
    style: { display: 'none' },
    'data-open': undefined,
  })

  dialog.show()
  expect(dialog.props.content()).toMatchObject({
    hidden: false,
    style: undefined,
    'data-open': true,
  })

  dialog.modal.set(false)
  expect(dialog.props.content()['aria-modal']).toBe(undefined)

  dialog.role.set('alertdialog')
  expect(dialog.props.content().role).toBe('alertdialog')
})

test('the content record is memoized per state', () => {
  const dialog = reatomDialog({ name: 'd' })
  const first = dialog.props.content()

  expect(dialog.props.content()).toBe(first)
  dialog.show()
  expect(dialog.props.content()).not.toBe(first)
})

test('the content ref assigns the dialog element', () => {
  const dialog = reatomDialog({ name: 'd' })
  const content = element('content')

  dialog.props.content().ref(content)
  expect(dialog.contentElement()).toBe(content)
  dialog.props.content().ref(null)
  expect(dialog.contentElement()).toBe(null)
})

test('Escape inside the dialog dismisses it', () => {
  const dialog = reatomDialog({ name: 'd' })
  dialog.show()

  dialog.props.content().onKeyDown({ key: 'Enter' })
  expect(dialog()).toBe(true)

  dialog.props.content().onKeyDown({ key: 'Escape' })
  expect(dialog()).toBe(false)
  expect(dialog.dismissIntent()).toBe('escape')
})

test('Escape is ignored when disabled, prevented, or not topmost', () => {
  const dialog = reatomDialog({ hideOnEscape: false, name: 'd' })
  dialog.show()

  dialog.props.content().onKeyDown({ key: 'Escape' })
  expect(dialog()).toBe(true)

  dialog.hideOnEscape.set(true)
  dialog.props.content().onKeyDown({ key: 'Escape', defaultPrevented: true })
  expect(dialog()).toBe(true)

  const child = reatomDialog({ name: 'child' })
  const detach = dialog.register(child)
  child.show()
  dialog.props.content().onKeyDown({ key: 'Escape' })
  expect(dialog()).toBe(true)

  detach()
  dialog.props.content().onKeyDown({ key: 'Escape' })
  expect(dialog()).toBe(false)
})

// react-components 0.3.4, "Handling Esc in nested widgets"
test('the content record stops an Escape it acted on at the dialog', () => {
  const dialog = reatomDialog({ name: 'd' })
  dialog.show()

  let stopped = 0
  const press = (event: Partial<Record<string, unknown>> = {}) =>
    dialog.props.content().onKeyDown({
      key: 'Escape',
      stopPropagation: () => stopped++,
      ...event,
    })

  // a key a nested widget consumed leaves the dialog open, and is not stopped a
  // second time
  press({ cancelBubble: true })
  expect(dialog()).toBe(true)
  expect(stopped).toBe(0)

  press()
  expect(dialog()).toBe(false)
  // nothing above the dialog acts on the press that closed it
  expect(stopped).toBe(1)
})

test('an explicit label wins over the registered heading', () => {
  const dialog = reatomDialog({ label: 'Delete file', name: 'd' })

  dialog.props.heading().ref(element())
  expect(dialog.headingId()).toBe('d-heading')
  expect(dialog.props.content()).toMatchObject({
    'aria-label': 'Delete file',
    'aria-labelledby': undefined,
  })

  dialog.label.set(null)
  expect(dialog.props.content()['aria-labelledby']).toBe('d-heading')
})

test('the heading and description records register their ids', () => {
  const dialog = reatomDialog({ name: 'd' })

  expect(dialog.props.heading().id).toBe('d-heading')
  expect(dialog.props.description().id).toBe('d-description')

  // an element that renders the id from the record keeps the default
  dialog.props.heading().ref(element())
  dialog.props.description().ref(element())

  expect(dialog.props.content()).toMatchObject({
    'aria-labelledby': 'd-heading',
    'aria-describedby': 'd-description',
  })

  // an element that renders its own id keeps it
  dialog.props.heading().ref(element('custom-title'))
  expect(dialog.props.content()['aria-labelledby']).toBe('custom-title')

  dialog.props.heading().ref(null)
  dialog.props.description().ref(null)
  expect(dialog.props.content()).toMatchObject({
    'aria-labelledby': undefined,
    'aria-describedby': undefined,
  })
})

test('configured heading and description ids are used as they are', () => {
  const dialog = reatomDialog({
    headingId: 'ssr-title',
    descriptionId: 'ssr-body',
    name: 'd',
  })

  expect(dialog.props.heading().id).toBe('ssr-title')
  expect(dialog.props.content()).toMatchObject({
    'aria-labelledby': 'ssr-title',
    'aria-describedby': 'ssr-body',
  })
})

test('the backdrop record covers the viewport and dismisses on its own click', () => {
  const dialog = reatomDialog({ name: 'd' })
  const backdrop = element('backdrop')

  expect(dialog.props.backdrop()).toMatchObject({
    'data-backdrop': 'd-content',
    role: 'presentation',
    hidden: true,
    style: { position: 'fixed', top: 0, display: 'none' },
  })

  dialog.props.backdrop().ref(backdrop)
  expect(dialog.backdropElement()).toBe(backdrop)

  dialog.show()
  expect(dialog.props.backdrop()).toMatchObject({
    hidden: false,
    'data-open': true,
  })
  expect(dialog.props.backdrop().style).toEqual({
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })

  // a click bubbling up from the dialog is not a backdrop click
  dialog.props.backdrop().onClick({
    target: element('inside'),
    currentTarget: backdrop,
  })
  expect(dialog()).toBe(true)

  dialog.props.backdrop().onClick({ target: backdrop, currentTarget: backdrop })
  expect(dialog()).toBe(false)
  expect(dialog.interactedOutside()).toBe(true)
})

test('the backdrop respects hideOnInteractOutside', () => {
  const dialog = reatomDialog({ hideOnInteractOutside: false, name: 'd' })
  dialog.show()

  dialog.props.backdrop().onClick()
  expect(dialog()).toBe(true)

  dialog.hideOnInteractOutside.set(true)
  dialog.props.backdrop().onClick()
  expect(dialog()).toBe(false)
})

test('the dismiss record closes the dialog as a button', () => {
  const dialog = reatomDialog({ name: 'd' })
  dialog.show()

  expect(dialog.props.dismiss()).toMatchObject({
    'data-dialog-dismiss': '',
    type: 'button',
  })

  dialog.props.dismiss().onClick({ defaultPrevented: true })
  expect(dialog()).toBe(true)

  dialog.props.dismiss().onClick()
  expect(dialog()).toBe(false)
  expect(dialog.dismissIntent()).toBe('button')
  expect(dialog.interactedOutside()).toBe(false)
})

test('the focus-trap sentinels are inert until focus must be trapped', () => {
  const dialog = reatomDialog({ name: 'd' })

  expect(dialog.props.focusTrap()).toMatchObject({
    'data-focus-trap': 'd-content',
    tabIndex: 0,
    'aria-hidden': true,
    hidden: true,
    style: { position: 'fixed', top: 0, left: 0 },
  })

  dialog.show()
  expect(dialog.props.focusTrap().hidden).toBe(false)

  dialog.modal.set(false)
  expect(dialog.props.focusTrap().hidden).toBe(true)
})

test('a sentinel without a dialog element does nothing', () => {
  const dialog = reatomDialog({ name: 'd' })
  dialog.show()

  expect(() => dialog.props.focusTrap().onFocus()).not.toThrow()
})

test('withDialogProps names the records after the model', () => {
  const dialog = atom(false, 'my.flag')
    .extend(withDialog())
    .extend(withDialogProps())

  expect(dialog.props.content.name).toBe('my.flag.props.content')
  expect(dialog.props.disclosure.name).toBe('my.flag.props.disclosure')
  expect(dialog.props.backdrop.name).toBe('my.flag.props.backdrop')
  expect(dialog.props.dismiss.name).toBe('my.flag.props.dismiss')
  expect(dialog.props.heading.name).toBe('my.flag.props.heading')
  expect(dialog.props.description.name).toBe('my.flag.props.description')
  expect(dialog.props.focusTrap.name).toBe('my.flag.props.focusTrap')
})

test('alwaysVisible keeps the dialog rendered for exit animations', () => {
  const dialog = reatomDialog({ name: 'd' })
  const props = dialogProps(dialog, { alwaysVisible: true })

  expect(props.content()).toMatchObject({ hidden: false, style: undefined })
  expect(props.backdrop().hidden).toBe(false)
})

test('the model stays usable as a plain boolean atom', async () => {
  const dialog = reatomDialog({ name: 'd' })
  const seen: Array<boolean> = []
  const track = effect(() => void seen.push(dialog()), 'd.track')

  dialog.show()
  await null
  dialog.dismiss('escape')
  await null

  track.unsubscribe()
  expect(seen).toEqual([false, true, false])
})
