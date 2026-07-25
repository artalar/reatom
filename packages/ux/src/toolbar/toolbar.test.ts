import { context } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import { reatomComposite } from '../composite/reatomComposite'
import {
  toolbarAriaOrientation,
  toolbarProps,
  toolbarSeparatorOrientation,
  withToolbarProps,
} from './props'
import { reatomToolbar } from './reatomToolbar'

beforeEach(() => context.reset())

/**
 * A fake element: Layer 1 and the prop records never touch the DOM, they only
 * care whether an item _has_ an element. The real DOM cases live in the
 * composite browser tests, since a toolbar item is a composite item.
 */
const element = () => ({}) as HTMLElement

/** Renders items with elements, which is what a mounted toolbar looks like. */
const render = (
  toolbar: ReturnType<typeof reatomToolbar>,
  ...items: Array<Parameters<typeof toolbar.items.renderItem>[0]>
) =>
  items.map((init) => toolbar.items.renderItem({ element: element(), ...init }))

// --- defaults ---------------------------------------------------------------

test('a toolbar is a horizontal, looping composite', () => {
  const toolbar = reatomToolbar({ name: 'defaults' })

  expect(toolbar.orientation()).toBe('horizontal')
  expect(toolbar.focusLoop()).toBe(true)

  // the two defaults above are the whole toolbar store; everything else stays
  // at the composite defaults
  expect(toolbar.virtualFocus()).toBe(false)
  expect(toolbar.rtl()).toBe(false)
  expect(toolbar.focusWrap()).toBe(false)
  expect(toolbar.focusShift()).toBe(false)
  expect(toolbar.includesBaseElement()).toBe(false)
})

test('the composite behavior is the toolbar behavior', () => {
  const toolbar = reatomToolbar({ name: 'behavior' })
  render(
    toolbar,
    { id: 'bold' },
    { id: 'italic', disabled: true },
    { id: 'link' },
  )

  // auto-seeded by the composite, disabled items are skipped
  expect(toolbar()).toBe('bold')
  expect(toolbar.next()).toBe('link')

  toolbar.move(toolbar.next())
  expect(toolbar()).toBe('link')
  // the looping default: the last item wraps to the first one
  expect(toolbar.next()).toBe('bold')
  expect(toolbar.previous()).toBe('bold')
  expect(toolbar.first()).toBe('bold')
  expect(toolbar.last()).toBe('link')
})

test('both toolbar defaults are plain options', () => {
  const toolbar = reatomToolbar({
    orientation: 'vertical',
    focusLoop: false,
    rtl: true,
    name: 'options',
  })
  render(toolbar, { id: 'a' }, { id: 'b' })

  expect(toolbar.orientation()).toBe('vertical')
  expect(toolbar.focusLoop()).toBe(false)
  expect(toolbar.rtl()).toBe(true)

  // rtl flips the item list, so `next` walks it backwards
  expect(toolbar()).toBe('a')
  expect(toolbar.next()).toBe(undefined)
  expect(toolbar.previous()).toBe('b')
})

test('an orientation of both keeps all four arrow keys, as a composite', () => {
  const toolbar = reatomToolbar({ orientation: 'both', name: 'both' })
  expect(toolbar.orientation()).toBe('both')
})

// --- prop records -----------------------------------------------------------

test('the base record is the composite one plus the toolbar role', () => {
  const toolbar = reatomToolbar({ name: 'baseProps' })
  render(toolbar, { id: 'a' })

  expect(toolbar.props.base()).toMatchObject({
    role: 'toolbar',
    'aria-orientation': 'horizontal',
    // the composite half of the record is untouched
    id: 'baseProps',
    'aria-activedescendant': undefined,
    tabIndex: undefined,
  })
  expect(toolbar.props.base.name).toBe('baseProps.props.base')

  toolbar.virtualFocus.set(true)
  expect(toolbar.props.base()).toMatchObject({
    role: 'toolbar',
    'aria-activedescendant': 'a',
    tabIndex: 0,
  })
})

test('aria-orientation follows the orientation atom, and both means no attribute', () => {
  const toolbar = reatomToolbar({ name: 'ariaOrientation' })

  expect(toolbar.props.base()['aria-orientation']).toBe('horizontal')

  toolbar.orientation.set('vertical')
  expect(toolbar.props.base()['aria-orientation']).toBe('vertical')

  // "both" is not an ARIA value: the attribute is dropped, like Ariakit does
  toolbar.orientation.set('both')
  expect(toolbar.props.base()['aria-orientation']).toBe(undefined)
})

test('the base record keeps the composite element wiring and key entry', () => {
  const toolbar = reatomToolbar({ name: 'wiring' })
  render(toolbar, { id: 'a' }, { id: 'b' })
  const container = element()
  const props = toolbar.props.base()

  props.ref(container)
  expect(toolbar.baseElement()).toBe(container)

  props.onFocus({
    target: container,
    currentTarget: container,
  } as unknown as FocusEvent)
  expect(toolbar()).toBe(null)

  let prevented = 0
  const keyDown = (key: string) =>
    props.onKeyDown({
      key,
      target: container,
      currentTarget: container,
      preventDefault: () => prevented++,
    } as unknown as KeyboardEvent)

  // a horizontal toolbar enters on the horizontal arrows only
  keyDown('ArrowRight')
  expect(toolbar()).toBe('a')
  expect(prevented).toBe(1)

  toolbar.set(null)
  keyDown('ArrowDown')
  expect(toolbar()).toBe(null)
  expect(prevented).toBe(1)

  keyDown('ArrowLeft')
  expect(toolbar()).toBe('b')
  expect(prevented).toBe(2)
})

test('the separator record is perpendicular to the toolbar', () => {
  const toolbar = reatomToolbar({ name: 'separator' })

  expect(toolbar.props.separator()).toEqual({
    role: 'separator',
    'aria-orientation': 'vertical',
  })
  expect(toolbar.props.separator.name).toBe('separator.props.separator')

  toolbar.orientation.set('vertical')
  expect(toolbar.props.separator()['aria-orientation']).toBe('horizontal')

  // a two-dimensional composite has no axis to be perpendicular to, and
  // Ariakit falls back to a horizontal rule
  toolbar.orientation.set('both')
  expect(toolbar.props.separator()['aria-orientation']).toBe('horizontal')
})

test('a toolbar item is a composite item, record included', () => {
  const toolbar = reatomToolbar({ name: 'itemProps' })
  const [a, b] = render(toolbar, { id: 'a' }, { id: 'b' })
  const props = toolbar.props.item(a!)

  expect(props()).toMatchObject({
    id: 'a',
    'data-active-item': true,
    tabIndex: undefined,
  })
  expect(props.name).toBe('itemProps.items#a.props')
  // the roving tabindex: only the active item is in the tab order
  expect(toolbar.props.item(b!)()).toMatchObject({
    'data-active-item': undefined,
    tabIndex: -1,
  })

  // memoized per item, and options opt out of the cache
  expect(toolbar.props.item(a!)).toBe(props)
  expect(toolbar.props.item(b!, { tabbable: true })).not.toBe(
    toolbar.props.item(b!),
  )

  props().onKeyDown({
    key: 'ArrowRight',
    target: a!.element(),
    currentTarget: a!.element(),
    preventDefault: () => {},
  } as unknown as KeyboardEvent)
  expect(toolbar()).toBe('b')
})

test('toolbarProps upgrades any composite model, without a toolbar factory', () => {
  const composite = reatomComposite({ orientation: 'vertical', name: 'plain' })
  const props = toolbarProps(composite, { name: 'plain.toolbar' })

  expect(props.base()).toMatchObject({
    role: 'toolbar',
    'aria-orientation': 'vertical',
    id: 'plain',
  })
  expect(props.base.name).toBe('plain.toolbar.props.base')
  expect(props.separator()['aria-orientation']).toBe('horizontal')
  // the composite records are carried over as they are
  expect(typeof props.item).toBe('function')
})

test('withToolbarProps upgrades the composite records in place', () => {
  const composite = reatomComposite({ name: 'upgraded' })
  const item = composite.items.renderItem({ id: 'a', element: element() })
  const itemRecord = composite.props.item(item)

  const toolbar = composite.extend(withToolbarProps())

  // the model is the same atom, and the records are the same object
  expect(toolbar).toBe(composite)
  expect(toolbar.props).toBe(composite.props)
  expect(toolbar.props.base()).toMatchObject({
    role: 'toolbar',
    id: 'upgraded',
  })
  // the memoized item records keep their identity, so an adapter that attached
  // their handlers before the upgrade is unaffected
  expect(toolbar.props.item(item)).toBe(itemRecord)
})

// --- pure helpers -----------------------------------------------------------

test('the orientation helpers are pure and total', () => {
  expect(toolbarAriaOrientation('horizontal')).toBe('horizontal')
  expect(toolbarAriaOrientation('vertical')).toBe('vertical')
  expect(toolbarAriaOrientation('both')).toBe(undefined)

  expect(toolbarSeparatorOrientation('horizontal')).toBe('vertical')
  expect(toolbarSeparatorOrientation('vertical')).toBe('horizontal')
  expect(toolbarSeparatorOrientation('both')).toBe('horizontal')
})

// --- naming -----------------------------------------------------------------

test('units are named after the model, with a toolbar default', () => {
  const toolbar = reatomToolbar({ name: 'editor.toolbar' })
  const [bold] = render(toolbar, { id: 'bold' })

  expect(toolbar.name).toBe('editor.toolbar')
  expect(toolbar.items.name).toBe('editor.toolbar.items')
  expect(bold!.name).toBe('editor.toolbar.items#bold')
  expect(toolbar.move.name).toBe('editor.toolbar.move')
  expect(toolbar.id()).toBe('editor-toolbar')

  expect(reatomToolbar().name).toMatch(/^toolbar#\d+$/)
})
