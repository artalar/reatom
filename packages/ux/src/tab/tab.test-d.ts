import type { Action, Atom, Computed } from '@reatom/core'
import { atom, reatomField } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { CompositeNavigationIntent } from '../composite/navigationIntent'
import type {
  CompositeItemNode,
  CompositeItemsModel,
} from '../composite/reatomComposite'
import type { TabListProps, TabPanelProps, TabProps } from './props'
import { mapTabPanelIntent, tabProps } from './props'
import type {
  TabHost,
  TabModel,
  TabPanelNode,
  TabPanelsModel,
} from './reatomTab'
import { isSelectableTab, reatomTab } from './reatomTab'
import { getFocusedTab, withTabFocus } from './reatomTabDom'

test('the model is the selected-tab atom, with the composite as a sub-model', () => {
  const tab = reatomTab({ name: 'tab' })

  expectTypeOf(tab()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(tab.set('one')).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(tab.set(null)).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(tab).toExtend<TabModel>()

  // the two states of a tab list stay apart: which panel is open and which tab
  // has focus
  expectTypeOf(tab.composite()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(tab.composite.navigate({ move: 'next' })).toEqualTypeOf<
    string | null | undefined
  >()
  expectTypeOf(tab.tabs).toExtend<CompositeItemsModel>()
  expectTypeOf(tab.panels).toExtend<TabPanelsModel>()
  expectTypeOf(tab.selectOnMove).toExtend<Atom<boolean>>()
  expectTypeOf(tab.host).toEqualTypeOf<TabHost | null>()
  expectTypeOf(tab.selectedTab()).toEqualTypeOf<CompositeItemNode | null>()
  expectTypeOf(tab.select('one')).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(tab.select()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(tab.panelFor('one')).toEqualTypeOf<TabPanelNode | null>()
  expectTypeOf(tab.preservedSelectedId).toExtend<
    Atom<string | null | undefined>
  >()
  expectTypeOf(tab.restoreSelectedId).toExtend<
    Action<[], string | null | undefined>
  >()

  // @ts-expect-error a tab is addressed by its id
  tab.select({ id: 'one' })
  // @ts-expect-error the composite options are checked
  reatomTab({ orientation: 'diagonal' })
  // @ts-expect-error the tabs option carries composite item payloads
  reatomTab({ tabs: [{ value: 'one' }] })
  // @ts-expect-error and the panels option carries panel payloads
  reatomTab({ panels: [{ tabId: 1 }] })
})

test('a panel carries the pairing and the visibility', () => {
  const tab = reatomTab({ panels: [{ id: 'p1', tabId: 'one' }], name: 'tab' })
  const panel = tab.panels.item('p1')!

  expectTypeOf(panel.id).toEqualTypeOf<string>()
  expectTypeOf(panel.ownTabId).toExtend<Atom<string | null | undefined>>()
  expectTypeOf(panel.tabId()).toEqualTypeOf<string | undefined>()
  expectTypeOf(panel.selected()).toEqualTypeOf<boolean>()
  expectTypeOf(panel.element()).toEqualTypeOf<HTMLElement | null>()
  expectTypeOf(
    tab.panels.renderItem({ id: 'p2' }),
  ).toEqualTypeOf<TabPanelNode>()
})

test('the host is a structural option, so combobox and select stay type-only', () => {
  // exactly the shape `reatomCombobox` satisfies with
  // `{ selectedValue, mounted: popover.mounted, virtualFocus }`
  const host = {
    selectedValue: atom<Array<string>>([], 'host.selectedValue'),
    mounted: atom(false, 'host.mounted'),
    virtualFocus: atom(false, 'host.virtualFocus'),
  }
  expectTypeOf(host).toExtend<TabHost>()
  expectTypeOf(reatomTab({ host }).host).toEqualTypeOf<TabHost | null>()

  // a select-shaped host, whose value is a single string, and no virtual focus
  const select = {
    selectedValue: reatomField('', 'select.value'),
    mounted: atom(true, 'select.mounted'),
  }
  expectTypeOf(select).toExtend<TabHost>()
  reatomTab({ host: select })
  reatomTab({ host: null })

  // @ts-expect-error a host without a value is not a host
  reatomTab({ host: { mounted: atom(false, 'mounted') } })
  // @ts-expect-error and `mounted` is a boolean atom
  reatomTab({ host: { selectedValue: atom(1, 'v'), mounted: atom(1, 'm') } })
})

test('prop records are framework neutral objects', () => {
  const tab = reatomTab({ name: 'tab' })
  const one = tab.tabs.renderItem({ id: 'one' })
  const panel = tab.panels.renderItem({ id: 'p1' })

  expectTypeOf(tab.props.list()).toEqualTypeOf<TabListProps>()
  expectTypeOf(tab.props.list().role).toEqualTypeOf<'tablist'>()
  expectTypeOf(tab.props.list()['aria-orientation']).toEqualTypeOf<
    'horizontal' | 'vertical' | undefined
  >()

  expectTypeOf(tab.props.tab(one)()).toEqualTypeOf<TabProps>()
  expectTypeOf(tab.props.tab(one)().role).toEqualTypeOf<'tab'>()
  expectTypeOf(tab.props.tab(one)()['aria-selected']).toEqualTypeOf<boolean>()
  expectTypeOf(tab.props.tab(one)()['aria-controls']).toEqualTypeOf<
    string | undefined
  >()
  expectTypeOf(tab.props.tab(one, { tabbable: true })).toExtend<
    Computed<TabProps>
  >()

  expectTypeOf(tab.props.panel(panel)()).toEqualTypeOf<TabPanelProps>()
  expectTypeOf(tab.props.panel(panel)().role).toEqualTypeOf<'tabpanel'>()
  expectTypeOf(tab.props.panel(panel)().hidden).toEqualTypeOf<boolean>()
  expectTypeOf(tab.props.panel(panel, { focusable: false })).toExtend<
    Computed<TabPanelProps>
  >()
  expectTypeOf(tabProps(tab, { panelNavigation: true }).panel(panel)).toExtend<
    Computed<TabPanelProps>
  >()

  // @ts-expect-error a panel record needs a panel, not a tab
  tab.props.panel(one)
  // @ts-expect-error and a tab record needs a tab
  tab.props.tab(panel)
})

test('withTabFocus keeps the model type it extends', () => {
  const tab = reatomTab({ name: 'tab' }).extend(withTabFocus())

  expectTypeOf(tab()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(tab.props.list()).toEqualTypeOf<TabListProps>()
  expectTypeOf(tab.select('one')).toEqualTypeOf<string | null | undefined>()
})

test('the pure helpers work on plain data, with no model', () => {
  expectTypeOf(mapTabPanelIntent({ key: 'ArrowRight' })).toEqualTypeOf<
    CompositeNavigationIntent | undefined
  >()
  expectTypeOf(isSelectableTab(null)).toEqualTypeOf<boolean>()
  expectTypeOf(getFocusedTab([])).toEqualTypeOf<CompositeItemNode | undefined>()

  // @ts-expect-error the intent mapper reads a key event
  mapTabPanelIntent('ArrowRight')
})
