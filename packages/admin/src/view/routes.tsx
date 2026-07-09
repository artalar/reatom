import type { RouteAtom } from '@reatom/core'
import { reatomRoute } from '@reatom/core'

import type { Admin } from '../index'
import { Layout } from './layout/Layout'
import { CauseGraphScreen } from './screens/CauseGraphScreen'
import { FiltersScreen } from './screens/FiltersScreen'
import { LogScreen } from './screens/LogScreen'
import { TimelineScreen } from './screens/TimelineScreen'

export interface AdminRoutes {
  layoutRoute: RouteAtom
  logRoute: RouteAtom
  timelineRoute: RouteAtom
  graphRoute: RouteAtom
  filtersRoute: RouteAtom
}

export interface CreateAdminRoutesOptions {
  onMinimize?: () => void
}

export function createAdminRoutes(
  admin: Admin,
  options: CreateAdminRoutesOptions = {},
): AdminRoutes {
  const { onMinimize } = options
  const layoutRoute = reatomRoute(
    {
      render(self) {
        return (
          <Layout admin={admin} outlet={self.outlet} onMinimize={onMinimize} />
        )
      },
    },
    '_Admin.layoutRoute',
  )

  const logRoute = layoutRoute.reatomRoute(
    {
      path: '',
      render() {
        return <LogScreen admin={admin} />
      },
    },
    '_Admin.logRoute',
  )

  const timelineRoute = layoutRoute.reatomRoute(
    {
      path: 'timeline',
      render() {
        return <TimelineScreen admin={admin} />
      },
    },
    '_Admin.timelineRoute',
  )

  const graphRoute = layoutRoute.reatomRoute(
    {
      path: 'graph',
      render() {
        return <CauseGraphScreen admin={admin} />
      },
    },
    '_Admin.graphRoute',
  )

  const filtersRoute = layoutRoute.reatomRoute(
    {
      path: 'filters',
      render() {
        return <FiltersScreen admin={admin} />
      },
    },
    '_Admin.filtersRoute',
  )

  return {
    layoutRoute,
    logRoute,
    timelineRoute,
    graphRoute,
    filtersRoute,
  }
}
