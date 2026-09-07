/**
 * Layer 2 for `tab`: moving real DOM focus when the selection changes under a
 * tab that has focus.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): the `getFocusedTab` branch of the `batch(tab,
 * ["selectedId"])` listener in
 * `packages/ariakit-components/src/tab/tab-store.ts`.
 */

import type { Ext } from '@reatom/core'
import {
  abortVar,
  addChangeHook,
  getCalls,
  withConnectHook,
  wrap,
} from '@reatom/core'

import type { CompositeItemNode } from '../composite/reatomComposite'
import type { TabModel } from './reatomTab'
import { isSelectableTab } from './reatomTab'

/**
 * The tab that currently holds DOM focus, `undefined` when focus is anywhere
 * else — outside the widget, or inside a panel.
 *
 * @remarks
 *   Port of Ariakit's `getFocusedTab`. The document is taken from the first tab
 *   rather than from `globalThis`, so a tab list inside an iframe is compared
 *   against its own `activeElement`.
 * @example
 *   getFocusedTab(tab.tabs.renderedItems())?.id // 'billing', or undefined
 */
export const getFocusedTab = (
  items: Array<CompositeItemNode>,
): CompositeItemNode | undefined => {
  const activeElement = items[0]?.element()?.ownerDocument.activeElement
  if (!activeElement) return undefined
  return items.find((item) => item.element() === activeElement)
}

/**
 * Moves DOM focus to the selected tab when the selection changes while another
 * tab has focus.
 *
 * @remarks
 *   The roving tab stop follows the selection on its own — that is the
 *   `withComputed` derivation in {@link reatomTab} — but a tab stop is not
 *   focus. When the app selects a tab from the outside (a route change, a
 *   button, a keyboard shortcut) while the user is standing on a tab, leaving
 *   DOM focus behind strands it on an element that is no longer tabbable, so
 *   the next arrow key starts from the wrong place. Ariakit fixed the same bug
 *   by turning that half of its `selectedId` listener into a `composite.move`.
 *
 *   Focus is only ever taken over, never taken away: nothing happens when focus
 *   is outside the tab list (a toolbar button that selects a tab keeps its own
 *   focus), when it is inside a tab panel (a field that selects a tab keeps the
 *   caret), when the selected tab is disabled or unrendered, or when the change
 *   came from a move — {@link Composite.move} and {@link TabUnits.select} already
 *   ask for focus, and {@link withCompositeFocus} is what grants it.
 *
 *   Pair it with `withCompositeFocus()` on the composite sub-model: this
 *   extension turns a selection into a move, and that one is what focuses the
 *   element.
 * @example
 *   const tab = reatomTab({ name: 'settings' }).extend(withTabFocus())
 *   tab.composite.extend(withCompositeFocus())
 *
 *   // the user is standing on the profile tab
 *   tab.set('billing') // focus follows the selection to the billing tab
 *
 * @see https://github.com/ariakit/ariakit/issues/4213
 */
export const withTabFocus = <T extends TabModel>(): Ext<T, T> => {
  return (target) =>
    target.extend(
      withConnectHook(() => {
        const signal = abortVar.require().signal

        return addChangeHook(target, (selected) => {
          // A move already asks for focus, so a selection that follows one is
          // not a reason to ask again — Ariakit's `activeId !==
          // selectedTab.id` guard, which holds for the same cases.
          if (getCalls(target.composite.move).length) return
          if (selected == null) return

          const items = target.tabs.renderedItems()
          const tab = items.find((item) => item.id === selected)
          if (!isSelectableTab(tab)) return

          const focused = getFocusedTab(items)
          if (!focused || focused === tab) return

          // Deferred like the focus call of `withCompositeFocus()`, and for
          // the same reason: the view has to apply the props of this selection
          // before anything focuses an element.
          queueMicrotask(
            wrap(() => {
              if (signal.aborted) return
              target.composite.move(selected)
            }),
          )
        })
      }),
    )
}
