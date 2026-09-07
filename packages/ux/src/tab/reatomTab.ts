/**
 * Layer 1 for `tab`: the model — two collections (the tabs and their panels)
 * over one composite, plus the selection.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/tab/tab-store.ts`, plus the store-derivable
 * half of `packages/ariakit-react-components/src/tab/tab.tsx`, `tab-list.tsx`,
 * and `tab-panel.tsx`.
 */

import type { Action, Atom, Computed } from '@reatom/core'
import {
  action,
  atom,
  computed,
  effect,
  ifChanged,
  named,
  withComputed,
  withConnectHook,
  withMiddleware,
} from '@reatom/core'

import type {
  CollectionItemInit,
  CollectionItemModel,
  CollectionItemNode,
  CollectionModel,
} from '../collection/reatomCollection'
import { reatomCollection } from '../collection/reatomCollection'
import { getFirstEnabledId } from '../composite/getNextId'
import type {
  Composite,
  CompositeItemInit,
  CompositeItemNode,
  CompositeItemsModel,
  CompositeOptions,
} from '../composite/reatomComposite'
import {
  compositeElementId,
  reatomComposite,
} from '../composite/reatomComposite'
import type { TabPropRecords, TabPropsOptions } from './props'
import { withTabProps } from './props'

/** Registration payload of a tab panel — plain data, never atoms. */
export interface TabPanelInit extends CollectionItemInit {
  /**
   * The id of the tab this panel belongs to. Leave it out to pair the panel
   * with the tab at the same position, see {@link TabPanelState.tabId}.
   */
  tabId?: string | null
}

/** The atomized per panel state a tab model adds to every panel item. */
export interface TabPanelState {
  /**
   * The tab id the panel was registered with, `undefined` when it relies on the
   * positional pairing.
   */
  ownTabId: Atom<string | null | undefined>
  /**
   * The tab this panel belongs to: {@link TabPanelState.ownTabId} when it was
   * given, otherwise the rendered tab at the panel's own position among the
   * rendered panels. `undefined` while the pairing is not resolvable — before
   * the panel or its tab is rendered.
   *
   * @remarks
   *   Ariakit establishes the same pairing by _writing_ `tabId` into every orphan
   *   panel from a `sync` listener (`tab-store.ts`, "Keep panels tabIds in sync
   *   with the current tabs"). A pairing that is a function of two item lists
   *   is a derivation, so nothing is written and no listener has to run first —
   *   which also means an unrendered panel reports `undefined` instead of
   *   keeping the last id it was assigned.
   */
  tabId: Computed<string | undefined>
  /** Whether this panel's tab is the selected one, i.e. the panel is visible. */
  selected: Computed<boolean>
}

/** A tab panel as it is stored in the panels collection. */
export type TabPanelNode = CollectionItemNode<TabPanelState>

/** The panel collection of a tab model. */
export type TabPanelsModel = CollectionModel<TabPanelInit, TabPanelState>

/**
 * The host widget a tab list is rendered inside — a select or a combobox.
 *
 * @remarks
 *   Structural on purpose: Ariakit's `composite` / `combobox` store options are
 *   type-only edges (`tab-store.ts` imports both stores for their types alone),
 *   so the model asks for the three atoms it actually reads instead of a whole
 *   model. That keeps `tab` free of a runtime dependency on `combobox` and
 *   `select`, and lets any widget with a value and a popup play the host.
 * @example
 *   const combobox = reatomCombobox({ name: 'combobox' })
 *   const tab = reatomTab({
 *     host: {
 *       selectedValue: combobox.selectedValue,
 *       mounted: combobox.popover.mounted,
 *       virtualFocus: combobox.composite.virtualFocus,
 *     },
 *     name: 'combobox.tabs',
 *   })
 */
export interface TabHost {
  /**
   * The host's selected value. A change means the user picked something inside
   * a tab panel, which is when the selected tab is worth preserving.
   */
  selectedValue: Computed<unknown>
  /**
   * Whether the host's popup is mounted. Every change re-applies the preserved
   * selection, so re-opening the popup lands on the tab the value came from.
   */
  mounted: Computed<boolean>
  /**
   * Whether the host keeps DOM focus on itself and marks the active item with
   * `aria-activedescendant`. The tabs must then stay out of the tab order, or
   * focus would be trapped inside the host widget.
   */
  virtualFocus?: Computed<boolean>
}

/** Options of {@link reatomTab}. */
export interface TabOptions
  extends Omit<CompositeOptions, 'items'>, Omit<TabPropsOptions, 'name'> {
  /**
   * The initially selected tab, i.e. the panel that is visible first.
   *
   * - A string selects that tab.
   * - `null` selects nothing, so every panel starts hidden.
   * - `undefined` (the default) auto-seeds the first enabled rendered tab.
   */
  selectedId?: string | null
  /**
   * Whether moving the active tab also selects it — the APG's "selection
   * follows focus" for tabs, which is what makes arrow keys switch panels.
   *
   * @remarks
   *   Set it to `false` for a tab list whose panels are expensive or whose
   *   content is a form: arrow keys then only move focus, and `Enter` / `Space`
   *   (a click) selects.
   * @default true
   */
  selectOnMove?: boolean
  /**
   * Tabs to register upfront, in order — {@link CompositeOptions.items} under
   * the name the two collections make readable. They are registered but not
   * rendered, so nothing is navigable and nothing is selected until an element
   * mounts.
   */
  tabs?: Array<CompositeItemInit>
  /** Panels to register upfront, in order. */
  panels?: Array<TabPanelInit>
  /**
   * The select or combobox the tab list is rendered inside, see {@link TabHost}.
   *
   * @default null
   */
  host?: TabHost | null
  /**
   * Which arrow keys navigate the tab list. Ariakit's tab store overrides the
   * composite default (`'both'`) here, because the [APG tabs
   * pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) is a row of tabs.
   *
   * @default 'horizontal'
   */
  orientation?: CompositeOptions['orientation']
  /**
   * Loops from the last tab back to the first one. A tab list is a
   * single-choice list, so Ariakit overrides the composite default (`false`)
   * here too.
   *
   * @default true
   */
  focusLoop?: CompositeOptions['focusLoop']
  /**
   * Whether the tab list element itself is part of the arrow-key focus order.
   *
   * @remarks
   *   Pinned to `false` instead of the composite's `activeId === null` rule,
   *   because a tab list hosted in a combobox may legitimately start with a
   *   `null` active id — Ariakit passes the same explicit default, with the
   *   same comment.
   * @default false
   */
  includesBaseElement?: boolean
}

/** Units attached to the selected-tab atom by {@link reatomTab}. */
export interface TabUnits {
  /**
   * The composite sub-model: its own state is the active tab id, and it carries
   * the tab collection, the navigation flags, and the navigation queries.
   *
   * @remarks
   *   A sub-model instead of a merged surface, because a tab list has two
   *   distinct states — which panel is open (this model) and which tab has
   *   focus (`tab.composite()`) — and Ariakit's flat store shape is exactly
   *   what makes them easy to confuse.
   * @example
   *   tab.composite() // the focused tab
   *   tab.composite.navigate({ move: 'next' }) // arrow-key navigation
   *   tab.composite.extend(withCompositeFocus()) // move real DOM focus
   */
  composite: Composite
  /**
   * The tab collection — {@link Composite.items} itself, not a copy. The alias
   * exists because a tab widget has two collections, and naming them `tabs` and
   * `panels` is what makes the pairing readable.
   */
  tabs: CompositeItemsModel
  /** The panel collection, with {@link TabPanelState} per panel. */
  panels: TabPanelsModel
  /** Whether moving the active tab also selects it. */
  selectOnMove: Atom<boolean>
  /** The host widget the tab list is rendered inside, `null` when standalone. */
  host: TabHost | null
  /** The selected tab, `null` when nothing or an unknown tab is selected. */
  selectedTab: Computed<CompositeItemNode | null>
  /**
   * The rendered panel of a tab, or `null` for an unknown tab, an unpaired or
   * unrendered panel, or a nullish id. Never throws: missing ids and elements
   * are normal during mount/unmount races.
   */
  panelFor: (tabId?: string | null) => TabPanelNode | null
  /**
   * Selects a tab and moves the active tab to it, returning the resulting
   * selection — Ariakit's `select`.
   *
   * @remarks
   *   The move is what makes DOM focus follow, so this is the transition a
   *   keyboard shortcut or a "go to that tab" button wants. A click uses a
   *   plain write instead (`tab.set(id)`): focus is already on the tab, and the
   *   active tab follows the selection by derivation.
   *
   *   Refused — the current selection is returned unchanged — for a disabled tab,
   *   and for `undefined`, which is the "nowhere to go" result of a navigation
   *   query. An unknown id is _not_ refused: a route may select a tab before it
   *   registers.
   * @example
   *   tab.select(tab.composite.next()) // select the tab after the focused one
   */
  select: Action<[id?: string | null], string | null | undefined>
  /**
   * The selection remembered by {@link TabUnits.preserveSelectedId}, restored by
   * {@link TabUnits.restoreSelectedId}.
   */
  preservedSelectedId: Atom<string | null | undefined>
  /** Remembers the current selection. Returns what was remembered. */
  preserveSelectedId: Action<[], string | null | undefined>
  /**
   * Re-applies the remembered selection _without_ moving the active tab, and
   * returns it.
   *
   * @remarks
   *   Ariakit suppresses its `selectedId` → `activeId` listener with a mutable
   *   `syncActiveId` flag for exactly this write (`tab-store.ts`: "There are
   *   cases where we don't want to sync activeId with selectedId. For example,
   *   restoring the selectedId from a select or combobox selected value"). Here
   *   the restoration is a named action that writes the active tab back
   *   explicitly, so the logger shows both writes and their cause instead of a
   *   flag nobody can observe.
   */
  restoreSelectedId: Action<[], string | null | undefined>
}

/**
 * A tab model: the selected-tab atom extended with the composite sub-model, the
 * two collections, and the selection transitions.
 *
 * Reading the model reads the selected tab id, and writing it selects with no
 * guards at all — which is what a route, a form field, or a click handler
 * wants. Three values are meaningful:
 *
 * - A string is the selected tab;
 * - `null` is "nothing selected", so every panel is hidden;
 * - `undefined` means "not decided yet" and auto-seeds the first enabled rendered
 *   tab.
 */
export interface TabModel extends Atom<string | null | undefined>, TabUnits {}

/**
 * The model returned by {@link reatomTab}: a {@link TabModel} plus the prop
 * records.
 */
export interface Tab extends TabModel {
  /** Reactive prop records for the tab list, the tabs, and the panels. */
  props: TabPropRecords
}

/**
 * Whether a tab can be selected: it exists and is not disabled.
 *
 * @remarks
 *   Ported from Ariakit's `isEnabledTab`, which also rejects a `dimmed` tab — a
 *   tab whose element is disabled while the composite item stays navigable
 *   (`accessibleWhenDisabled`). This port has one flag instead of two: a
 *   disabled tab is the composite's `disabled`, which both skips it in
 *   navigation and refuses the selection, matching how `radio` maps the same
 *   Ariakit pair.
 * @example
 *   isSelectableTab(tab.tabs.item('drafts')) // false while it is disabled
 */
export const isSelectableTab = (
  tab?: CompositeItemNode | null,
): tab is CompositeItemNode => !!tab && !tab.disabled()

/**
 * Creates a tab model: an ordered, navigable list of tabs, the panels they
 * control, and the single selection that decides which panel is visible.
 *
 * @remarks
 *   Ported from Ariakit's framework-agnostic `createTabStore`. Five Ariakit
 *   mechanics change shape:
 *
 *   - `setSelectedId` is gone: writing the model _is_ the selection, and
 *       {@link TabUnits.select} is the variant that also moves focus.
 *   - The `sync(tab, ['moves'])` listener behind `selectOnMove` becomes a
 *       middleware on the composite's `move` action — the action is the event,
 *       so "selection follows focus" applies to navigation and not to a silent
 *       `composite.set(id)`.
 *   - The `batch(tab, ['selectedId'])` listener that keeps `activeId` in sync
 *       becomes `withComputed` on the composite, so the active tab follows the
 *       selection lazily, glitch-free, and without a store lifetime — while
 *       staying writable, which is what lets arrow keys move focus away from
 *       the selected tab when `selectOnMove` is off.
 *   - The `sync(tab, ['selectedId', 'renderedItems'])` auto-seed becomes
 *       `withComputed` on the model.
 *   - The mutable `syncActiveId` flag becomes {@link TabUnits.restoreSelectedId},
 *       see its remarks.
 *
 *   The other half of that `selectedId` listener — moving DOM focus to a tab
 *   selected from the outside while another tab has focus — reads
 *   `document.activeElement`, so it is the opt-in `withTabFocus()` of
 *   `reatomTabDom.ts` instead of part of the model.
 *
 *   Ariakit additionally _merges_ the tab store with a host composite store so
 *   both share `activeId` (everything else is `omit`ted). Sharing the active
 *   item needs an adopted `activeId` atom in {@link reatomComposite}, which this
 *   port does not have: a hosted tab list keeps its own active tab, and the
 *   host contributes only what {@link TabHost} describes. Registering the
 *   selected tab as an item of the host composite — Ariakit does it by
 *   rendering `Tab` inside a `CompositeItem` — stays with the view for the same
 *   reason.
 * @example
 *   const tab = reatomTab({ name: 'settings' })
 *
 *   // the view registers the elements, usually through the prop records
 *   tab.tabs.renderItem({ id: 'profile' })
 *   tab.tabs.renderItem({ id: 'billing' })
 *   tab.panels.renderItem({ id: 'profile-panel' })
 *   tab.panels.renderItem({ id: 'billing-panel' })
 *
 *   tab() // 'profile' — the first enabled tab is selected
 *   tab.composite() // 'profile' — and it holds the single tab stop
 *   tab.panels.item('billing-panel')!.tabId() // 'billing' — paired by position
 *
 *   tab.composite.navigate({ move: 'next' }) // arrow key
 *   tab() // 'billing' — selection follows focus
 *
 * @example
 *   // @reatom/jsx
 *   ;<div $spread={tab.props.list}>
 *   <button $spread={tab.props.tab(profile)}>Profile</button>
 *   </div>
 *   <div $spread={tab.props.panel(profilePanel)}>...</div>
 *
 * @param options - See {@link TabOptions}.
 * @returns The selected-tab atom extended with the tab units and prop records.
 * @see https://ariakit.com/components/tab
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 */
export const reatomTab = (options: TabOptions = {}): Tab => {
  const {
    selectedId: initSelectedId,
    selectOnMove: initSelectOnMove = true,
    tabs: initTabs,
    panels: initPanels,
    host = null,
    // Ariakit's `createTabStore` runs these three through its `defaultValue`
    // cascade before handing the props to the composite store; with plain option
    // defaults the cascade is the signature itself.
    orientation = 'horizontal',
    focusLoop = true,
    includesBaseElement = false,
    id: initId,
    name = named('tab'),
    // prop-record options
    labelledBy,
    panelFocusable,
    panelNavigation,
    ...compositeOptions
  } = options

  const selectedId = atom<string | null | undefined>(initSelectedId, name)

  const composite = reatomComposite({
    ...compositeOptions,
    items: initTabs,
    orientation,
    focusLoop,
    includesBaseElement,
    // The tab list id is the widget id, so it is derived from the model name
    // rather than from the sub-model's (`tab.composite`).
    id: initId ?? compositeElementId(name),
    name: `${name}.composite`,
  })

  const tabs = composite.items

  const selectOnMove = atom(initSelectOnMove, `${name}.selectOnMove`)

  const panels: TabPanelsModel = reatomCollection<TabPanelInit, TabPanelState>({
    create: (init: TabPanelInit, item: CollectionItemModel) => {
      const ownTabId = atom(init.tabId, `${item.name}.ownTabId`)

      const tabId = computed(() => {
        const own = ownTabId()
        if (own != null) return own
        // Ariakit pairs by the panel's index among the rendered panels, counting
        // the panels that carry their own tab id too.
        const index = panels
          .renderedItems()
          .findIndex((panel) => panel.id === item.id)
        if (index < 0) return undefined
        return tabs.renderedItems()[index]?.id
      }, `${item.name}.tabId`)

      return {
        ownTabId,
        tabId,
        selected: computed(() => {
          const id = tabId()
          return id !== undefined && id === selectedId()
        }, `${item.name}.selected`),
      }
    },
    update: (init, item) => {
      if (init.tabId !== undefined) item.ownTabId.set(init.tabId)
    },
    items: initPanels,
    name: `${name}.panels`,
  })

  // Ariakit seeds the selection from a `sync` listener that writes the state
  // back ("Automatically set selectedId if it's undefined"). A write-back
  // derivation that must stay writable is exactly `withComputed`.
  //
  // The cast works around `AtomState`, which drops `undefined` from a state
  // union because it infers through the optional `AtomLike.__state` property.
  selectedId.extend(
    withComputed(((state: string | null | undefined) => {
      // Read unconditionally: a conditional read would drop the dependency and
      // the seed would never arrive once a tab renders.
      const first = getFirstEnabledId(composite.navigationItems())
      return state === undefined ? first : state
    }) as (state: string | null) => string | null),
  )

  // The active tab follows the selected one, so `Tab` enters the widget at the
  // open tab and DOM focus lands there. Ariakit does this by writing `activeId`
  // from a `batch` listener on `selectedId`; the derivation stays writable, so
  // arrow keys can still move focus away from the selection.
  composite.extend(
    withComputed((state) => {
      const selected = selectedId()
      // "Not decided yet" leaves the composite's own "first enabled item" seed
      // alone.
      if (selected === undefined) return state
      // "Nothing selected" is the tab list element itself, as in Ariakit, where
      // the same listener writes a null selection straight through.
      if (selected === null) return null
      // Only a rendered tab can hold the tab stop; an unrendered one has no
      // element to focus.
      return tabs.item(selected)?.rendered() ? selected : state
    }),
  )

  const selectedTab = computed(
    () => tabs.item(selectedId() ?? null),
    `${name}.selectedTab`,
  )

  const panelFor = (tabId?: string | null): TabPanelNode | null => {
    if (tabId == null) return null
    return (
      panels.renderedItems().find((panel) => panel.tabId() === tabId) ?? null
    )
  }

  const select = action((id?: string | null): string | null | undefined => {
    // `undefined` is the "nowhere to go" result of a navigation query, not a
    // request to clear the selection — the `composite.move` contract.
    if (id === undefined) return selectedId()
    // A disabled tab is skipped by navigation, but `select` can still be called
    // with its id; an unknown one passes, because a tab may be selected before
    // it registers.
    if (tabs.item(id)?.disabled()) return selectedId()
    selectedId.set(id)
    composite.move(id)
    return id
  }, `${name}.select`)

  const preservedSelectedId = atom<string | null | undefined>(
    undefined,
    `${name}.preservedSelectedId`,
  )

  const preserveSelectedId = action(
    (): string | null | undefined => preservedSelectedId.set(selectedId()),
    `${name}.preserveSelectedId`,
  )

  const restoreSelectedId = action((): string | null | undefined => {
    const restored = preservedSelectedId()
    const active = composite()
    selectedId.set(restored)
    // The active tab is written back after the selection, which is what makes
    // this a selection-only change: a later write wins over the derivation.
    composite.set(active)
    return restored
  }, `${name}.restoreSelectedId`)

  // "Selection follows focus": the APG contract of a tab list, and what Ariakit
  // implements by watching its `moves` counter. The action _is_ the event here,
  // so the policy is a middleware on it — which keeps `composite.set(id)` the
  // silent "activate without selecting" of Ariakit's `setActiveId`.
  composite.move.extend(
    withMiddleware(() => (next, ...params) => {
      const payload = next(...params)
      const id = params[0]
      if (
        selectOnMove() &&
        typeof id === 'string' &&
        isSelectableTab(tabs.item(id))
      ) {
        selectedId.set(id)
      }
      return payload
    }),
  )

  if (host) {
    // Ariakit registers the same pair of listeners in `setup`, so they start
    // with the store's first subscriber and stop with its last one.
    selectedId.extend(
      withConnectHook(() => {
        effect(() => {
          // Both reads are unconditional and in a fixed order, which is what
          // `ifChanged` needs to tell its two dependencies apart.
          ifChanged(host.selectedValue, () => {
            // The first run is Ariakit's setup-time backup: `sync` calls its
            // listener immediately, which is what seeds the preserved selection.
            preserveSelectedId()
          })
          ifChanged(host.mounted, (_mounted, _prev, isFirst) => {
            // Ariakit's initial restoration writes back the value the backup
            // just took, so skipping the first run is the same behavior without
            // the write.
            if (!isFirst) restoreSelectedId()
          })
        }, `${name}.preserveSelection`)
      }),
    )
  }

  return selectedId
    .extend(() => ({
      composite,
      tabs,
      panels,
      selectOnMove,
      host,
      selectedTab,
      panelFor,
      select,
      preservedSelectedId,
      preserveSelectedId,
      restoreSelectedId,
    }))
    .extend(
      withTabProps({ labelledBy, panelFocusable, panelNavigation }),
    ) as Tab
}
