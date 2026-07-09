import { urlAtom } from '@reatom/core'
import { expect, userEvent, waitFor } from 'storybook/test'

import { ADMIN_FRAME } from '../root'
import {
  getAdminShadowRoot,
  getAdminText,
} from '../stories/reatom-jsx-xo/testing'

export type AdminRouteLabel = 'Activity' | 'Timeline' | 'Graph' | 'Filters'

const ROUTE_PATHS: Record<AdminRouteLabel, string> = {
  Activity: '/',
  Timeline: '/timeline',
  Graph: '/graph',
  Filters: '/filters',
}

const ROUTE_MARKERS: Record<AdminRouteLabel, RegExp> = {
  Activity: /Activity feed/i,
  Timeline: /Session activity|Event list|No timeline yet/i,
  Graph: /Graph nodes|Causal graph|No graph yet|Select a frame/i,
  Filters: /Filter studio|Tag studio/i,
}

/**
 * Prefer clicking the bottom nav tab (aria-label). Fall back to ADMIN_FRAME
 * urlAtom.go when the nav button is missing.
 */
export async function navigateAdminRoute(
  routeLabel: AdminRouteLabel,
): Promise<void> {
  const shadow = getAdminShadowRoot()
  const navButton = shadow.querySelector(
    `nav button[aria-label="${routeLabel}"]`,
  )

  if (navButton instanceof HTMLButtonElement) {
    await userEvent.click(navButton)
  } else {
    ADMIN_FRAME.run(() => {
      urlAtom.go(ROUTE_PATHS[routeLabel])
    })
  }

  await waitFor(() => {
    expect(getAdminText()).toMatch(ROUTE_MARKERS[routeLabel])
  })
}

export function getAdminRouteButton(
  routeLabel: AdminRouteLabel,
): HTMLButtonElement | null {
  const button = getAdminShadowRoot().querySelector(
    `nav button[aria-label="${routeLabel}"]`,
  )
  return button instanceof HTMLButtonElement ? button : null
}

export function queryAdminMainRegion(): HTMLElement | null {
  return getAdminShadowRoot().querySelector('main')
}
