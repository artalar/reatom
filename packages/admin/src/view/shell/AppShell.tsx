import type { Admin } from '../../index'
import { createAdminRoutes } from '../routes'
import { adminShellContainer, colors } from '../styles'

export interface AppShellProps {
  admin: Admin
  onMinimize?: () => void
}

export const AppShell = ({ admin, onMinimize }: AppShellProps) => {
  const routes = createAdminRoutes(admin, { onMinimize })

  return (
    <div
      data-reatom-name="AppShell"
      data-testid="admin-visual-snapshot"
      css={`
        ${adminShellContainer}
        height: 100%;
        min-height: 0;
        overflow: hidden;
        background:
          radial-gradient(circle at top, rgba(139, 183, 255, 0.12), transparent 32%),
          linear-gradient(180deg, ${colors.bgElevated} 0%, ${colors.bg} 28%, ${colors.bg} 100%);
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          'Segoe UI',
          sans-serif;
      `}
    >
      {routes.layoutRoute.render}
    </div>
  )
}
