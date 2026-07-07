import type { Computed, RouteChild } from '@reatom/core'

import type { Admin } from '../../index'
import { HeaderBar } from '../components/HeaderBar'
import { colors, p, scrollable } from '../styles'
import { Nav } from './Nav'

export interface LayoutProps {
  admin: Admin
  outlet: Computed<RouteChild[]>
}

export const Layout = ({ admin, outlet }: LayoutProps) => {
  return (
    <div
      css={`
        display: flex;
        flex-direction: column;
        background: ${colors.bg};
        color: ${colors.text};
        height: 100%;
        min-height: 0;
        overflow: hidden;
        font-size: 0.875rem;
      `}
    >
      <div
        css={`
          flex-shrink: 0;
          ${p(2)}
          padding-bottom: 0.5rem;

          @container admin-shell (max-width: 680px) {
            padding: 0.75rem;
            padding-bottom: 0.35rem;
          }
        `}
      >
        <HeaderBar admin={admin} />
      </div>
      <main
        css={`
          flex: 1;
          min-height: 0;
          ${scrollable}
          ${p(2)}
          padding-top: 0.5rem;

          @container admin-shell (max-width: 680px) {
            padding: 0.75rem;
            padding-top: 0.35rem;
          }
        `}
      >
        {outlet}
      </main>
      <Nav admin={admin} />
    </div>
  )
}
