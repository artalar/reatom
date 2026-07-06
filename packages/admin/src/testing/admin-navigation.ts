import { expect, waitFor } from 'storybook/test'

import {
  clickAdminButton,
  getAdminButton,
  getAdminShadowRoot,
  getAdminText,
} from '../stories/reatom-jsx-xo/testing'

export type AdminRouteLabel = 'Activity' | 'Timeline' | 'Graph' | 'Filters'

export async function navigateAdminRoute(
  routeLabel: AdminRouteLabel,
): Promise<void> {
  await clickAdminButton(new RegExp(routeLabel, 'i'))

  await waitFor(() => {
    expect(getAdminText()).toContain(routeLabel)
  })
}

export function getAdminRouteButton(
  routeLabel: AdminRouteLabel,
): HTMLButtonElement | null {
  return getAdminButton(new RegExp(routeLabel, 'i'))
}

export function queryAdminMainRegion(): HTMLElement | null {
  return getAdminShadowRoot().querySelector('main')
}
