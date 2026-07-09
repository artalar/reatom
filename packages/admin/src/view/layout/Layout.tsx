import type { Computed, RouteChild } from '@reatom/core'

import type { Admin } from '../../index'
import { HeaderBar } from '../components/HeaderBar'
import { colors, p } from '../styles'
import { Nav } from './Nav'

export interface LayoutProps {
  admin: Admin
  outlet: Computed<RouteChild[]>
  onMinimize?: () => void
}

export const Layout = ({ admin, outlet, onMinimize }: LayoutProps) => {
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
          padding-bottom: 0.4rem;

          @container admin-shell (max-width: 680px) {
            padding: 0.55rem;
            padding-bottom: 0.3rem;
          }
        `}
      >
        <HeaderBar admin={admin} onMinimize={onMinimize} />
      </div>
      <main
        css={`
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          ${p(2)}
          padding-top: 0.35rem;

          @container admin-shell (max-width: 680px) {
            padding: 0.55rem;
            padding-top: 0.25rem;
          }
        `}
      >
        <div
          css={`
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          `}
        >
          {outlet}
        </div>
      </main>
      <Nav admin={admin} />
    </div>
  )
}
