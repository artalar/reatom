import type { Computed } from '@reatom/core'
import { atom, context, notify, wrap } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { withCompositeFocus } from '../composite/reatomCompositeDom'
import type { Tab, TabHost } from './reatomTab'
import { reatomTab } from './reatomTab'
import { withTabFocus } from './reatomTabDom'

/**
 * Only the quirks that need a real element live here (`PORTING_PLAN.md` §3,
 * bucket B): the roving tab stop with real focus, a click that does not focus
 * the tab it selects, arrow keys bubbling out of a hosted panel, and the
 * `hidden` / `display` pair that actually hides a panel. The transitions,
 * guards, and prop-record contents are covered by `tab.test.ts` in Node.
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

/** Flushes the notification and the microtask the focus is deferred by. */
const settle = async () => {
  notify()
  await null
}

/** ARIA and `data-*` are attributes; everything else is a DOM property. */
const isAttribute = (key: string) =>
  key === 'role' || key.startsWith('aria-') || key.startsWith('data-')

/**
 * The minimal view adapter: a reactive prop record applied to a real element.
 * `@reatom/jsx` does this with `$spread` and React with a plain spread; the
 * test does it by hand so the package keeps no view dependency.
 */
const spread = (
  element: HTMLElement,
  props: Computed<Record<string, any>>,
): void => {
  const record = props()
  record.ref(element)

  // Handlers keep a stable identity across records, so they are attached once.
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('on')) {
      element.addEventListener(key.slice(2).toLowerCase(), value)
    }
  }

  const unsubscribe = props.subscribe((next) => {
    for (const [key, value] of Object.entries(next)) {
      if (key === 'ref' || key.startsWith('on')) continue
      if (key === 'style') {
        element.style.display = value?.display ?? ''
      } else if (isAttribute(key)) {
        if (value == null) element.removeAttribute(key)
        else element.setAttribute(key, String(value))
      } else if (value == null) {
        element.removeAttribute(key === 'tabIndex' ? 'tabindex' : key)
      } else {
        Object.assign(element, { [key]: value })
      }
    }
  })

  cleanups.push(unsubscribe)
}

/** Mounts a tab widget: a tab list of buttons plus one panel per tab. */
const mount = async (
  tab: Tab,
  ids: Array<string>,
): Promise<{
  tabs: Array<HTMLButtonElement>
  panels: Array<HTMLDivElement>
}> => {
  spread(container, tab.props.list)

  const tabs = ids.map((id) => {
    const button = document.createElement('button')
    button.textContent = id
    container.append(button)
    spread(button, tab.props.tab(tab.tabs.renderItem({ id })))
    return button
  })

  // The panels are registered in DOM order, which is what pairs them with the
  // tabs at the same position.
  const panels = ids.map((id) => {
    const panel = document.createElement('div')
    document.body.append(panel)
    cleanups.push(() => panel.remove())
    spread(panel, tab.props.panel(tab.panels.renderItem({ id: `${id}-panel` })))
    return panel
  })

  await settle()
  return { tabs, panels }
}

const press = async (element: HTMLElement, key: string) => {
  element.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  )
  await settle()
}

const tabIndexes = (tabs: Array<HTMLElement>) => tabs.map((tab) => tab.tabIndex)

const visible = (panels: Array<HTMLElement>) =>
  panels.map(
    (panel) => !panel.hidden && getComputedStyle(panel).display !== 'none',
  )

// Ariakit: the tab list is a composite, so the roving tabindex applies — and the
// selected tab is the one that holds the tab stop, because `activeId` follows
// `selectedId`.
test('the selected tab holds the tab stop, and arrow keys move focus and the panel', async () => {
  const tab = reatomTab({ name: 'tab' })
  tab.composite.extend(withCompositeFocus())
  const { tabs, panels } = await mount(tab, ['one', 'two', 'three'])

  expect(tabs[0]!.hasAttribute('tabindex')).toBe(false)
  expect(tabIndexes(tabs)).toEqual([0, -1, -1])
  expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
  expect(tabs[0]!.getAttribute('aria-controls')).toBe('one-panel')
  expect(panels[0]!.getAttribute('aria-labelledby')).toBe('one')
  expect(visible(panels)).toEqual([true, false, false])

  tabs[0]!.focus()
  await settle()
  expect(document.activeElement).toBe(tabs[0])

  await press(tabs[0]!, 'ArrowRight')

  // selection follows focus: real DOM focus moved, and so did the visible panel
  expect(document.activeElement).toBe(tabs[1])
  expect(tab()).toBe('two')
  expect(tabIndexes(tabs)).toEqual([-1, 0, -1])
  expect(visible(panels)).toEqual([false, true, false])
  expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')

  // a tab list loops, unlike a plain composite
  await press(tabs[1]!, 'End')
  await press(tabs[2]!, 'ArrowRight')
  expect(document.activeElement).toBe(tabs[0])
  expect(tab()).toBe('one')
})

// Neither `element.click()` nor a Safari mousedown focuses a button, which is
// why the tab stop follows the selection rather than the focus.
test('clicking a tab shows its panel and hands it the tab stop without focus', async () => {
  const tab = reatomTab({ name: 'tab' })
  const { tabs, panels } = await mount(tab, ['one', 'two'])

  tabs[1]!.click()
  await settle()

  expect(tab()).toBe('two')
  expect(tab.composite()).toBe('two')
  expect(document.activeElement).not.toBe(tabs[1])
  expect(tabIndexes(tabs)).toEqual([-1, 0])
  expect(visible(panels)).toEqual([false, true])
})

// Ariakit keeps a disabled tab focusable (`accessibleWhenDisabled`); this port
// maps it to the composite's `disabled`, so navigation skips it while it stays
// in the DOM and announces itself.
test('a disabled tab is skipped by the arrow keys but stays in the tab list', async () => {
  const tab = reatomTab({ name: 'tab' })
  tab.composite.extend(withCompositeFocus())
  const { tabs, panels } = await mount(tab, ['one', 'two', 'three'])

  tab.tabs.item('two')!.disabled.set(true)
  await settle()

  expect(tabs[1]!.getAttribute('aria-disabled')).toBe('true')
  // never the native attribute: a disabled tab must stay reachable for a screen
  // reader
  expect(tabs[1]!.hasAttribute('disabled')).toBe(false)

  tabs[0]!.focus()
  await settle()
  await press(tabs[0]!, 'ArrowRight')

  expect(document.activeElement).toBe(tabs[2])
  expect(tab()).toBe('three')
  expect(visible(panels)).toEqual([false, false, true])
})

// react-components 0.1.2 / ariakit#4213: the tab stop follows the selection on
// its own, but a tab stop is not focus — without `withTabFocus()` DOM focus
// stays on a tab that is no longer tabbable, and the next arrow key starts from
// the wrong tab.
test('a controlled selection moves DOM focus off the tab that had it', async () => {
  const tab = reatomTab({ name: 'tab' }).extend(withTabFocus())
  tab.composite.extend(withCompositeFocus())
  const { tabs, panels } = await mount(tab, ['one', 'two', 'three'])

  tabs[0]!.focus()
  await settle()
  expect(document.activeElement).toBe(tabs[0])

  // what a route change, a shortcut, or a `setSelectedId` from a parent does
  tab.set('three')
  await settle()
  await settle()

  expect(document.activeElement).toBe(tabs[2])
  expect(tabIndexes(tabs)).toEqual([-1, -1, 0])
  expect(visible(panels)).toEqual([false, false, true])

  // and the arrow keys continue from where focus landed
  await press(tabs[2]!, 'ArrowRight')
  expect(document.activeElement).toBe(tabs[0])
  expect(tab()).toBe('one')
})

// Focus is only ever taken over, never taken away: the three cases Ariakit's own
// sandbox test pins down (`app/src/sandbox/tab-4213/test-browser.ts`).
test('a controlled selection keeps focus outside the tab list where it is', async () => {
  const tab = reatomTab({ name: 'tab' }).extend(withTabFocus())
  tab.composite.extend(withCompositeFocus())
  const { tabs, panels } = await mount(tab, ['one', 'two', 'three'])

  const button = document.createElement('button')
  button.textContent = 'select the third tab'
  container.after(button)
  cleanups.push(() => button.remove())
  button.addEventListener(
    'click',
    wrap(() => tab.set('three')),
  )

  button.focus()
  button.click()
  await settle()
  await settle()

  // the button keeps focus, and the tab stop still moved
  expect(document.activeElement).toBe(button)
  expect(tabIndexes(tabs)).toEqual([-1, -1, 0])

  // a field inside a panel keeps the caret too
  const field = document.createElement('input')
  panels[2]!.append(field)
  field.focus()
  tab.set('one')
  await settle()
  await settle()

  expect(document.activeElement).toBe(field)

  // and a disabled tab never takes focus, even from a tab that has it
  tab.tabs.item('two')!.disabled.set(true)
  tabs[0]!.focus()
  await settle()
  tab.set('two')
  await settle()
  await settle()

  expect(document.activeElement).toBe(tabs[0])
  expect(tab()).toBe('two')
})

// Ariakit binds ArrowLeft / ArrowRight / Home / End on the panel of a hosted tab
// list, so a key pressed on the content inside it still switches tabs.
test('arrow keys bubbling out of a hosted panel switch tabs', async () => {
  const virtualFocus = atom(false, 'host.virtualFocus')
  const host: TabHost = {
    selectedValue: atom<unknown>(undefined, 'host.selectedValue'),
    mounted: atom(true, 'host.mounted'),
    virtualFocus,
  }
  const tab = reatomTab({ host, name: 'hosted' })
  const { tabs, panels } = await mount(tab, ['one', 'two'])

  // a hosted panel is not focusable itself, and the host owns the tab stop
  expect(panels[0]!.hasAttribute('tabindex')).toBe(false)
  expect(container.hasAttribute('tabindex')).toBe(false)

  const option = document.createElement('input')
  panels[0]!.append(option)
  option.focus()

  await press(option, 'ArrowRight')

  expect(tab()).toBe('two')
  expect(visible(panels)).toEqual([false, true])
  // the key was consumed by the tab list, not by the input
  expect(document.activeElement).toBe(option)

  // with virtual focus in the host, no tab may hold a tab stop of its own
  virtualFocus.set(true)
  await settle()
  expect(tabIndexes(tabs)).toEqual([-1, -1])
})
