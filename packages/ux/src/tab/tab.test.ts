import { atom, context, effect, getCalls, notify } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import { mapTabPanelIntent, tabProps } from './props'
import type { Tab, TabPanelInit, TabPanelNode } from './reatomTab'
import { isSelectableTab, reatomTab } from './reatomTab'

beforeEach(() => context.reset())

/**
 * A fake element: Layer 1 never touches the DOM, but the roving tabindex
 * depends on whether a tab _has_ an element. The real DOM cases live in
 * `tab.test.browser.ts`.
 */
const element = () => ({}) as HTMLElement

/** Renders tabs with elements, which is what a mounted tab list looks like. */
const renderTabs = (tab: Tab, ...ids: Array<string>) =>
  ids.map((id) => tab.tabs.renderItem({ id, element: element() }))

/** Renders panels, in the DOM order their positional pairing relies on. */
const renderPanels = (
  tab: Tab,
  ...inits: Array<TabPanelInit>
): Array<TabPanelNode> =>
  inits.map((init) => tab.panels.renderItem({ element: element(), ...init }))

/**
 * A select or combobox host, reduced to the three atoms the tab model and its
 * prop records read — the structural option a real `reatomCombobox` satisfies
 * with `{ selectedValue, mounted: popover.mounted, virtualFocus }`.
 */
const reatomHost = (mounted = true) => ({
  selectedValue: atom<unknown>(undefined, 'host.selectedValue'),
  mounted: atom(mounted, 'host.mounted'),
  virtualFocus: atom(false, 'host.virtualFocus'),
})

/** Connects a model and returns the disposer, so connect hooks run. */
const connect = (tab: Tab) => {
  const unsubscribe = tab.subscribe(() => {})
  notify()
  return unsubscribe
}

/** The only two `FocusEvent` fields the composite prop records read. */
const focusEvent = (target: HTMLElement, currentTarget: HTMLElement) =>
  ({ target, currentTarget }) as unknown as FocusEvent

/** A cancellable key event for the panel navigation handler. */
const keyEvent = (key: string) => {
  let defaultPrevented = false
  return {
    key,
    get defaultPrevented() {
      return defaultPrevented
    },
    preventDefault: () => {
      defaultPrevented = true
    },
  } as unknown as KeyboardEvent & { defaultPrevented: boolean }
}

// --- pure helpers -----------------------------------------------------------

test('isSelectableTab refuses nothing, unknown tabs, and disabled ones', () => {
  const tab = reatomTab({ name: 'tab' })
  const [one] = renderTabs(tab, 'one')

  expect(isSelectableTab(one)).toBe(true)
  expect(isSelectableTab(null)).toBe(false)
  expect(isSelectableTab(undefined)).toBe(false)

  one!.disabled.set(true)
  expect(isSelectableTab(one)).toBe(false)
})

test('mapTabPanelIntent maps the four keys a panel forwards to the tab list', () => {
  expect(mapTabPanelIntent({ key: 'ArrowLeft' })).toEqual({ move: 'previous' })
  expect(mapTabPanelIntent({ key: 'ArrowRight' })).toEqual({ move: 'next' })
  expect(mapTabPanelIntent({ key: 'Home' })).toEqual({ move: 'first' })
  expect(mapTabPanelIntent({ key: 'End' })).toEqual({ move: 'last' })
  // Up / Down belong to the panel content, which is the whole point of the
  // horizontal-only mapping
  expect(mapTabPanelIntent({ key: 'ArrowDown' })).toBe(undefined)
  expect(mapTabPanelIntent({ key: 'a' })).toBe(undefined)
})

// --- defaults ---------------------------------------------------------------

test('a tab list is a horizontal, looping composite with two collections', () => {
  const tab = reatomTab({ name: 'tab' })

  expect(tab()).toBe(undefined)
  expect(tab.selectOnMove()).toBe(true)
  expect(tab.composite.orientation()).toBe('horizontal')
  expect(tab.composite.focusLoop()).toBe(true)
  // Ariakit pins this to `false` instead of the composite's `activeId === null`
  // rule, because a tab list hosted in a combobox may start with a null active id
  expect(tab.composite.includesBaseElement()).toBe(false)
  expect(tab.composite.id()).toBe('tab')
  // the tabs collection is the composite's own, not a copy
  expect(tab.tabs).toBe(tab.composite.items)
  expect(tab.panels.ids()).toEqual([])
  expect(tab.host).toBe(null)
})

test('every default stays overridable', () => {
  const tab = reatomTab({
    orientation: 'vertical',
    focusLoop: false,
    selectOnMove: false,
    includesBaseElement: true,
    id: 'custom',
    name: 'tab',
  })

  expect(tab.composite.orientation()).toBe('vertical')
  expect(tab.composite.focusLoop()).toBe(false)
  expect(tab.composite.includesBaseElement()).toBe(true)
  expect(tab.selectOnMove()).toBe(false)
  expect(tab.composite.id()).toBe('custom')
})

test('the tabs and panels options register without rendering', () => {
  const tab = reatomTab({
    tabs: [{ id: 'one' }, { id: 'two', disabled: true }],
    panels: [{ id: 'panel-one' }, { id: 'panel-two', tabId: 'two' }],
    name: 'tab',
  })

  expect(tab.tabs.ids()).toEqual(['one', 'two'])
  expect(tab.tabs.item('two')!.disabled()).toBe(true)
  expect(tab.panels.ids()).toEqual(['panel-one', 'panel-two'])
  // registered is not rendered: nothing is navigable, nothing is paired yet
  expect(tab.composite.navigationItems()).toEqual([])
  expect(tab()).toBe(undefined)
  expect(tab.panels.item('panel-two')!.tabId()).toBe('two')
  expect(tab.panels.item('panel-one')!.tabId()).toBe(undefined)
})

// --- selection seeding ------------------------------------------------------

test('the first enabled rendered tab becomes the selected and active one', () => {
  const tab = reatomTab({ name: 'tab' })
  renderTabs(tab, 'one', 'two', 'three')
  tab.tabs.item('one')!.disabled.set(true)

  expect(tab()).toBe('two')
  // the active tab follows the selected one, so `Tab` enters at the open tab
  expect(tab.composite()).toBe('two')
  expect(tab.selectedTab()).toBe(tab.tabs.item('two'))
  expect(tab.tabs.item('two')!.tabbable()).toBe(true)
  expect(tab.tabs.item('three')!.tabbable()).toBe(false)
})

test('an initial selectedId wins and pulls the active tab to it', () => {
  const tab = reatomTab({ selectedId: 'two', name: 'tab' })

  expect(tab()).toBe('two')
  // nothing is rendered yet, so there is no element to hold the tab stop
  expect(tab.composite()).toBe(undefined)

  renderTabs(tab, 'one', 'two')

  expect(tab()).toBe('two')
  expect(tab.composite()).toBe('two')
})

test('an unrendered selected tab leaves the composite seed alone', () => {
  const tab = reatomTab({ selectedId: 'three', name: 'tab' })
  renderTabs(tab, 'one', 'two')

  // only a rendered tab can hold the tab stop
  expect(tab.composite()).toBe('one')

  renderTabs(tab, 'three')
  expect(tab.composite()).toBe('three')
})

test('writing the model selects without any guard, and the active tab follows', () => {
  const tab = reatomTab({ selectOnMove: false, name: 'tab' })
  renderTabs(tab, 'one', 'two', 'three')
  tab.tabs.item('three')!.disabled.set(true)

  expect(tab()).toBe('one')

  // an unguarded write, which is what a route or a form field does
  tab.set('three')
  expect(tab()).toBe('three')
  expect(tab.composite()).toBe('three')

  // and the active tab stays writable: with `selectOnMove` off, arrow keys move
  // focus without changing the selection
  tab.composite.move(tab.composite.previous())
  expect(tab.composite()).toBe('two')
  expect(tab()).toBe('three')
})

test('selecting nothing keeps the panels closed', () => {
  const tab = reatomTab({ selectedId: null, name: 'tab' })
  const [, panel] = renderPanels(tab, { id: 'p1' }, { id: 'p2' })
  renderTabs(tab, 'one', 'two')

  expect(tab()).toBe(null)
  expect(tab.composite()).toBe(null)
  expect(panel!.selected()).toBe(false)
})

// --- selectOnMove -----------------------------------------------------------

test('moving the active tab selects it, a silent write does not', () => {
  const tab = reatomTab({ name: 'tab' })
  renderTabs(tab, 'one', 'two', 'three')

  tab.composite.move(tab.composite.next())
  expect(tab.composite()).toBe('two')
  expect(tab()).toBe('two')

  // Ariakit's `setActiveId`: activate without selecting
  tab.composite.set('three')
  expect(tab()).toBe('two')
})

test('selectOnMove: false separates focus from selection', () => {
  const tab = reatomTab({ selectOnMove: false, name: 'tab' })
  renderTabs(tab, 'one', 'two')

  tab.composite.move(tab.composite.next())
  expect(tab.composite()).toBe('two')
  expect(tab()).toBe('one')

  tab.selectOnMove.set(true)
  tab.composite.move(tab.composite.previous())
  expect(tab()).toBe('one')
})

test('a move onto a disabled tab or to nowhere selects nothing', () => {
  const tab = reatomTab({ name: 'tab' })
  renderTabs(tab, 'one', 'two')
  tab.tabs.item('two')!.disabled.set(true)

  // navigation skips it, but a direct move can still land there
  expect(tab.composite.next()).toBe(undefined)
  tab.composite.move('two')
  expect(tab.composite()).toBe('two')
  expect(tab()).toBe('one')

  tab.composite.move(undefined)
  expect(tab.composite()).toBe('two')
  expect(tab()).toBe('one')
})

// --- select -----------------------------------------------------------------

test('select sets the selection and moves the active tab as an event', async () => {
  const tab = reatomTab({ name: 'tab' })
  renderTabs(tab, 'one', 'two')
  const moves: Array<string | null | undefined> = []

  const track = effect(() => {
    for (const call of getCalls(tab.composite.move)) moves.push(call.params[0])
  }, 'moves')
  const unsubscribe = track.subscribe(() => {})

  expect(tab.select('two')).toBe('two')
  await null

  expect(tab()).toBe('two')
  expect(tab.composite()).toBe('two')
  // the move is what `withCompositeFocus()` observes to move real DOM focus
  expect(moves).toEqual(['two'])

  unsubscribe()
})

test('select refuses a disabled tab and swallows "nowhere to go"', () => {
  const tab = reatomTab({ name: 'tab' })
  renderTabs(tab, 'one', 'two')
  tab.tabs.item('two')!.disabled.set(true)

  expect(tab.select('two')).toBe('one')
  expect(tab()).toBe('one')

  // the return value of a navigation query that found nowhere to go
  expect(tab.select(undefined)).toBe('one')
  expect(tab()).toBe('one')

  // an unknown id is not refused: a tab may be selected before it registers
  expect(tab.select('four')).toBe('four')
  expect(tab()).toBe('four')
})

// --- panels -----------------------------------------------------------------

test('panels pair with tabs by render order', () => {
  const tab = reatomTab({ name: 'tab' })
  const [first, second] = renderPanels(tab, { id: 'p1' }, { id: 'p2' })
  renderTabs(tab, 'one', 'two')

  expect(first!.tabId()).toBe('one')
  expect(second!.tabId()).toBe('two')
  expect(first!.selected()).toBe(true)
  expect(second!.selected()).toBe(false)

  tab.select('two')
  expect(first!.selected()).toBe(false)
  expect(second!.selected()).toBe(true)

  expect(tab.panelFor('two')).toBe(second)
  expect(tab.panelFor('unknown')).toBe(null)
  expect(tab.panelFor(null)).toBe(null)
})

test('an explicit tabId wins over the position and stays writable', () => {
  const tab = reatomTab({ name: 'tab' })
  const [first, second] = renderPanels(
    tab,
    { id: 'p1', tabId: 'two' },
    { id: 'p2' },
  )
  renderTabs(tab, 'one', 'two')

  expect(first!.ownTabId()).toBe('two')
  expect(first!.tabId()).toBe('two')
  // the positional fallback counts panels, not orphans, exactly like Ariakit
  expect(second!.tabId()).toBe('two')

  second!.ownTabId.set('one')
  expect(second!.tabId()).toBe('one')
  expect(tab.panelFor('one')).toBe(second)
})

test('a re-registration patches the panel instead of duplicating it', () => {
  const tab = reatomTab({ name: 'tab' })
  const [panel] = renderPanels(tab, { id: 'p1' })

  expect(tab.panels.renderItem({ id: 'p1', tabId: 'two' })).toBe(panel)
  expect(tab.panels.ids()).toEqual(['p1'])
  expect(panel!.ownTabId()).toBe('two')
})

test('an unrendered panel has no tab, and unknown ids never throw', () => {
  const tab = reatomTab({ name: 'tab' })
  renderTabs(tab, 'one')
  const panel = tab.panels.registerItem({ id: 'p1' })

  expect(panel.tabId()).toBe(undefined)
  expect(panel.selected()).toBe(false)
  expect(tab.panels.item('nope')).toBe(null)

  tab.panels.renderItem({ id: 'p1' })
  expect(panel.tabId()).toBe('one')
})

// --- preserve and restore ---------------------------------------------------

test('a host value selection preserves the selected tab across a remount', () => {
  const host = reatomHost()
  const tab = reatomTab({ host, name: 'tab' })
  renderTabs(tab, 'one', 'two')
  const unsubscribe = connect(tab)

  // connecting preserves the current selection, like Ariakit's setup-time backup
  expect(tab.preservedSelectedId()).toBe('one')

  tab.select('two')
  // the user picks a value inside the panel of the second tab
  host.selectedValue.set('apple')
  notify()
  expect(tab.preservedSelectedId()).toBe('two')

  // the popup closes and takes the tab content with it
  host.mounted.set(false)
  notify()
  tab.tabs.unrenderItem('one')
  tab.tabs.unrenderItem('two')
  tab.set(undefined)

  // the content mounts again, and the seed lands on the first tab
  renderTabs(tab, 'one', 'two')
  expect(tab()).toBe('one')

  // and the popup opens again
  host.mounted.set(true)
  notify()

  expect(tab()).toBe('two')
  unsubscribe()
})

test('restoring the selection does not move the active tab', () => {
  const host = reatomHost()
  const tab = reatomTab({ host, name: 'tab' })
  renderTabs(tab, 'one', 'two', 'three')
  const unsubscribe = connect(tab)

  tab.select('three')
  host.selectedValue.set('apple')
  notify()

  tab.select('one')
  expect(tab.composite()).toBe('one')

  // the restore is a selection change only — Ariakit needs a mutable
  // `syncActiveId` flag for this, we write the active tab back explicitly
  expect(tab.restoreSelectedId()).toBe('three')
  expect(tab()).toBe('three')
  expect(tab.composite()).toBe('one')

  unsubscribe()
})

test('connecting a hosted tab list does not restore anything', () => {
  const host = reatomHost()
  const tab = reatomTab({ selectedId: 'two', host, name: 'tab' })
  renderTabs(tab, 'one', 'two')
  const unsubscribe = connect(tab)

  // Ariakit's initial `sync` pair backs up and then restores the same value;
  // `ifChanged` skips the first run instead of writing it back
  expect(tab()).toBe('two')
  expect(tab.composite()).toBe('two')

  unsubscribe()
})

test('preserve and restore work without a host, and restore before a preserve re-seeds', () => {
  const tab = reatomTab({ name: 'tab' })
  renderTabs(tab, 'one', 'two')

  tab.select('two')
  expect(tab.preserveSelectedId()).toBe('two')
  tab.select('one')
  expect(tab.restoreSelectedId()).toBe('two')
  expect(tab()).toBe('two')

  tab.preservedSelectedId.set(undefined)
  tab.restoreSelectedId()
  // nothing preserved means "not decided yet"; like the composite's own active
  // id, the seed lands again on the next render instead of immediately
  expect(tab()).toBe(undefined)
  renderTabs(tab, 'three')
  expect(tab()).toBe('one')
})

// --- prop records -----------------------------------------------------------

test('the tab list record is the composite base plus the tablist ARIA', () => {
  const tab = reatomTab({ labelledBy: 'heading', name: 'tab' })
  renderTabs(tab, 'one')

  expect(tab.props.list()).toMatchObject({
    id: 'tab',
    role: 'tablist',
    'aria-orientation': 'horizontal',
    'aria-labelledby': 'heading',
    // the roving tabindex belongs to the tabs
    tabIndex: undefined,
  })

  tab.composite.orientation.set('both')
  // 'both' has no ARIA counterpart
  expect(tab.props.list()['aria-orientation']).toBe(undefined)
})

test('a tab record carries the roles, the panel link, and the roving tabindex', () => {
  const tab = reatomTab({ name: 'tab' })
  const [one, two] = renderTabs(tab, 'one', 'two')
  const [panel] = renderPanels(tab, { id: 'p1' }, { id: 'p2' })

  expect(tab.props.tab(one!)()).toMatchObject({
    id: 'one',
    role: 'tab',
    'aria-selected': true,
    'aria-controls': 'p1',
    'aria-disabled': undefined,
    'data-active-item': true,
    tabIndex: undefined,
  })
  expect(tab.props.tab(two!)()).toMatchObject({
    'aria-selected': false,
    'aria-controls': 'p2',
    tabIndex: -1,
  })

  two!.disabled.set(true)
  expect(tab.props.tab(two!)()['aria-disabled']).toBe('true')
  // the record is memoized per tab
  expect(tab.props.tab(one!)).toBe(tab.props.tab(one!))
  expect(panel!.tabId()).toBe('one')
})

test('clicking a tab selects it without moving the active tab', async () => {
  const tab = reatomTab({ name: 'tab' })
  const [one, two] = renderTabs(tab, 'one', 'two')
  const moves: Array<unknown> = []

  const track = effect(() => {
    for (const call of getCalls(tab.composite.move)) moves.push(call.params[0])
  }, 'moves')
  const unsubscribe = track.subscribe(() => {})

  // a click has already put DOM focus on the tab, so Ariakit only sets the
  // selection — the active tab follows through the derivation
  tab.props.tab(two!)().onClick()
  await null

  expect(tab()).toBe('two')
  expect(tab.composite()).toBe('two')
  expect(moves).toEqual([])

  // a disabled tab refuses the click, and cancels it like Ariakit's `Focusable`
  one!.disabled.set(true)
  let prevented = false
  tab.props
    .tab(one!)()
    .onClick({
      preventDefault: () => {
        prevented = true
      },
      stopPropagation: () => {},
    })
  expect(prevented).toBe(true)
  expect(tab()).toBe('two')

  unsubscribe()
})

test('focusing a tab activates it without selecting it', () => {
  const tab = reatomTab({ name: 'tab' })
  const [, two] = renderTabs(tab, 'one', 'two')
  const target = element()

  // the composite item handler is inherited unchanged: focus activates
  tab.props.tab(two!)().onFocus(focusEvent(target, target))

  expect(tab.composite()).toBe('two')
  // a focus is not a move, so the selection is Ariakit's click / arrow path
  expect(tab()).toBe('one')
})

test('a panel record hides itself while its tab is not selected', () => {
  const tab = reatomTab({ name: 'tab' })
  const [first, second] = renderPanels(tab, { id: 'p1' }, { id: 'p2' })
  renderTabs(tab, 'one', 'two')

  expect(tab.props.panel(first!)()).toMatchObject({
    id: 'p1',
    role: 'tabpanel',
    'aria-labelledby': 'one',
    hidden: false,
    style: undefined,
    tabIndex: 0,
  })
  expect(tab.props.panel(second!)()).toMatchObject({
    hidden: true,
    // the attribute alone loses to a `display` rule, so Ariakit pairs them
    style: { display: 'none' },
  })

  tab.select('two')
  expect(tab.props.panel(first!)().hidden).toBe(true)
  expect(tab.props.panel(second!)().hidden).toBe(false)

  const target = element()
  tab.props.panel(first!)().ref(target)
  expect(first!.element()).toBe(target)
  tab.props.panel(first!)().ref(null)
  expect(first!.element()).toBe(null)
})

test('panel keys switch tabs only for a hosted tab list', () => {
  const tab = reatomTab({ name: 'tab' })
  const [panel] = renderPanels(tab, { id: 'p1' })
  renderTabs(tab, 'one', 'two', 'three')

  // a standalone panel leaves the arrow keys to its content
  const ignored = keyEvent('ArrowRight')
  tab.props.panel(panel!)().onKeyDown(ignored)
  expect(ignored.defaultPrevented).toBe(false)
  expect(tab()).toBe('one')

  const hosted = tabProps(tab, { panelNavigation: true, name: 'hosted' })
  const event = keyEvent('ArrowRight')
  hosted.panel(panel!)().onKeyDown(event)

  expect(event.defaultPrevented).toBe(true)
  // navigation starts at the selected tab, not at the active item inside the panel
  expect(tab()).toBe('two')
  expect(tab.composite()).toBe('two')

  const end = keyEvent('End')
  hosted.panel(panel!)().onKeyDown(end)
  expect(tab()).toBe('three')

  const nowhere = keyEvent('ArrowRight')
  tab.composite.focusLoop.set(false)
  hosted.panel(panel!)().onKeyDown(nowhere)
  expect(nowhere.defaultPrevented).toBe(false)
  expect(tab()).toBe('three')
})

test('a host with virtual focus keeps the tabs out of the tab order', () => {
  const host = reatomHost()
  const tab = reatomTab({ host, name: 'tab' })
  const [one] = renderTabs(tab, 'one', 'two')

  expect(tab.props.tab(one!)().tabIndex).toBe(undefined)
  // Ariakit: a tab inside a composite with virtual focus must not be tabbable,
  // otherwise focus is trapped in the host widget
  host.virtualFocus.set(true)
  expect(tab.props.tab(one!)().tabIndex).toBe(-1)
  // the panels of a hosted tab list are not focusable either
  const [panel] = renderPanels(tab, { id: 'p1' })
  expect(tab.props.panel(panel!)().tabIndex).toBe(undefined)
})

test('the prop record options stay overridable per record', () => {
  const tab = reatomTab({ name: 'tab' })
  const [one] = renderTabs(tab, 'one')
  const [panel] = renderPanels(tab, { id: 'p1' })

  // a fresh, uncached record, like the composite item records
  const forced = tab.props.tab(one!, { tabbable: true })
  expect(forced).not.toBe(tab.props.tab(one!))
  expect(forced().tabIndex).toBe(undefined)

  expect(tab.props.panel(panel!, { focusable: false })().tabIndex).toBe(
    undefined,
  )
  expect(tab.props.panel(panel!, { labelledBy: 'heading' })()).toMatchObject({
    'aria-labelledby': 'heading',
  })
})

// --- names ------------------------------------------------------------------

test('every unit is named after the model', () => {
  const tab = reatomTab({ name: 'settings' })
  const [one] = renderTabs(tab, 'one')
  const [panel] = renderPanels(tab, { id: 'p1' })

  expect(tab.name).toBe('settings')
  expect(tab.composite.name).toBe('settings.composite')
  expect(tab.tabs.name).toBe('settings.composite.items')
  expect(tab.panels.name).toBe('settings.panels')
  expect(tab.selectOnMove.name).toBe('settings.selectOnMove')
  expect(tab.select.name).toBe('settings.select')
  expect(tab.preservedSelectedId.name).toBe('settings.preservedSelectedId')
  expect(tab.restoreSelectedId.name).toBe('settings.restoreSelectedId')
  expect(panel!.name).toBe('settings.panels#p1')
  expect(panel!.tabId.name).toBe('settings.panels#p1.tabId')
  expect(tab.props.list.name).toBe('settings.props.tablist')
  expect(tab.props.tab(one!).name).toBe(
    'settings.composite.items#one.props.tab',
  )
  expect(tab.props.panel(panel!).name).toBe('settings.panels#p1.props.tabpanel')
})
