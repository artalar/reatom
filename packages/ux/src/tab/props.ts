/**
 * Layer 2 for `tab`: the reactive prop records of a tab list, of one tab, and
 * of one tab panel.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/tab/tab-list.tsx`, `tab.tsx`, and
 * `tab-panel.tsx`.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed, notify, withMemo, wrap } from '@reatom/core'

import type { CompositeOrientation } from '../composite/getNextId'
import type { CompositeNavigationIntent } from '../composite/navigationIntent'
import type {
  CompositeBaseProps,
  CompositeItemProps,
  CompositeItemPropsOptions,
} from '../composite/props'
import type { CompositeItemNode } from '../composite/reatomComposite'
import type { TabModel, TabPanelNode } from './reatomTab'

/**
 * The subset of a DOM event the tab prop records rely on.
 *
 * @remarks
 *   Every member is optional so the handlers can be unit-tested with plain
 *   objects, and so the records stay usable with the synthetic events of any
 *   framework.
 */
export interface TabPropsEvent {
  readonly defaultPrevented?: boolean
  preventDefault?: () => void
  stopPropagation?: () => void
}

/** The minimal shape of a key event the panel handler reads. */
export interface TabPanelKeyEvent {
  key: string
  readonly defaultPrevented?: boolean
  preventDefault?: () => void
}

/** Props to spread on the tab list element. */
export interface TabListProps extends CompositeBaseProps {
  /** The [`tablist`](https://w3c.github.io/aria/#tablist) role. */
  role: 'tablist'
  /**
   * The axis the tabs are laid out on, or `undefined` when the composite
   * navigates on both axes and no single orientation can be announced.
   */
  'aria-orientation': 'horizontal' | 'vertical' | undefined
  /**
   * The `id` of the element that labels the tab list — the [APG tabs
   * pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) asks for a label
   * whenever the page has more than one tab list.
   */
  'aria-labelledby': string | undefined
}

/** Props to spread on a tab element. */
export interface TabProps extends CompositeItemProps {
  /** The [`tab`](https://w3c.github.io/aria/#tab) role. */
  role: 'tab'
  /** Whether this tab's panel is the visible one. */
  'aria-selected': boolean
  /** The `id` of the panel this tab controls, while the panel is rendered. */
  'aria-controls': string | undefined
  /**
   * Never the native `disabled` attribute: a disabled tab stays focusable so a
   * screen-reader user can read the whole tab list, which is Ariakit's
   * `accessibleWhenDisabled` default for tabs. The handler guards keep the
   * selection safe instead.
   */
  'aria-disabled': 'true' | undefined
  /** Selects the tab. Focus is already on it, so nothing is moved. */
  onClick: (event?: TabPropsEvent) => void
}

/** Props to spread on a tab panel element. */
export interface TabPanelProps {
  /** The panel id, which its tab's `aria-controls` points at. */
  id: string
  /** The [`tabpanel`](https://w3c.github.io/aria/#tabpanel) role. */
  role: 'tabpanel'
  /** The `id` of the tab that labels the panel. */
  'aria-labelledby': string | undefined
  /** Whether the panel's tab is not the selected one. */
  hidden: boolean
  /** `{ display: 'none' }` while hidden, so a `display` rule cannot win. */
  style: { display: 'none' } | undefined
  /**
   * `0` while the panel itself takes part in the tab order, `undefined`
   * otherwise, see {@link TabPanelPropsOptions.focusable}.
   */
  tabIndex: number | undefined
  /** Assigns the panel's `element`; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
  /**
   * Switches tabs with the horizontal arrow keys and Home / End, for a hosted
   * tab list, see {@link TabPanelPropsOptions.navigation}.
   */
  onKeyDown: (event: TabPanelKeyEvent) => void
}

/** Options of {@link tabItemProps} — the composite item ones. */
export interface TabItemPropsOptions extends CompositeItemPropsOptions {}

/** Options of {@link tabPanelProps}. */
export interface TabPanelPropsOptions {
  /**
   * Whether the panel element itself is in the tab order, so `Tab` from the
   * selected tab lands on the panel.
   *
   * @remarks
   *   Ariakit derives it from the DOM: `focusable: !store.composite &&
   *   !hasTabbableChildren`, re-measured with `getAllTabbableIn` whenever the
   *   panel becomes visible — a panel that contains its own tab stops must not
   *   add another one. A headless record cannot measure the DOM, so the default
   *   only covers the first half (a hosted panel is never focusable) and the
   *   view passes `false` for a panel with tabbable content.
   * @default `!model.host`
   */
  focusable?: boolean
  /**
   * Whether ArrowLeft / ArrowRight / Home / End inside the panel switch tabs.
   *
   * @remarks
   *   Ariakit binds these keys only when the tab list is hosted in another
   *   composite widget (`if (!store.composite) return`), because then the panel
   *   content owns the vertical axis — a combobox list — and the tabs own the
   *   horizontal one. A standalone panel leaves every key to its content.
   * @default `!!model.host`
   */
  navigation?: boolean
  /**
   * The `id` of the element that labels the panel. Defaults to the panel's tab,
   * which is what pairs the two for a screen reader.
   */
  labelledBy?: string
  /** Prefix of the prop record name. Defaults to the panel name. */
  name?: string
}

/** Options of {@link tabProps} and {@link withTabProps}. */
export interface TabPropsOptions {
  /** `aria-labelledby` target of the tab list. */
  labelledBy?: string
  /** The default of {@link TabPanelPropsOptions.focusable} for every panel. */
  panelFocusable?: boolean
  /** The default of {@link TabPanelPropsOptions.navigation} for every panel. */
  panelNavigation?: boolean
  /** Prefix of the prop record names. Defaults to the model name. */
  name?: string
}

/** Reactive prop records of a tab model. */
export interface TabPropRecords {
  /** Props for the tab list element. */
  list: Computed<TabListProps>
  /**
   * Props for one tab element. The record is memoized per tab, so repeated
   * calls keep the same identity; passing options returns a fresh, uncached
   * record.
   */
  tab: (
    item: CompositeItemNode,
    options?: TabItemPropsOptions,
  ) => Computed<TabProps>
  /**
   * Props for one tab panel element, memoized per panel with the same policy as
   * {@link TabPropRecords.tab}.
   */
  panel: (
    panel: TabPanelNode,
    options?: TabPanelPropsOptions,
  ) => Computed<TabPanelProps>
}

/**
 * The `aria-orientation` a tab list announces.
 *
 * `'both'` has no ARIA counterpart — a widget that navigates on both axes must
 * not claim an axis — so it maps to "no attribute", matching Ariakit's
 * `state.orientation === 'both' ? undefined : state.orientation`.
 *
 * @example
 *   tabAriaOrientation('horizontal') // 'horizontal'
 *   tabAriaOrientation('both') // undefined
 */
export const tabAriaOrientation = (
  orientation: CompositeOrientation,
): 'horizontal' | 'vertical' | undefined =>
  orientation === 'both' ? undefined : orientation

/**
 * Which tab a key press inside a tab panel asks for.
 *
 * @remarks
 *   Ported from the `keyMap` of Ariakit's `useTabPanel`. The mapping is
 *   deliberately horizontal-only and ignores `orientation` and `rtl`: a hosted
 *   panel's own content is navigated vertically, so the tabs keep the free axis
 *   whatever the tab list orientation is.
 * @example
 *   mapTabPanelIntent({ key: 'ArrowRight' }) // { move: 'next' }
 *   mapTabPanelIntent({ key: 'ArrowDown' }) // undefined — the panel's own key
 */
export const mapTabPanelIntent = (
  event: TabPanelKeyEvent,
): CompositeNavigationIntent | undefined => {
  switch (event.key) {
    case 'ArrowLeft':
      return { move: 'previous' }
    case 'ArrowRight':
      return { move: 'next' }
    case 'Home':
      return { move: 'first' }
    case 'End':
      return { move: 'last' }
    default:
      return undefined
  }
}

/**
 * Reactive prop record for one tab element.
 *
 * @remarks
 *   Everything interactive but the click — the roving tabindex, the element ref,
 *   the focus handler, and the arrow-key navigation — comes from the composite
 *   item record unchanged, exactly like Ariakit's `useTab`, which adds three
 *   attributes and a click handler on top of `useCompositeItem`. The handlers
 *   are `wrap`ped so the state change is attributed to the DOM event in the
 *   logger, and they `notify()` so a host framework sees the update in the same
 *   tick — the `bindField` precedent.
 * @example
 *   const profile = tab.tabs.renderItem({ id: 'profile' })
 *   tabItemProps(tab, profile)() // { role: 'tab', 'aria-selected': true, ... }
 */
export const tabItemProps = (
  model: TabModel,
  item: CompositeItemNode,
  options: TabItemPropsOptions = {},
): Computed<TabProps> => {
  const { name = `${item.name}.props`, ...compositeOptions } = options
  const base = model.composite.props.item(item, {
    ...compositeOptions,
    name: `${name}.composite`,
  })

  const onClick = wrap((event: TabPropsEvent = {}) => {
    if (event.defaultPrevented) return
    if (item.disabled()) {
      // Ariakit cancels the click of a disabled element in `Focusable`
      // (`useDisableEvent`), which is what keeps a disabled tab from selecting
      // itself while it stays reachable for a screen reader.
      event.stopPropagation?.()
      event.preventDefault?.()
      return
    }
    // Ariakit's `Tab` calls `setSelectedId`, not `select`: the click has already
    // put DOM focus on the tab, and the active tab follows the selection by
    // derivation, so moving it again would be a second focus request.
    model.set(item.id)
    notify()
  })

  return computed((): TabProps => {
    const disabled = item.disabled()
    const record = base()

    return {
      ...record,
      role: 'tab',
      'aria-selected': item.id === model(),
      'aria-controls': model.panelFor(item.id)?.id,
      'aria-disabled': disabled ? 'true' : undefined,
      // A tab inside a host that keeps DOM focus on itself must not be tabbable,
      // or focus would be trapped in the host widget (Ariakit's
      // `isWithinVirtualFocusComposite`).
      tabIndex: model.host?.virtualFocus?.() ? -1 : record.tabIndex,
      onClick,
    }
  }, `${name}.tab`).extend(withMemo())
}

/**
 * Reactive prop record for one tab panel element.
 *
 * @remarks
 *   The panel is a collection item plus a disclosure: it is hidden while its tab
 *   is not the selected one. Animated panels are out of scope — Ariakit builds
 *   them from a private `DisclosureContent`; feed `panel.selected()` into a
 *   `reatomDisclosure` (`withDisclosureAnimation()`) and use its records when
 *   the panel has to stay mounted while it animates out.
 *
 *   Scroll restoration (Ariakit's `scrollRestoration` / `scrollElement`) is a
 *   view concern and is not ported.
 * @example
 *   const panel = tab.panels.renderItem({ id: 'profile-panel' })
 *   tabPanelProps(tab, panel)() // { role: 'tabpanel', hidden: false, ... }
 */
export const tabPanelProps = (
  model: TabModel,
  panel: TabPanelNode,
  options: TabPanelPropsOptions = {},
): Computed<TabPanelProps> => {
  const {
    focusable = !model.host,
    navigation = !!model.host,
    labelledBy,
    name = `${panel.name}.props`,
  } = options

  const ref = wrap((element: HTMLElement | null) => {
    panel.element.set(element)
  })

  const onKeyDown = wrap((event: TabPanelKeyEvent) => {
    if (event.defaultPrevented) return
    if (!navigation) return

    const intent = mapTabPanelIntent(event)
    if (!intent) return

    // Navigation starts at the _selected_ tab, not at the active item: with a
    // hosted tab list the active item is somewhere inside this panel.
    const id = model.composite.nextId(intent, { activeId: model() })
    // `undefined` means the navigation found nowhere to go, so the key keeps its
    // default behavior; `null` is the tab list element, which is not a tab.
    if (id == null) return

    event.preventDefault?.()
    // A move, not a `select`: it is the focus move that selects the tab through
    // `selectOnMove`, exactly like Ariakit's `store.move(nextId)`.
    model.composite.move(id)
    notify()
  })

  return computed((): TabPanelProps => {
    const hidden = !panel.selected()

    return {
      id: panel.id,
      role: 'tabpanel',
      'aria-labelledby': labelledBy ?? panel.tabId(),
      hidden,
      // Ariakit pairs `hidden` with `display: none` because the attribute alone
      // loses to a `display` rule.
      style: hidden ? { display: 'none' } : undefined,
      tabIndex: focusable ? 0 : undefined,
      ref,
      onKeyDown,
    }
  }, `${name}.tabpanel`).extend(withMemo())
}

/**
 * Builds the reactive prop records of a tab model.
 *
 * Each record is a `computed` returning a plain object, so it is memoized,
 * lazy, traceable by name, and neutral about the view library: React spreads
 * it, `@reatom/jsx` `$spread`s it, Vue `v-bind`s it.
 *
 * @example
 *   const props = tabProps(tab)
 *   props.list() // { role: 'tablist', 'aria-orientation': 'horizontal', ... }
 *   props.tab(tab.tabs.item('profile')!)()
 *   props.panel(tab.panels.item('profile-panel')!)()
 */
export const tabProps = (
  model: TabModel,
  options: TabPropsOptions = {},
): TabPropRecords => {
  const {
    labelledBy,
    panelFocusable,
    panelNavigation,
    name = model.name,
  } = options

  const tabRecords = new WeakMap<CompositeItemNode, Computed<TabProps>>()
  const panelRecords = new WeakMap<TabPanelNode, Computed<TabPanelProps>>()

  const panelDefaults = {
    ...(panelFocusable !== undefined && { focusable: panelFocusable }),
    ...(panelNavigation !== undefined && { navigation: panelNavigation }),
  }

  return {
    list: computed((): TabListProps => {
      const base = model.composite.props.base()

      return {
        ...base,
        role: 'tablist',
        'aria-orientation': tabAriaOrientation(model.composite.orientation()),
        'aria-labelledby': labelledBy,
        // Ariakit renders a hosted tab list with `focusable: false`, because the
        // host widget owns the widget's single tab stop.
        tabIndex: model.host ? undefined : base.tabIndex,
      }
    }, `${name}.props.tablist`).extend(withMemo()),

    tab: (item, itemOptions) => {
      if (itemOptions) return tabItemProps(model, item, itemOptions)

      let record = tabRecords.get(item)
      if (!record) {
        tabRecords.set(item, (record = tabItemProps(model, item)))
      }
      return record
    },

    panel: (panel, panelOptions) => {
      if (panelOptions) {
        return tabPanelProps(model, panel, {
          ...panelDefaults,
          ...panelOptions,
        })
      }

      let record = panelRecords.get(panel)
      if (!record) {
        panelRecords.set(
          panel,
          (record = tabPanelProps(model, panel, panelDefaults)),
        )
      }
      return record
    },
  }
}

/**
 * Attaches {@link tabProps} to a tab model as `model.props`.
 *
 * {@link reatomTab} applies it already; use it explicitly when composing a tab
 * model by hand.
 */
export const withTabProps = (
  options: TabPropsOptions = {},
): AssignerExt<{ props: TabPropRecords }, TabModel> => {
  return (target) => ({ props: tabProps(target, options) })
}
